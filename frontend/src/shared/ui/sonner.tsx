import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import type { CSSProperties } from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { toastClearanceVariableName } from '@/shared/lib/toast-clearance'

// 아래 여백: 아이폰 홈 막대 영역 + 아래 고정 막대 높이(useToastClearance가 적음) + 기본 간격.
// sonner는 style로 넘긴 --offset-* 변수를 자기 기본값으로 덮어쓰므로 offset·mobileOffset prop으로 넘겨야 한다
const toastBottomOffset = (basePixels: number) =>
  `calc(${basePixels}px + env(safe-area-inset-bottom) + var(${toastClearanceVariableName}, 0px))`

// 라이트 모드만 쓰므로 next-themes 없이 고정. 명세서 결정: 어두운 남색 토스트, 화면 아래 가운데, 4초 뒤 사라짐.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      duration={4000}
      offset={{ bottom: toastBottomOffset(24) }}
      mobileOffset={{ bottom: toastBottomOffset(16) }}
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
        } as CSSProperties
      }
      // sonner의 기본 CSS(13px, 자체 그림자)는 레이어 밖이라 Tailwind 클래스보다 우선한다 → 크기·그림자는 !로 덮는다
      toastOptions={{ classNames: { toast: 'font-sans text-small! font-medium shadow-md!' } }}
      {...props}
    />
  )
}

export { Toaster }
