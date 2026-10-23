import { useParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { PagePlaceholder } from '@/pages/page-placeholder'

// 공개된 행사의 첫 화면(사람별 폴더 격자). 4단계에서 실제 화면으로 바꾼다
export default function HomePage() {
  const { code = '' } = useParams()
  return (
    <PagePlaceholder
      screenName="② 사람별 사진"
      plannedStep={4}
      links={[
        { label: '⑦ 전체 사진', to: paths.eventAllPhotos(code) },
        { label: '③ 셀카 촬영', to: paths.eventCamera(code) },
        { label: '④ 후보 선택', to: paths.eventCandidates(code) },
        { label: '⑤ 내 사진 (예: 사람 2명 합치기)', to: paths.eventPhotos(code, [3, 12]) },
        { label: '⑥ 크게 보기 (예: 사진 1장)', to: paths.eventPhoto(code, 7) },
      ]}
    />
  )
}
