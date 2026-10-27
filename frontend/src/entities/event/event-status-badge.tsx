import { Badge } from '@/shared/ui/badge'
import { eventStatusDisplay, type EventStatus } from '@/entities/event/event-status'

// 행사 상태 배지. 색만으로 구분하지 않도록 항상 상태 이름을 글자로 함께 보여 준다
export function EventStatusBadge({ status }: { status: EventStatus }) {
  const display = eventStatusDisplay[status]
  return <Badge tone={display.tone}>{display.label}</Badge>
}
