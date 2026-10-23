import { paths } from '@/shared/config/paths'
import { PagePlaceholder } from '@/pages/page-placeholder'

// 인증코드를 입력해 행사에 들어가는 첫 화면. 4단계에서 실제 화면으로 바꾼다
export default function EntryPage() {
  return (
    <PagePlaceholder
      screenName="① 입장"
      plannedStep={4}
      links={[{ label: '관리자 페이지', to: paths.administratorLogin() }]}
    />
  )
}
