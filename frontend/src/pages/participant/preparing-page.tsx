import { PagePlaceholder } from '@/pages/page-placeholder'

// 공개 전 행사에 입장했을 때 기다리는 화면. 4단계에서 실제 화면으로 바꾼다
export default function PreparingPage() {
  return <PagePlaceholder screenName="①-1 사진 정리 중" plannedStep={4} />
}
