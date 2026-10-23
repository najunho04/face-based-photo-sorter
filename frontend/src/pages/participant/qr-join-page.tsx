import { useQuery } from '@tanstack/react-query'
import { LoaderCircleIcon } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { normalizeAccessCode } from '@/entities/session/access-code'
import { saveJoinedEvent } from '@/entities/session/participant-session'
import { joinEvent } from '@/entities/session/session-api'
import { sessionQueryKeys } from '@/entities/session/session-query-keys'
import type { EntryPageState } from '@/pages/participant/entry-page'
import { isApiErrorWithCode } from '@/shared/api/api-error'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { getSafeNextPath } from '@/shared/lib/safe-next-path'
import { AppLogo } from '@/shared/ui/app-logo'
import { ErrorState } from '@/shared/ui/error-state'

// ①-0 QR로 입장 중: 주소의 인증코드로 자동 입장한다. QR, ⑧의 [다시 입장하기], 가드(입장 정보 없음)가 이 화면으로 보낸다.
// 공개됐으면 돌아갈 주소(next, 없으면 ②)로, 아니면 ①-1로 간다. 코드가 틀리면 ①로 가서 ①-2 오류를 보여 준다
export default function QrJoinPage() {
  const navigate = useNavigate()
  const { code = '' } = useParams()
  const [searchParams] = useSearchParams()
  const accessCode = normalizeAccessCode(code)
  const nextPath = getSafeNextPath(searchParams.get('next'), paths.eventHome(accessCode))

  // 입장은 한 번만: 같은 화면을 다시 그려도(개발 모드 StrictMode 포함) 같은 요청을 재사용한다
  const joinQuery = useQuery({
    queryKey: sessionQueryKeys.join(accessCode),
    queryFn: () => joinEvent(accessCode),
    staleTime: Infinity,
    gcTime: 0,
  })

  useEffect(() => {
    if (!joinQuery.data) return
    const session = saveJoinedEvent(joinQuery.data, accessCode)
    void navigate(session.isEventOpen ? nextPath : paths.eventPreparing(accessCode), {
      replace: true,
    })
  }, [joinQuery.data, accessCode, nextPath, navigate])

  const isInvalidCode =
    isApiErrorWithCode(joinQuery.error, 'INVALID_ACCESS_CODE') ||
    isApiErrorWithCode(joinQuery.error, 'INVALID_REQUEST')
  useEffect(() => {
    if (!isInvalidCode) return
    const entryState: EntryPageState = {
      accessCode,
      errorMessage: getErrorMessage(joinQuery.error),
    }
    void navigate(paths.entry, { replace: true, state: entryState })
  }, [isInvalidCode, accessCode, joinQuery.error, navigate])

  return (
    <div className="flex flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+24px)] lg:py-20">
      <AppLogo size="medium" className="lg:hidden" />
      {joinQuery.isError && !isInvalidCode ? (
        // 네트워크 등 코드 외의 이유로 실패: 다시 시도하거나 코드를 직접 입력하게 한다
        <ErrorState
          className="flex-1 justify-center"
          title="입장하지 못했어요"
          description={getErrorMessage(joinQuery.error)}
          onRetry={() => void joinQuery.refetch()}
        />
      ) : (
        <div
          role="status"
          className="flex flex-1 flex-col items-center justify-center gap-5 text-center"
        >
          <div className="flex size-18 items-center justify-center rounded-full bg-secondary">
            <LoaderCircleIcon className="size-8 animate-spin text-primary" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-title-1">입장하는 중이에요</h1>
            <p className="text-[15px] leading-6 text-muted-foreground">
              인증코드를 확인하고 있어요.
            </p>
          </div>
          <span className="rounded-full bg-muted px-3.5 py-1.5 text-[15px] font-semibold tracking-[3px] text-muted-foreground">
            {accessCode}
          </span>
        </div>
      )}
      <Link
        to={paths.entry}
        state={{ accessCode } satisfies EntryPageState}
        className="flex min-h-11 items-center self-center text-small font-semibold text-muted-foreground"
      >
        코드를 직접 입력할게요
      </Link>
    </div>
  )
}
