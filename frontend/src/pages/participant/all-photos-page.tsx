import { useParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { PagePlaceholder } from '@/pages/page-placeholder'

// 행사 사진 전체를 페이지 단위로 넘겨 보는 화면. 4단계에서 실제 화면으로 바꾼다
export default function AllPhotosPage() {
  const { code = '' } = useParams()
  return (
    <PagePlaceholder
      screenName="⑦ 전체 사진"
      plannedStep={4}
      links={[{ label: '② 사람별 사진', to: paths.eventHome(code) }]}
    />
  )
}
