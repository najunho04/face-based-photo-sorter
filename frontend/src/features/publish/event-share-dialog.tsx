import QRCode from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'

type EventShareDialogProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  accessCode: string
  /** 창 제목. 행사를 막 만들었으면 '행사를 만들었어요' */
  title?: string
  /** 아래쪽 주 버튼(시안 A3의 '사진 올리러 가기') */
  primaryAction?: ReactNode
}

/** 참가자가 QR을 찍으면 열리는 입장 주소 */
function createEventJoinUrl(accessCode: string): string {
  return `${window.location.origin}${paths.eventJoin(accessCode)}`
}

// 인증코드·QR 창(시안 A3): 코드, QR, 입장 주소, [링크 복사], [QR 이미지 저장]
export function EventShareDialog({
  isOpen,
  onOpenChange,
  accessCode,
  title = '인증코드·QR',
  primaryAction,
}: EventShareDialogProps) {
  const joinUrl = createEventJoinUrl(accessCode)
  const qrImage = useQrImage(joinUrl)

  async function copyJoinUrl() {
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.success('링크를 복사했어요')
    } catch {
      toast.error('복사하지 못했어요. 주소를 길게 눌러 복사해주세요.')
    }
  }

  // 단톡방·현수막에 쓸 수 있게 QR을 PNG 파일로 내려받는다
  function saveQrImage() {
    if (!qrImage) return
    const link = document.createElement('a')
    link.href = qrImage
    link.download = `인생내컷-QR-${accessCode}.png`
    link.click()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="items-center text-center">
        <DialogHeader className="items-center text-center">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            참가자에게 아래 코드나 QR을 공유하세요.
            <br />
            사진 정리가 끝나면 자동으로 공개돼요.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <span className="text-[32px] leading-10 font-bold tracking-[8px]">{accessCode}</span>
          {qrImage ? (
            <img src={qrImage} alt="참가자 입장 QR 코드" className="size-40" />
          ) : (
            <div className="size-40 bg-placeholder" aria-hidden="true" />
          )}
          <span className="text-[13px] break-all text-muted-foreground">{joinUrl}</span>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="h-10"
              onClick={() => void copyJoinUrl()}
            >
              링크 복사
            </Button>
            <Button variant="secondary" size="sm" className="h-10" onClick={saveQrImage}>
              QR 이미지 저장
            </Button>
          </div>
        </div>
        {primaryAction && <div className="flex w-full flex-col">{primaryAction}</div>}
      </DialogContent>
    </Dialog>
  )
}

// 주소를 QR 그림(PNG 데이터 주소)으로 만든다. 저장할 때도 같은 그림을 쓴다
function useQrImage(url: string): string | null {
  const [qrImage, setQrImage] = useState<{ url: string; image: string } | null>(null)
  useEffect(() => {
    let isCancelled = false
    void QRCode.toDataURL(url, { margin: 2, width: 480, color: { dark: '#1E1B4B' } }).then(
      (image) => {
        if (!isCancelled) setQrImage({ url, image })
      },
    )
    return () => {
      isCancelled = true
    }
  }, [url])
  return qrImage && qrImage.url === url ? qrImage.image : null
}
