import { useMutation } from '@tanstack/react-query'
import { CircleAlertIcon, QrCodeIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { normalizeAccessCode } from '@/entities/session/access-code'
import { saveJoinedEvent } from '@/entities/session/participant-session'
import { joinEvent } from '@/entities/session/session-api'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { AppLogo } from '@/shared/ui/app-logo'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** ①-0에서 코드가 틀려 돌아올 때 넘겨받는 값(코드를 채워 두고 ①-2 오류를 보여 준다) */
export type EntryPageState = { accessCode?: string; errorMessage?: string }

// ① 입장 (시안 ①, ①-2, PC P1): 인증코드를 입력해 행사에 들어간다.
// 휴대폰은 한 줄 배치, PC는 왼쪽 소개 + 오른쪽 입장 카드
export default function EntryPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const passedState = location.state as EntryPageState | null
  const [accessCode, setAccessCode] = useState(passedState?.accessCode ?? '')
  const [errorMessage, setErrorMessage] = useState(passedState?.errorMessage ?? '')
  const joinMutation = useMutation({ mutationFn: joinEvent })
  const accessCodeInputId = useId()
  const errorMessageId = useId()

  // 입장: 코드를 정리해 보내고, 공개됐으면 ② 사람별 사진, 아니면 ①-1 사진 정리 중으로 간다
  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    const normalizedAccessCode = normalizeAccessCode(accessCode)
    if (!normalizedAccessCode) {
      setErrorMessage('인증코드를 입력해주세요.')
      return
    }
    setErrorMessage('')
    try {
      const join = await joinMutation.mutateAsync(normalizedAccessCode)
      const session = saveJoinedEvent(join, normalizedAccessCode)
      void navigate(
        session.isEventOpen
          ? paths.eventHome(normalizedAccessCode)
          : paths.eventPreparing(normalizedAccessCode),
      )
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  return (
    <div className="flex flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+40px)] pb-[calc(env(safe-area-inset-bottom)+24px)] lg:flex-row lg:flex-wrap lg:items-center lg:gap-16 lg:py-18">
      {/* PC에서는 위쪽 머리글에 로고가 있으므로 휴대폰에서만 보여 준다 */}
      <AppLogo size="medium" className="lg:hidden" />

      <div className="mt-16 flex flex-col gap-3 lg:mt-0 lg:min-w-0 lg:flex-[1_1_420px] lg:gap-5">
        <h1 className="text-display lg:text-[44px] lg:leading-[1.3]">
          행사 사진 속<br />내 사진만 골라 받기
        </h1>
        <p className="text-[15px] leading-6 text-muted-foreground lg:hidden">
          주최 측에서 받은 인증코드를 입력하세요.
        </p>
        <p className="hidden text-[17px] leading-[1.7] text-muted-foreground lg:block">
          수백 장을 한 장씩 넘겨볼 필요 없어요.
          <br />
          사람별로 정리된 사진에서 바로 찾거나, 셀카 한 장으로 빨리 찾을 수 있어요.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="mt-10 flex flex-col lg:mt-0 lg:w-full lg:max-w-[420px] lg:flex-[1_1_360px] lg:rounded-lg lg:border lg:border-border lg:p-9"
      >
        <div className="mb-6 hidden flex-col gap-2 lg:flex">
          <h2 className="text-title-2">행사 입장</h2>
          <p className="text-small text-muted-foreground">
            주최 측에서 받은 인증코드를 입력하세요.
          </p>
        </div>
        <Label htmlFor={accessCodeInputId} className="mb-2">
          인증코드
        </Label>
        <Input
          id={accessCodeInputId}
          name="accessCode"
          inputSize="lg"
          value={accessCode}
          // 입력하는 대로 대문자로 바꾸고 공백·하이픈을 뺀다(결정 기록 4단계)
          onChange={(changeEvent) => {
            setAccessCode(normalizeAccessCode(changeEvent.target.value))
            setErrorMessage('')
          }}
          placeholder="A7K2Q9"
          maxLength={16}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          aria-invalid={errorMessage ? true : undefined}
          aria-describedby={errorMessage ? errorMessageId : undefined}
          className="text-xl tracking-[6px]"
        />
        {errorMessage && (
          <p
            id={errorMessageId}
            role="alert"
            className="mt-2 flex items-center gap-1.5 text-[13px] leading-5 text-danger"
          >
            <CircleAlertIcon className="size-4 shrink-0" aria-hidden="true" />
            {errorMessage}
          </p>
        )}
        <Button type="submit" size="lg" loading={joinMutation.isPending} className="mt-4">
          입장하기
        </Button>

        <div className="mt-7 flex items-center gap-3 rounded-md bg-muted p-4 lg:hidden">
          <QrCodeIcon className="size-7 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="text-small text-muted-foreground">
            단톡방 QR로 들어오면 코드가 자동으로 입력돼요.
          </span>
        </div>
      </form>

      {/* 휴대폰: 관리자 페이지 링크를 화면 맨 아래에 둔다(PC는 머리글 오른쪽에 있음) */}
      <div className="flex-1 lg:hidden" />
      <div className="mt-8 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-small lg:hidden">
        <span className="text-muted-foreground">행사를 만드는 학생회인가요?</span>
        <Link
          to={paths.administratorLogin()}
          className="flex min-h-11 items-center font-semibold text-primary"
        >
          관리자 페이지
        </Link>
      </div>
    </div>
  )
}
