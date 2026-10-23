import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'
import { PagePlaceholder } from '@/pages/page-placeholder'
import { paths } from '@/shared/config/paths'

// 사진을 골라 올리고 업로드를 완료하는 화면. 7단계에서 실제 화면으로 바꾼다(관리자 화면은 따로 불러와 참가자 첫 화면을 가볍게 유지)
export default function EventUploadPage() {
  return (
    <>
      <AdministratorMobileHeader title="사진 올리기" backTo={paths.administratorEvents} />
      <PagePlaceholder screenName="A4 사진 올리기" plannedStep={7} />
    </>
  )
}
