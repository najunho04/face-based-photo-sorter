import { SearchXIcon } from 'lucide-react'
import { Link } from 'react-router'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'

// 없는 주소로 들어왔을 때. 처음 화면(입장)으로 돌아가는 행동 하나만 둔다
export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <EmptyState
        icon={SearchXIcon}
        title="페이지를 찾을 수 없어요"
        description="주소를 다시 확인하거나 처음 화면에서 시작해주세요."
        action={
          <Button asChild>
            <Link to={paths.entry}>처음 화면으로</Link>
          </Button>
        }
      />
    </div>
  )
}
