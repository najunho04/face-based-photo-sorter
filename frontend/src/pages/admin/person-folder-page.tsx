import { useParams } from 'react-router'
import { AdministratorMobileHeader } from '@/pages/admin/administrator-navigation'
import { PagePlaceholder } from '@/pages/page-placeholder'
import { paths } from '@/shared/config/paths'

// 한 사람이 나온 사진을 모아 보는 화면. 7단계에서 실제 화면으로 바꾼다(관리자 화면은 따로 불러와 참가자 첫 화면을 가볍게 유지)
export default function PersonFolderPage() {
  const eventId = Number(useParams().eventId)
  return (
    <>
      <AdministratorMobileHeader
        title="사람 폴더 사진"
        backTo={paths.administratorEventResult(eventId)}
      />
      <PagePlaceholder screenName="A7 사람 폴더 사진" plannedStep={7} />
    </>
  )
}
