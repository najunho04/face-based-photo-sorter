import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'
import { PagePlaceholder } from '@/pages/page-placeholder'
import { paths } from '@/shared/config/paths'

// 이 브라우저에서 만든 행사 목록. 7단계에서 실제 화면으로 바꾼다(관리자 화면은 따로 불러와 참가자 첫 화면을 가볍게 유지)
export default function EventsPage() {
  return (
    <>
      <AdministratorMobileHeader title="최근 행사" />
      <PagePlaceholder
        screenName="A2 최근 행사"
        plannedStep={7}
        links={[
          { label: 'A3 새 행사 만들기', to: paths.administratorEventCreate },
          { label: 'A4 사진 올리기 (예: 행사 4)', to: paths.administratorEventUpload(4) },
          { label: 'A5 사진 정리 중 (예: 행사 3)', to: paths.administratorEventProcessing(3) },
          { label: 'A6 분류 결과 (예: 행사 1)', to: paths.administratorEventResult(1) },
        ]}
      />
    </>
  )
}
