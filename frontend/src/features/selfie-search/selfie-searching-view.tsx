import { useEffect, useState } from 'react'
import { Button } from '@/shared/ui/button'

type SelfieSearchingViewProps = {
  /** 방금 찍은(고른) 셀카. 화면에서만 보여 주고 저장하지 않는다 */
  selfie: Blob
  onCancel: () => void
}

// ③-1 닮은 얼굴 찾는 중: 찍은 셀카를 동그랗게 보여 주고 둘레에 도는 표시를 둔다. 취소하면 요청을 멈춘다
export function SelfieSearchingView({ selfie, onCancel }: SelfieSearchingViewProps) {
  const selfieUrl = useObjectUrl(selfie)

  return (
    <div className="flex flex-1 flex-col items-center px-6 pb-[calc(env(safe-area-inset-bottom)+24px)]">
      <div
        role="status"
        className="flex flex-1 flex-col items-center justify-center gap-7 text-center"
      >
        <div className="relative flex size-33 items-center justify-center">
          <svg
            viewBox="0 0 132 132"
            className="absolute inset-0 size-full animate-spin"
            aria-hidden="true"
          >
            <circle
              cx="66"
              cy="66"
              r="62"
              fill="none"
              className="stroke-secondary"
              strokeWidth="6"
            />
            <path
              d="M66 4a62 62 0 0 1 62 62"
              fill="none"
              className="stroke-primary"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
          {selfieUrl && (
            <img src={selfieUrl} alt="찍은 셀카" className="size-27 rounded-full object-cover" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-title-1">닮은 얼굴을 찾고 있어요</h1>
          <p className="text-[15px] leading-6 text-muted-foreground">잠시만 기다려주세요.</p>
        </div>
      </div>
      <Button variant="ghost" className="text-[15px]" onClick={onCancel}>
        취소
      </Button>
    </div>
  )
}

// Blob을 화면에 보여 줄 임시 주소로 바꾸고, 화면을 떠나면 바로 지운다(메모리에만 잠깐 둠)
function useObjectUrl(blob: Blob): string | null {
  const [objectUrl, setObjectUrl] = useState<{ blob: Blob; url: string } | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(blob)
    // 주소를 만든 뒤에 화면에 알린다(첫 그리기에는 회색 원만 보임)
    const animationFrame = requestAnimationFrame(() => setObjectUrl({ blob, url }))
    return () => {
      cancelAnimationFrame(animationFrame)
      URL.revokeObjectURL(url)
    }
  }, [blob])
  return objectUrl?.blob === blob ? objectUrl.url : null
}
