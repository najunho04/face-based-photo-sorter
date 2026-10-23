import type { BadgeVariantProps } from '@/shared/ui/badge-variants'

/** 행사 상태 (docs/api.md, docs/erd.md의 events.status) */
export type EventStatus = 'uploading' | 'extracting' | 'clustering' | 'open'

// 상태마다 화면에 보여 줄 이름과 배지 색. 공개 중만 성공(초록), 나머지 진행 단계는 정보(인디고)
export const eventStatusDisplay: Record<
  EventStatus,
  { label: string; tone: NonNullable<BadgeVariantProps['tone']> }
> = {
  uploading: { label: '업로드 중', tone: 'info' },
  extracting: { label: '얼굴 찾는 중', tone: 'info' },
  clustering: { label: '사람별로 묶는 중', tone: 'info' },
  open: { label: '공개 중', tone: 'success' },
}
