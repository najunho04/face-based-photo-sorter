import { useId, useState } from 'react'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { consentNotices, consentRememberNotice } from '@/features/selfie-search/consent-texts'

// ②-1 동의 내용(휴대폰 시트). 체크박스는 해제 상태로 시작하고, 체크하지 않고 누르면 이유를 알려 준다(결정 기록 5단계)
export function ConsentPanel({ onAgree, onClose }: { onAgree: () => void; onClose: () => void }) {
  const [isChecked, setIsChecked] = useState(false)
  const [showRequiredMessage, setShowRequiredMessage] = useState(false)
  const requiredMessageId = useId()

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4">
        {consentNotices.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-[15px] leading-6">
            <Icon className="size-5.5 shrink-0 text-primary" aria-hidden="true" />
            {text}
          </li>
        ))}
      </ul>
      <ConsentCheckbox
        isChecked={isChecked}
        onCheckedChange={(checked) => {
          setIsChecked(checked)
          if (checked) setShowRequiredMessage(false)
        }}
        describedBy={showRequiredMessage ? requiredMessageId : undefined}
      />
      <p className="-mt-3 text-caption text-muted-foreground">{consentRememberNotice}</p>
      {showRequiredMessage && (
        <p id={requiredMessageId} role="alert" className="-mt-2 text-small text-danger">
          얼굴 정보 처리에 동의해야 셀카로 찾을 수 있어요.
        </p>
      )}
      <Button
        size="lg"
        onClick={() => {
          if (isChecked) onAgree()
          else setShowRequiredMessage(true)
        }}
      >
        동의하고 촬영하기
      </Button>
      <Button variant="ghost" className="-mt-2 text-[15px]" onClick={onClose}>
        닫기
      </Button>
    </div>
  )
}

// 동의 체크박스 한 줄(휴대폰 시트와 PC 옆 칸이 같이 쓴다)
export function ConsentCheckbox({
  isChecked,
  onCheckedChange,
  describedBy,
}: {
  isChecked: boolean
  onCheckedChange: (checked: boolean) => void
  describedBy?: string
}) {
  const checkboxId = useId()
  return (
    <label
      htmlFor={checkboxId}
      className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md bg-muted px-4 py-3 text-small font-medium"
    >
      <Checkbox
        id={checkboxId}
        checked={isChecked}
        onCheckedChange={(checked) => onCheckedChange(checked === true)}
        aria-describedby={describedBy}
      />
      얼굴 정보 처리에 동의합니다 (필수)
    </label>
  )
}
