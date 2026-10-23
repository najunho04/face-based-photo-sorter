import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'
import { PagePlaceholder } from '@/pages/page-placeholder'
import { paths } from '@/shared/config/paths'

// 행사 이름을 정하고 인증코드·QR을 받는 화면. 7단계에서 실제 화면으로 바꾼다(관리자 화면은 따로 불러와 참가자 첫 화면을 가볍게 유지)
export default function EventCreatePage() {
  return (
    <>
      <AdministratorMobileHeader title="새 행사 만들기" backTo={paths.administratorEvents} />
      <PagePlaceholder screenName="A3 새 행사 만들기" plannedStep={7} />
    </>
  )
}
