import { useParams, useSearchParams } from 'react-router'
import { PagePlaceholder } from '@/pages/page-placeholder'

// ①-0 QR로 입장 중: 주소의 인증코드로 자동 입장한 뒤 next(없으면 ② 사람별 사진)로 이동한다.
// 가드가 입장 정보 없이 들어온 참가자를 이 화면으로 보낸다. 4단계에서 실제 입장 처리를 만든다
export default function QrJoinPage() {
  const { code = '' } = useParams()
  const [searchParams] = useSearchParams()
  return (
    <PagePlaceholder screenName="①-0 QR로 입장 중" plannedStep={4}>
      <p className="text-body text-muted-foreground">
        인증코드 <code className="text-foreground">{code}</code>로 입장한 뒤{' '}
        <code className="text-foreground">{searchParams.get('next') ?? '② 사람별 사진'}</code>
        (으)로 돌아가요.
      </p>
    </PagePlaceholder>
  )
}
