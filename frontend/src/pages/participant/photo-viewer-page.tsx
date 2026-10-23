import { XIcon } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'

// ⑥ 사진 크게 보기: 참가자 레이아웃 밖의 어두운 전체 화면. 6단계에서 넘기기·확대·저장을 만든다
export default function PhotoViewerPage() {
  const { code = '', photoId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // 목록에서 열었으면 이전 화면으로, 링크로 바로 들어왔으면(이전 기록 없음) 사람별 사진으로 간다
  function closeViewer() {
    if (location.key === 'default') void navigate(paths.eventHome(code), { replace: true })
    else void navigate(-1)
  }
  return (
    <div className="flex min-h-dvh flex-col bg-dark-bg text-dark-foreground">
      <div className="flex items-center px-3 pt-[calc(env(safe-area-inset-top)+12px)]">
        {/* 크게 보기는 목록 위에 겹쳐 보는 화면이라 '닫기'는 이전 화면으로 돌아간다 */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="닫기"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={closeViewer}
        >
          <XIcon className="size-6" />
        </Button>
      </div>
      <section className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-caption text-white/70">6단계에서 만들 화면</p>
        <h1 className="text-title-1">⑥ 크게 보기</h1>
        <p className="text-small text-white/70">사진 번호 {photoId}</p>
      </section>
    </div>
  )
}
