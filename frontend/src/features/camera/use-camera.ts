import { useCallback, useEffect, useRef, useState } from 'react'
import { drawResizedJpeg } from '@/shared/lib/image-resize'
import { usePageVisibility } from '@/shared/lib/use-page-visibility'

/**
 * 카메라 상태
 * - idle: 아직 켜지 않음(동의 전·촬영 후) / requesting: 권한을 묻거나 켜는 중 / ready: 미리보기 중
 * - denied: 권한 거부 / unavailable: 카메라 없음 / busy: 다른 앱이 쓰는 중 / unsupported: 브라우저가 지원 안 함 / error: 그 밖의 오류
 */
export type CameraStatus =
  'idle' | 'requesting' | 'ready' | 'denied' | 'unavailable' | 'busy' | 'unsupported' | 'error'

export type CameraFacingMode = 'user' | 'environment'

/** 카메라를 쓸 수 없는 상태. 이때는 미리보기 대신 안내(CameraUnavailableNotice)를 보여 준다 */
export function isCameraUnavailable(status: CameraStatus): boolean {
  return ['denied', 'unavailable', 'busy', 'unsupported', 'error'].includes(status)
}

/** 셀카를 보낼 때 줄이는 긴 변 길이(계획 문서 5단계) */
const selfieLongEdge = 1024

// getUserMedia 오류 이름을 화면 안내용 상태로 바꾼다
function classifyCameraError(error: unknown): CameraStatus {
  const errorName = error instanceof DOMException ? error.name : ''
  if (errorName === 'NotAllowedError' || errorName === 'SecurityError') return 'denied'
  if (errorName === 'NotFoundError' || errorName === 'OverconstrainedError') return 'unavailable'
  if (errorName === 'NotReadableError' || errorName === 'AbortError') return 'busy'
  return 'error'
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

// 카메라 켜기·끄기·찍기. enabled가 true이고 탭이 보일 때만 켜며, 화면을 떠나거나 탭이 숨으면 끈다(배터리·사생활)
export function useCamera({ enabled }: { enabled: boolean }) {
  const videoElementRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isPageVisible = usePageVisibility()
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user')
  const [restartCount, setRestartCount] = useState(0)
  const [canSwitchCamera, setCanSwitchCamera] = useState(false)
  // 켜기 시도마다 결과를 기억한다. 시도 열쇠가 바뀌면(카메라 전환·다시 시도) 자동으로 '켜는 중'이 된다
  const [attemptResult, setAttemptResult] = useState<{ attemptKey: string; status: CameraStatus }>()

  const isSupported =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const shouldRun = enabled && isPageVisible && isSupported
  const attemptKey = `${facingMode}-${restartCount}`

  // 비디오 요소가 새로 생기면(PC·휴대폰 배치가 바뀌는 등) 켜져 있는 카메라 화면을 다시 연결한다
  const videoRef = useCallback((videoElement: HTMLVideoElement | null) => {
    videoElementRef.current = videoElement
    if (videoElement && streamRef.current && videoElement.srcObject !== streamRef.current) {
      videoElement.srcObject = streamRef.current
      void videoElement.play().catch(() => {})
    }
  }, [])

  useEffect(() => {
    if (!shouldRun) return
    let isCancelled = false
    // 정리할 때 같은 비디오 요소를 쓰도록 지금 값을 잡아 둔다
    const videoElement = videoElementRef.current

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        })
        if (isCancelled) {
          stopStream(stream)
          return
        }
        streamRef.current = stream
        if (videoElement) {
          videoElement.srcObject = stream
          // 아이폰은 사용자 동작 없이 재생하려면 muted·playsInline이 필요하다(비디오 요소에 지정)
          await videoElement.play().catch(() => {})
        }
        setAttemptResult({ attemptKey, status: 'ready' })
        // 카메라가 둘 이상일 때만 전환 버튼을 보여 준다(권한을 받은 뒤라야 목록이 정확하다)
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!isCancelled) {
          setCanSwitchCamera(devices.filter((device) => device.kind === 'videoinput').length > 1)
        }
      } catch (error) {
        if (!isCancelled) setAttemptResult({ attemptKey, status: classifyCameraError(error) })
      }
    }
    void startCamera()

    return () => {
      isCancelled = true
      stopStream(streamRef.current)
      streamRef.current = null
      if (videoElement) videoElement.srcObject = null
    }
  }, [shouldRun, facingMode, attemptKey])

  const status: CameraStatus = !enabled
    ? 'idle'
    : !isSupported
      ? 'unsupported'
      : attemptResult?.attemptKey === attemptKey
        ? attemptResult.status
        : 'requesting'

  // 지금 화면을 찍어 1024px JPG로 만든다. 미리보기는 거울처럼 뒤집어 보여 주지만 보내는 사진은 뒤집지 않는다
  const captureSelfie = useCallback(async (): Promise<Blob> => {
    const video = videoElementRef.current
    if (!video || video.videoWidth === 0) throw new Error('카메라 화면이 아직 준비되지 않았어요')
    return drawResizedJpeg(
      { source: video, width: video.videoWidth, height: video.videoHeight },
      selfieLongEdge,
    )
  }, [])

  return {
    videoRef,
    status,
    facingMode,
    canSwitchCamera,
    captureSelfie,
    /** 앞·뒤 카메라 전환 */
    switchCamera: () => setFacingMode((current) => (current === 'user' ? 'environment' : 'user')),
    /** 권한을 허용한 뒤 등 다시 켜 본다 */
    retry: () => setRestartCount((count) => count + 1),
  }
}

export { selfieLongEdge }
