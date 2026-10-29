import { Link, Outlet, useParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { readParticipantSession } from '@/shared/api/token-storage'
import { AppLogo } from '@/shared/ui/app-logo'

// 참가자 화면 틀 (명세서 7장)
// - 휴대폰(768px 미만): 공통 머리글 없음. 화면마다 위쪽(로고·뒤로·닫기)을 직접 그린다
// - 태블릿(768~1023px): 휴대폰 배치를 가운데 560px로
// - PC(1024px 이상): 로고 + 행사 이름 + 오른쪽 링크가 있는 머리글, 내용 최대 1120px
export function ParticipantLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <ParticipantDesktopHeader />
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col lg:max-w-content">
        <Outlet />
      </main>
    </div>
  )
}

// PC 머리글(시안 P1·P2). 행사 안에서는 행사 이름과 '전체 사진 보기', 입장 화면에서는 '관리자 페이지'를 보여 준다
function ParticipantDesktopHeader() {
  const { code } = useParams()
  const session = readParticipantSession()
  const currentEventSession = code && session?.accessCode === code ? session : null

  return (
    // 오른쪽 링크는 머리글 높이를 키우지 않고 눌리는 영역만 44px(시안 P1~P5 머리글 위아래 18px)
    <header className="hidden border-b border-border lg:block">
      <div className="mx-auto flex max-w-content items-center justify-between gap-3 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={
              currentEventSession?.isEventOpen
                ? paths.eventHome(currentEventSession.accessCode)
                : paths.entry
            }
            aria-label="인생내컷 처음 화면"
            className="rounded-sm"
          >
            <AppLogo size="large" />
          </Link>
          {currentEventSession && (
            <span className="truncate text-small text-muted-foreground">
              {currentEventSession.eventName}
            </span>
          )}
        </div>
        {currentEventSession ? (
          currentEventSession.isEventOpen && (
            <Link
              to={paths.eventAllPhotos(currentEventSession.accessCode)}
              className="touch-target flex items-center text-small font-semibold text-primary"
            >
              전체 사진 보기
            </Link>
          )
        ) : (
          <Link
            to={paths.administratorLogin()}
            className="touch-target flex items-center text-small font-semibold text-muted-foreground"
          >
            관리자 페이지
          </Link>
        )}
      </div>
    </header>
  )
}
