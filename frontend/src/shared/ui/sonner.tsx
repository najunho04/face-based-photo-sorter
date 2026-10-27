import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

// 라이트 모드만 쓰므로 next-themes 없이 고정. 명세서 결정: 어두운 남색 토스트, 화면 아래 가운데, 4초 뒤 사라짐.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      duration={4000}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-[18px]" />,
        info: <InfoIcon className="size-[18px]" />,
        warning: <TriangleAlertIcon className="size-[18px]" />,
        error: <CircleAlertIcon className="size-[18px]" />,
        loading: <LoaderCircleIcon className="size-[18px] animate-spin" />,
      }}
      style={
        {
          '--normal-bg': 'var(--foreground)',
          '--normal-text': 'var(--background)',
          '--normal-border': 'var(--foreground)',
          '--border-radius': 'var(--radius)',
          '--offset-bottom': 'calc(24px + env(safe-area-inset-bottom))',
          '--mobile-offset-bottom': 'calc(16px + env(safe-area-inset-bottom))',
        } as CSSProperties
      }
      toastOptions={{ classNames: { toast: 'font-sans text-small font-medium shadow-md' } }}
      {...props}
    />
  )
}

export { Toaster }
