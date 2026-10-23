import { useParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { PagePlaceholder } from '@/pages/page-placeholder'

// 셀카 검색 결과 후보를 여러 명 고르는 화면. 5단계에서 실제 화면으로 바꾼다
export default function CandidatesPage() {
  const { code = '' } = useParams()
  return (
    <PagePlaceholder
      screenName="④ 후보 선택"
      plannedStep={5}
      links={[{ label: '② 사람별 사진', to: paths.eventHome(code) }]}
    />
  )
}
