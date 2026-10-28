import { ClockIcon } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { AppLogo } from '@/shared/ui/app-logo'
import { Button } from '@/shared/ui/button'

// ⑧ 입장 시간 만료: 참가자 요청이 401을 받으면 이 화면으로 온다.
// 결정: 기억해 둔 인증코드(?code=)가 있으면 [다시 입장하기]가 코드 입력 없이 바로 재입장한다
export default function SessionExpiredPage() {
  const [searchParams] = useSearchParams()
  const accessCode = searchParams.get('code')

  return (
    <div className="flex flex-1 flex-col px-6 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+32px)] lg:mx-auto lg:w-full lg:max-w-[440px] lg:py-20">
      {/* PC에서는 위쪽 머리글에 로고가 있으므로 휴대폰에서만 보여 준다 */}
      <AppLogo size="medium" className="lg:hidden" />
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div className="flex size-18 items-center justify-center rounded-full bg-warning-soft">
          <ClockIcon className="size-8 text-warning" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-1">입장 시간이 지났어요</h1>
          <p className="text-body text-muted-foreground">
            {accessCode
              ? '입장하고 시간이 오래 지나면 다시 들어와야 해요. 버튼을 누르면 바로 다시 입장해요.'
              : '입장하고 시간이 오래 지나면 다시 들어와야 해요. 인증코드로 다시 입장해주세요.'}
          </p>
        </div>
      </div>
      <Button asChild size="lg">
        <Link to={accessCode ? paths.eventJoin(accessCode) : paths.entry} replace>
          다시 입장하기
        </Link>
      </Button>
    </div>
  )
}
