import { Link, useSearchParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { AppLogo } from '@/shared/ui/app-logo'
import { Card } from '@/shared/ui/card'

// A1 관리자 로그인: 관리자 레이아웃 밖, 회색 바탕 가운데 카드(시안 A1). 7단계에서 실제 로그인 폼을 만든다
export default function AdministratorLoginPage() {
  const [searchParams] = useSearchParams()
  const nextPath = searchParams.get('next')
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted px-4 py-10">
      <Card className="flex w-full max-w-[400px] flex-col gap-4 p-9">
        <AppLogo size="large" showAdministratorBadge />
        <h1 className="mt-2 text-title-2">관리자 로그인</h1>
        <p className="text-caption text-muted-foreground">7단계에서 만들 화면</p>
        {nextPath && (
          <p className="text-small text-muted-foreground">
            로그인하면 <code className="text-foreground">{nextPath}</code>(으)로 돌아가요.
          </p>
        )}
        <Link
          to={paths.entry}
          className="text-center text-small text-muted-foreground underline underline-offset-4"
        >
          참가자는 인증코드로 입장해요
        </Link>
      </Card>
    </div>
  )
}
