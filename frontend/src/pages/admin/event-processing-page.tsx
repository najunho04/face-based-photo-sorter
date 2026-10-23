import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'
import { PagePlaceholder } from '@/pages/page-placeholder'
import { paths } from '@/shared/config/paths'

// 얼굴 찾기·묶기 진행 상황을 보는 화면. 7단계에서 실제 화면으로 바꾼다(관리자 화면은 따로 불러와 참가자 첫 화면을 가볍게 유지)
export default function EventProcessingPage() {
  return (
    <>
      <AdministratorMobileHeader title="사진 정리 중" backTo={paths.administratorEvents} />
      <PagePlaceholder screenName="A5 사진 정리 중" plannedStep={7} />
    </>
  )
}
