import { useParams } from 'react-router'
import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'
import { PagePlaceholder } from '@/pages/page-placeholder'
import { paths } from '@/shared/config/paths'

// 사람별로 묶인 결과를 확인하는 화면. 7단계에서 실제 화면으로 바꾼다(관리자 화면은 따로 불러와 참가자 첫 화면을 가볍게 유지)
export default function EventResultPage() {
  const eventId = Number(useParams().eventId)
  return (
    <>
      <AdministratorMobileHeader title="분류 결과" backTo={paths.administratorEvents} />
      <PagePlaceholder
        screenName="A6 분류 결과"
        plannedStep={7}
        links={[
          {
            label: 'A7 사람 폴더 사진 (예: 사람 1)',
            to: paths.administratorPersonPhotos(eventId, 1),
          },
        ]}
      />
    </>
  )
}
