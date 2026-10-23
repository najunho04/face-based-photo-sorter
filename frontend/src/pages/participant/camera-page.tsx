import { useParams } from 'react-router'
import { paths } from '@/shared/config/paths'
import { PagePlaceholder } from '@/pages/page-placeholder'

// 동의 후 셀카를 찍어 검색하는 화면(카메라 코드가 커서 따로 불러옴). 5단계에서 실제 화면으로 바꾼다
export default function CameraPage() {
  const { code = '' } = useParams()
  return (
    <PagePlaceholder
      screenName="②-1 동의 · ③ 셀카 촬영"
      plannedStep={5}
      links={[{ label: '② 사람별 사진', to: paths.eventHome(code) }]}
    />
  )
}
