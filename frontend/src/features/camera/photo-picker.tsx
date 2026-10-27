import { ImageIcon } from 'lucide-react'
import { useId, type ChangeEvent } from 'react'
import { cn } from '@/shared/lib/utils'
import { buttonVariants, type ButtonVariantProps } from '@/shared/ui/button-variants'

type PhotoPickerProps = {
  /** 고른 사진 파일을 넘긴다 */
  onPick: (file: File) => void
  label?: string
  variant?: ButtonVariantProps['variant']
  size?: ButtonVariantProps['size']
  className?: string
}

// 카메라 대신 '갤러리에서 고르기'(결정: 항상 작은 링크, 카메라가 안 되면 크게).
// capture 속성을 두지 않아 휴대폰에서 '사진 보관함/사진 찍기'를 고를 수 있게 한다
export function PhotoPicker({
  onPick,
  label = '갤러리에서 고르기',
  variant = 'link',
  size = 'sm',
  className,
}: PhotoPickerProps) {
  const inputId = useId()

  function handleChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const file = changeEvent.target.files?.[0]
    // 같은 파일을 다시 골라도 바뀐 것으로 알도록 값을 비운다
    changeEvent.target.value = ''
    if (file) onPick(file)
  }

  return (
    <label
      htmlFor={inputId}
      className={cn(buttonVariants({ variant, size }), 'cursor-pointer', className)}
    >
      <ImageIcon aria-hidden="true" />
      {label}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleChange}
      />
    </label>
  )
}
