import { CameraOffIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  createKakaoTalkExternalBrowserUrl,
  detectInAppBrowser,
  inAppBrowserNames,
} from '@/features/camera/in-app-browser'
import type { CameraStatus } from '@/features/camera/use-camera'
import { Button } from '@/shared/ui/button'

// 카메라를 쓸 수 없는 상태별 안내 문구(명세서 10장: 무슨 일 + 무엇을 하면 되는지)
const unavailableMessages: Partial<Record<CameraStatus, { title: string; description: string }>> = {
  denied: {
    title: '카메라를 쓸 수 없어요',
    description:
      '카메라 권한을 허용한 뒤 다시 시도해주세요. 주소창의 자물쇠(또는 aA) 버튼이나 휴대폰 설정에서 바꿀 수 있어요.',
  },
  unavailable: {
    title: '카메라를 찾지 못했어요',
    description: '카메라가 없는 기기예요. 갤러리에서 셀카를 골라주세요.',
  },
  busy: {
    title: '다른 앱이 카메라를 쓰고 있어요',
    description: '영상 통화나 카메라 앱을 닫고 다시 시도해주세요.',
  },
  unsupported: {
    title: '이 브라우저에서는 카메라를 켤 수 없어요',
    description: '크롬이나 사파리에서 열거나, 갤러리에서 셀카를 골라주세요.',
  },
  error: {
    title: '카메라를 켜지 못했어요',
    description: '잠시 후 다시 시도하거나, 갤러리에서 셀카를 골라주세요.',
  },
}

type CameraUnavailableNoticeProps = {
  status: CameraStatus
  onRetry: () => void
  /** 갤러리에서 고르기 버튼(PhotoPicker) */
  photoPicker: ReactNode
}

// 카메라를 쓸 수 없을 때 미리보기 자리에 보여 주는 안내. 앱 안 브라우저(카카오톡 등)면 다른 브라우저로 여는 방법을 더한다
export function CameraUnavailableNotice({
  status,
  onRetry,
  photoPicker,
}: CameraUnavailableNoticeProps) {
  const message = unavailableMessages[status]
  const inAppBrowser = detectInAppBrowser(navigator.userAgent)
  if (!message) return null
  const canRetry = status === 'denied' || status === 'busy' || status === 'error'

  return (
    <div
      role="alert"
      className="flex max-w-[320px] flex-col items-center gap-4 text-center text-white"
    >
      <CameraOffIcon className="size-10 text-dark-foreground-secondary" aria-hidden="true" />
      <div className="flex flex-col gap-1.5">
        <p className="text-headline">{message.title}</p>
        <p className="text-small text-dark-foreground-secondary">{message.description}</p>
        {inAppBrowser && (
          <p className="text-small text-dark-foreground-secondary">
            {inAppBrowserNames[inAppBrowser]} 안에서는 카메라가 막힐 수 있어요.{' '}
            {inAppBrowser === 'kakaotalk'
              ? '아래 버튼으로 휴대폰 기본 브라우저에서 열어주세요.'
              : "오른쪽 위 메뉴(⋯)에서 '다른 브라우저로 열기'를 눌러주세요."}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {inAppBrowser === 'kakaotalk' && (
          <Button asChild size="sm">
            <a href={createKakaoTalkExternalBrowserUrl(window.location.href)}>
              기본 브라우저로 열기
            </a>
          </Button>
        )}
        {photoPicker}
        {canRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="text-white hover:bg-white/10 hover:text-white"
          >
            다시 시도
          </Button>
        )}
      </div>
    </div>
  )
}
