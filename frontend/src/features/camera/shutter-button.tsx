import { cn } from '@/shared/lib/utils'

type ShutterButtonProps = {
  onCapture: () => void
  /** 카메라가 준비되기 전에는 눌러도 아무 일도 하지 않는다(명세서: 비활성 대신 눌렀을 때 무시) */
  isReady: boolean
}

// 셔터 버튼 (시안 ③): 흰 테두리 76px 안에 흰 원 58px
export function ShutterButton({ onCapture, isReady }: ShutterButtonProps) {
  return (
    <button
      type="button"
      aria-label="촬영"
      aria-disabled={!isReady}
      onClick={() => {
        if (isReady) onCapture()
      }}
      className={cn(
        'flex size-19 items-center justify-center rounded-full border-4 border-white transition-transform outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-dark-bg active:scale-95',
        !isReady && 'opacity-50',
      )}
    >
      <span className="size-[58px] rounded-full bg-white" />
    </button>
  )
}
