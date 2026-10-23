import { useParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { PagePlaceholder } from '@/pages/page-placeholder'

// 고른 사람들의 사진을 합쳐 보고 저장하는 화면. 6단계에서 실제 화면으로 바꾼다
export default function MyPhotosPage() {
  const { code = '' } = useParams()
  return (
    <PagePlaceholder
      screenName="⑤ 내 사진"
      plannedStep={6}
      links={[{ label: '② 사람별 사진', to: paths.eventHome(code) }]}
    />
  )
}
