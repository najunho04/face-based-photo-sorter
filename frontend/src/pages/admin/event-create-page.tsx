import { useMutation } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { createEvent } from '@/entities/event/event-api'
import type { CreatedEvent } from '@/entities/event/event-types'
import { addRecentEvent } from '@/entities/event/recent-event-storage'
import { EventShareDialog } from '@/features/publish/event-share-dialog'
import {
  AdministratorPageBody,
  AdministratorPageHeader,
} from '@/pages/admin/administrator-page-header'
import { getErrorMessage } from '@/shared/api/error-messages'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'

/** 행사 이름 최대 길이(가짜 API·서버 검사와 같게) */
const maximumEventNameLength = 50

// A3 새 행사 만들기: 이름을 정하면 인증코드가 나오고, 코드·QR 창에서 공유한 뒤 사진을 올리러 간다
export default function EventCreatePage() {
  const navigate = useNavigate()
  const [eventName, setEventName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null)
  const createMutation = useMutation({ mutationFn: createEvent })
  const nameInputId = useId()
  const hintId = useId()

  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault()
    const trimmedName = eventName.trim()
    if (!trimmedName) {
      setErrorMessage('행사 이름을 입력해주세요.')
      return
    }
    setErrorMessage('')
    try {
      const event = await createMutation.mutateAsync(trimmedName)
      // 관리자 행사 목록 API가 없어서 이 브라우저의 최근 행사에 남긴다
      addRecentEvent(event.eventId)
      setCreatedEvent(event)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    }
  }

  return (
    <>
      <AdministratorPageHeader
        title="새 행사 만들기"
        breadcrumbs={[{ label: '최근 행사', to: paths.administratorEvents }, { label: '새 행사' }]}
        backTo={paths.administratorEvents}
      />
      <AdministratorPageBody>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex max-w-[520px] flex-col gap-2 rounded-lg border border-border bg-background p-5 lg:p-7"
        >
          <Label htmlFor={nameInputId}>행사 이름</Label>
          <Input
            id={nameInputId}
            value={eventName}
            maxLength={maximumEventNameLength}
            placeholder="예: 2026 가을 축제"
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={hintId}
            onChange={(changeEvent) => {
              setEventName(changeEvent.target.value)
              setErrorMessage('')
            }}
          />
          <span id={hintId} className="text-[13px] text-muted-foreground">
            {errorMessage ? (
              <span role="alert" className="text-danger">
                {errorMessage}
              </span>
            ) : (
              '참가자 화면 맨 위에 보이는 이름이에요.'
            )}
          </span>
          <Button type="submit" className="mt-3 self-start" loading={createMutation.isPending}>
            행사 만들기
          </Button>
        </form>
      </AdministratorPageBody>

      {createdEvent && (
        <EventShareDialog
          isOpen
          // 창을 닫으면 다음 단계(사진 올리기)로 간다. 코드·QR은 업로드 화면에서도 다시 볼 수 있다
          onOpenChange={() => void navigate(paths.administratorEventUpload(createdEvent.eventId))}
          title="행사를 만들었어요"
          accessCode={createdEvent.accessCode}
          primaryAction={
            <Button asChild>
              <Link to={paths.administratorEventUpload(createdEvent.eventId)}>
                사진 올리러 가기
              </Link>
            </Button>
          }
        />
      )}
    </>
  )
}
