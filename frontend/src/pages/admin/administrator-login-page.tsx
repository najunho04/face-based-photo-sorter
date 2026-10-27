import { useMutation } from '@tanstack/react-query'
import { CircleAlertIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { loginAdministrator } from '@/entities/session/session-api'
import { isApiErrorWithCode } from '@/shared/api/api-error'
import { getErrorMessage } from '@/shared/api/error-messages'
import { saveAdministratorSession } from '@/shared/api/token-storage'
import { paths } from '@/shared/config/paths'
import { getSafeNextPath } from '@/shared/lib/safe-next-path'
import { AppLogo } from '@/shared/ui/app-logo'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

// A1 관리자 로그인 · A1-1 실패: 회색 바탕 가운데 카드. 로그인하면 돌아갈 주소(next) 또는 A2 최근 행사로 간다
export default function AdministratorLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const loginMutation = useMutation({ mutationFn: loginAdministrator })
  const loginIdInputId = useId()
  const passwordInputId = useId()

  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    const trimmedLoginId = loginId.trim()
    if (!trimmedLoginId || !password) {
      setErrorMessage('아이디와 비밀번호를 입력해주세요.')
      return
    }
    setErrorMessage('')
    try {
      const login = await loginMutation.mutateAsync({ loginId: trimmedLoginId, password })
      saveAdministratorSession({
        accessToken: login.accessToken,
        expiresInSeconds: login.expiresIn,
        loginId: trimmedLoginId,
      })
      void navigate(getSafeNextPath(searchParams.get('next'), paths.administratorEvents), {
        replace: true,
      })
    } catch (error) {
      // 시안 A1-1 문구. 비밀번호는 지우고 아이디는 남겨 다시 입력하기 쉽게 한다
      setErrorMessage(
        isApiErrorWithCode(error, 'LOGIN_FAILED')
          ? '아이디 또는 비밀번호가 맞지 않아요.'
          : getErrorMessage(error),
      )
      setPassword('')
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
      <Card className="w-full max-w-[400px] p-9">
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <AppLogo size="large" showAdministratorBadge />
          <h1 className="mt-2 text-title-2">관리자 로그인</h1>
          {errorMessage && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-md bg-danger-soft px-3.5 py-3 text-small text-danger"
            >
              <CircleAlertIcon className="size-4.5 shrink-0" aria-hidden="true" />
              {errorMessage}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={loginIdInputId}>아이디</Label>
            <Input
              id={loginIdInputId}
              name="loginId"
              autoComplete="username"
              autoCapitalize="off"
              value={loginId}
              onChange={(changeEvent) => setLoginId(changeEvent.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={passwordInputId}>비밀번호</Label>
            <Input
              id={passwordInputId}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(changeEvent) => setPassword(changeEvent.target.value)}
            />
          </div>
          <Button type="submit" className="mt-2" loading={loginMutation.isPending}>
            로그인
          </Button>
          <p className="text-center text-[13px] text-muted-foreground">
            {searchParams.get('next')
              ? '로그인 시간이 지나서 들어온 경우에도 이 화면에서 다시 로그인해요.'
              : '참가자는 인증코드로 입장해요.'}
          </p>
          <Link
            to={paths.entry}
            className="self-center text-[13px] text-muted-foreground underline underline-offset-4"
          >
            참가자 입장 화면으로
          </Link>
        </form>
      </Card>
    </div>
  )
}
