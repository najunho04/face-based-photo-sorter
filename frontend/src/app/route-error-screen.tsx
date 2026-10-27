import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import NotFoundPage from '@/pages/not-found-page'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'
import { ErrorState } from '@/shared/ui/error-state'

// 배포 뒤 예전 화면 파일을 찾지 못할 때 브라우저마다 다른 오류 문구(Chrome·Safari·Firefox)
const chunkLoadErrorPattern =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i

// 화면을 그리다 오류가 나면 레이아웃은 그대로 두고 이 화면을 대신 보여 준다(라우트별 오류 경계)
export function RouteErrorScreen() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />

  // 새 버전 배포로 예전 파일이 사라진 경우: 새로고침하면 새 파일을 받아 해결된다
  const isOutdatedVersion = error instanceof Error && chunkLoadErrorPattern.test(error.message)
  if (import.meta.env.DEV) console.error(error)

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10">
      <ErrorState
        title={isOutdatedVersion ? '새 버전이 나왔어요' : '화면을 불러오지 못했어요'}
        description={
          isOutdatedVersion
            ? '새로고침하면 바로 이어서 볼 수 있어요.'
            : '잠시 후 다시 시도해주세요. 계속 안 되면 처음 화면에서 시작해주세요.'
        }
        retryLabel={isOutdatedVersion ? '새로고침' : '다시 시도'}
        onRetry={() => window.location.reload()}
      />
      <Button asChild variant="ghost">
        <Link to={paths.entry}>처음 화면으로</Link>
      </Button>
    </div>
  )
}
