import { RefreshCwIcon, SearchIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { matchSelfie } from '@/entities/person/person-api'
import { useCurrentParticipantSession } from '@/entities/session/participant-session'
import { CameraPreview } from '@/features/camera/camera-preview'
import { CameraUnavailableNotice } from '@/features/camera/camera-unavailable-notice'
import { PhotoPicker } from '@/features/camera/photo-picker'
import { ShutterButton } from '@/features/camera/shutter-button'
import { isCameraUnavailable, selfieLongEdge, useCamera } from '@/features/camera/use-camera'
import { ConsentCheckbox } from '@/features/selfie-search/consent-panel'
import { consentNotices, consentRememberNotice } from '@/features/selfie-search/consent-texts'
import { ContinueOnPhoneQr } from '@/features/selfie-search/continue-on-phone-qr'
import { FaceConsentSheet } from '@/features/selfie-search/face-consent-sheet'
import {
  hasFaceConsent,
  revokeFaceConsent,
  saveFaceConsent,
} from '@/features/selfie-search/face-consent-storage'
import { saveSelfieMatchResult } from '@/features/selfie-search/selfie-match-result-storage'
import { SelfieSearchingView } from '@/features/selfie-search/selfie-searching-view'
import { useEventNotReadyRedirect } from '@/pages/participant/use-event-not-ready-redirect'
import { isApiErrorWithCode } from '@/shared/api/api-error'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { resizeImageFileToJpeg } from '@/shared/lib/image-resize'
import { desktopMediaQuery, useMediaQuery } from '@/shared/lib/use-media-query'
import { cn } from '@/shared/lib/utils'
import { AppLogo } from '@/shared/ui/app-logo'
import { Button } from '@/shared/ui/button'
import { ErrorState } from '@/shared/ui/error-state'

/** 찍기 → 찾는 중 → (실패하면) 다시 시도. 셀카는 이 화면의 메모리에만 잠깐 있고 저장하지 않는다 */
type SearchState =
  | { phase: 'capturing' }
  | { phase: 'searching'; selfie: Blob }
  | { phase: 'failed'; selfie: Blob; error: unknown }

// ②-1 동의 · ③ 셀카 촬영 · ③-1 찾는 중 (휴대폰 시안 ②-1·③·③-1, PC P3).
// 동의하기 전에는 카메라를 켜지 않고, 찍으면 1024px JPG로 줄여 검색(#8)한 뒤 결과를 ④로 넘긴다
export default function CameraPage() {
  const session = useCurrentParticipantSession()
  const navigate = useNavigate()
  const isDesktop = useMediaQuery(desktopMediaQuery)
  const [hasConsent, setHasConsent] = useState(() => hasFaceConsent(session.eventId))
  const [searchState, setSearchState] = useState<SearchState>({ phase: 'capturing' })
  const [captureHint, setCaptureHint] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const camera = useCamera({ enabled: hasConsent && searchState.phase === 'capturing' })
  useEventNotReadyRedirect(searchState.phase === 'failed' ? searchState.error : null, session)

  // 화면을 떠나면 진행 중인 검색 요청을 멈춘다
  useEffect(() => () => abortControllerRef.current?.abort(), [])

  // 셀카로 검색하고 결과를 ④로 넘긴다. 후보 0명은 ④-1, 얼굴 없음은 ④-2
  async function searchWithSelfie(selfie: Blob) {
    setCaptureHint('')
    setSearchState({ phase: 'searching', selfie })
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    try {
      const match = await matchSelfie({
        eventId: session.eventId,
        selfie,
        signal: abortController.signal,
      })
      saveSelfieMatchResult(
        session.eventId,
        match.candidates.length > 0
          ? { kind: 'candidates', candidates: match.candidates }
          : { kind: 'no-match' },
      )
      void navigate(paths.eventCandidates(session.accessCode))
    } catch (error) {
      if (abortController.signal.aborted) return
      if (isApiErrorWithCode(error, 'FACE_NOT_DETECTED')) {
        saveSelfieMatchResult(session.eventId, { kind: 'no-face' })
        void navigate(paths.eventCandidates(session.accessCode))
        return
      }
      setSearchState({ phase: 'failed', selfie, error })
    }
  }

  async function captureFromCamera() {
    try {
      await searchWithSelfie(await camera.captureSelfie())
    } catch {
      setCaptureHint('카메라 화면이 준비되면 다시 눌러주세요.')
    }
  }

  // 갤러리에서 고른 사진도 같은 크기(1024px JPG)로 줄여서 보낸다
  async function searchWithPickedPhoto(file: File) {
    if (!hasConsent) {
      setCaptureHint('먼저 얼굴 정보 처리에 동의해주세요.')
      return
    }
    try {
      await searchWithSelfie(await resizeImageFileToJpeg(file, selfieLongEdge))
    } catch {
      setCaptureHint('사진을 열지 못했어요. 다른 사진을 골라주세요.')
    }
  }

  function cancelSearch() {
    abortControllerRef.current?.abort()
    setSearchState({ phase: 'capturing' })
  }

  function updateConsent(isAgreed: boolean) {
    if (isAgreed) saveFaceConsent(session.eventId)
    else revokeFaceConsent(session.eventId)
    setHasConsent(isAgreed)
    setCaptureHint('')
  }

  // ③-1 찾는 중 / 실패: 휴대폰·PC 같은 화면(흰 바탕)
  if (searchState.phase === 'searching') {
    return (
      <div className="flex flex-1 flex-col pt-[calc(env(safe-area-inset-top)+16px)] lg:mx-auto lg:w-full lg:max-w-[480px] lg:pt-16">
        <AppLogo size="medium" className="px-6 lg:hidden" />
        <SelfieSearchingView selfie={searchState.selfie} onCancel={cancelSearch} />
      </div>
    )
  }
  if (searchState.phase === 'failed') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-10">
        <ErrorState
          title="닮은 얼굴을 찾지 못했어요"
          description={getErrorMessage(searchState.error)}
          retryLabel="다시 시도"
          onRetry={() => void searchWithSelfie(searchState.selfie)}
        />
        <Button variant="ghost" onClick={() => setSearchState({ phase: 'capturing' })}>
          다시 찍기
        </Button>
      </div>
    )
  }

  const photoPickerLink = (
    <PhotoPicker
      onPick={(file) => void searchWithPickedPhoto(file)}
      className={isDesktop ? undefined : 'text-dark-foreground-secondary'}
    />
  )
  const preview = (
    <CameraPreview
      videoRef={camera.videoRef}
      isMirrored={camera.facingMode === 'user'}
      isReady={camera.status === 'ready'}
      unavailableNotice={
        !hasConsent ? (
          <p className="text-center text-small text-dark-foreground-secondary">
            동의하면 카메라가 켜져요.
          </p>
        ) : isCameraUnavailable(camera.status) ? (
          <CameraUnavailableNotice
            status={camera.status}
            onRetry={camera.retry}
            photoPicker={
              <PhotoPicker
                onPick={(file) => void searchWithPickedPhoto(file)}
                variant="secondary"
              />
            }
          />
        ) : undefined
      }
      className={isDesktop ? 'h-[440px]' : 'min-h-[360px] flex-1'}
    />
  )

  // PC(P3): 왼쪽 미리보기 + 오른쪽 동의·QR
  if (isDesktop) {
    return (
      <div className="flex flex-wrap gap-8 px-6 pt-8 pb-10">
        <section className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          <Link
            to={paths.eventHome(session.accessCode)}
            className="touch-target flex items-center self-start text-small font-semibold text-muted-foreground"
          >
            ← 사람별 사진
          </Link>
          <h1 className="text-[26px] leading-9 font-bold">셀카로 빨리 찾기</h1>
          {preview}
          <div className="flex flex-col items-center gap-2">
            <Button
              size="lg"
              className="px-10"
              onClick={() => {
                if (!hasConsent) setCaptureHint('먼저 얼굴 정보 처리에 동의해주세요.')
                else void captureFromCamera()
              }}
            >
              <SearchIcon />
              촬영하고 찾기
            </Button>
            {photoPickerLink}
            {captureHint && (
              <p role="alert" className="text-small text-danger">
                {captureHint}
              </p>
            )}
          </div>
        </section>
        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 pt-18">
          <div className="flex flex-col gap-4 rounded-lg border border-border p-6">
            <h2 className="text-headline font-bold">찍기 전에 확인해주세요</h2>
            <ul className="flex list-disc flex-col gap-2.5 pl-4.5 text-small leading-[1.55] text-muted-foreground">
              {consentNotices.map((notice) => (
                <li key={notice.text}>{notice.text}</li>
              ))}
            </ul>
            <ConsentCheckbox isChecked={hasConsent} onCheckedChange={updateConsent} />
            <p className="-mt-2 text-caption text-muted-foreground">{consentRememberNotice}</p>
          </div>
          <ContinueOnPhoneQr
            targetUrl={`${window.location.origin}${paths.eventJoin(
              session.accessCode,
              paths.eventCamera(session.accessCode),
            )}`}
          />
        </aside>
      </div>
    )
  }

  // 휴대폰(③): 어두운 전체 화면. 동의 전이면(주소로 바로 들어온 경우) 동의 시트를 먼저 띄운다
  return (
    <div className="flex flex-1 flex-col bg-dark-bg pt-[calc(env(safe-area-inset-top)+8px)] pb-[calc(env(safe-area-inset-bottom)+40px)] text-dark-foreground">
      <div className="flex items-center justify-between px-3">
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="닫기"
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <Link to={paths.eventHome(session.accessCode)}>
            <XIcon className="size-6" />
          </Link>
        </Button>
        <h1 className="text-body font-semibold">셀카로 찾기</h1>
        <div className="size-11" />
      </div>
      <div className="flex flex-1 flex-col px-4 pt-4">{preview}</div>
      <div className="grid grid-cols-3 items-center px-10 pt-6">
        <div />
        {/* 카메라를 쓸 수 없을 때는 셔터를 숨긴다(자리는 남겨 배치가 흔들리지 않게) */}
        <div
          className={cn('justify-self-center', isCameraUnavailable(camera.status) && 'invisible')}
        >
          <ShutterButton
            isReady={camera.status === 'ready'}
            onCapture={() => void captureFromCamera()}
          />
        </div>
        {camera.canSwitchCamera && camera.status === 'ready' && (
          <button
            type="button"
            aria-label="카메라 전환"
            onClick={camera.switchCamera}
            className="flex size-12 items-center justify-center justify-self-end rounded-full bg-dark-surface outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <RefreshCwIcon className="size-5.5" aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="flex flex-col items-center pt-2">
        {photoPickerLink}
        {captureHint && (
          <p role="alert" className="text-small text-dark-foreground-secondary">
            {captureHint}
          </p>
        )}
      </div>
      <FaceConsentSheet
        isOpen={!hasConsent}
        onOpenChange={(isOpen) => {
          if (!isOpen) void navigate(paths.eventHome(session.accessCode))
        }}
        onAgree={() => updateConsent(true)}
      />
    </div>
  )
}
