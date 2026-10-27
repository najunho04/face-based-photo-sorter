import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

type ContinueOnPhoneQrProps = {
  /** 휴대폰에서 열 주소(같은 행사로 자동 입장한 뒤 카메라 화면) */
  targetUrl: string
}

// P3 '웹캠이 없나요?': 휴대폰으로 QR을 찍으면 같은 행사에 자동 입장하고 카메라 화면이 열린다
export function ContinueOnPhoneQr({ targetUrl }: ContinueOnPhoneQrProps) {
  const [qrSvg, setQrSvg] = useState<{ url: string; svg: string } | null>(null)

  useEffect(() => {
    let isCancelled = false
    // QR 그림은 SVG 글자로 만들어 선명하게 보여 준다(여백은 카드 안쪽 여백으로 대신)
    void QRCode.toString(targetUrl, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(
      (svg) => {
        if (!isCancelled) setQrSvg({ url: targetUrl, svg })
      },
    )
    return () => {
      isCancelled = true
    }
  }, [targetUrl])

  return (
    <div className="flex items-center gap-4 rounded-lg bg-muted p-6">
      <div
        role="img"
        aria-label="휴대폰으로 이어서 찾기 QR 코드"
        className="size-18 shrink-0 rounded-md bg-white p-1.5 [&_svg]:size-full"
        // qrcode 라이브러리가 만든 SVG(외부 입력 없음, 우리 주소만 담음)
        dangerouslySetInnerHTML={qrSvg?.url === targetUrl ? { __html: qrSvg.svg } : undefined}
      />
      <div className="flex flex-col gap-1">
        <span className="text-small font-semibold">웹캠이 없나요?</span>
        <span className="text-[13px] leading-5 text-muted-foreground">
          휴대폰으로 QR을 찍으면 휴대폰에서 이어서 찾을 수 있어요.
        </span>
      </div>
    </div>
  )
}
