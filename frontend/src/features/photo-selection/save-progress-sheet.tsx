import type { SaveProgress } from '@/features/photo-selection/use-photo-saver'
import { Button } from '@/shared/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer'
import { Progress } from '@/shared/ui/progress'

type SaveProgressSheetProps = {
  progress: SaveProgress
  onOpenShareSheet: () => void
  onDownloadInstead: () => void
  onCancel: () => void
}

// ⑤-2 저장 진행 시트(시안 ⑤-2): 준비·다운로드 진행, 공유 시트 열기 버튼, 실패 시 다운로드로 대신 저장
export function SaveProgressSheet({
  progress,
  onOpenShareSheet,
  onDownloadInstead,
  onCancel,
}: SaveProgressSheetProps) {
  return (
    <Drawer
      open={progress.status !== 'idle'}
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel()
      }}
    >
      <DrawerContent>
        {/* 시안 ⑤-2: 손잡이↔제목 16px */}
        <div className="flex flex-col gap-4 px-6 pt-4 pb-8">
          <SaveProgressContent
            progress={progress}
            onOpenShareSheet={onOpenShareSheet}
            onDownloadInstead={onDownloadInstead}
            onCancel={onCancel}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// 상태별 시트 내용
function SaveProgressContent({
  progress,
  onOpenShareSheet,
  onDownloadInstead,
  onCancel,
}: SaveProgressSheetProps) {
  if (progress.status === 'working') {
    const isPreparing = progress.method === 'share-sheet'
    return (
      <>
        <DrawerHeader className="flex-row items-baseline justify-between p-0">
          <DrawerTitle>{isPreparing ? '사진 준비 중' : '사진 저장 중'}</DrawerTitle>
          <span role="status" className="text-[15px] font-semibold text-primary-hover">
            {progress.completedCount} / {progress.totalCount}장
          </span>
        </DrawerHeader>
        <Progress value={(progress.completedCount / progress.totalCount) * 100} />
        <DrawerDescription className="text-small leading-6">
          {isPreparing ? (
            progress.purpose === 'save' ? (
              <>
                준비가 끝나면 버튼을 한 번 더 눌러 공유 화면을 열어요.{' '}
                <b className="text-foreground">'이미지 저장'</b>을 누르면 사진 앱에 저장돼요.
              </>
            ) : (
              '준비가 끝나면 버튼을 한 번 더 눌러 공유 화면을 열어요.'
            )
          ) : (
            "사진을 한 장씩 내려받아요. '여러 파일 다운로드'를 물어보면 허용을 눌러주세요."
          )}
        </DrawerDescription>
        <Button variant="secondary" className="h-12" onClick={onCancel}>
          취소
        </Button>
      </>
    )
  }

  if (progress.status === 'ready-to-share') {
    const fileCount = progress.batches[progress.batchIndex].length
    const batchLabel =
      progress.batches.length > 1 ? ` (${progress.batchIndex + 1}/${progress.batches.length})` : ''
    return (
      <>
        <DrawerHeader className="p-0">
          <DrawerTitle>사진 {fileCount}장이 준비됐어요</DrawerTitle>
          <DrawerDescription className="text-small leading-6">
            {progress.purpose === 'save' ? (
              <>
                공유 화면에서 <b className="text-foreground">'이미지 저장'</b>을 누르면 사진 앱에
                저장돼요.
              </>
            ) : (
              '공유 화면에서 보낼 앱을 골라주세요.'
            )}
          </DrawerDescription>
        </DrawerHeader>
        <Button size="lg" onClick={onOpenShareSheet}>
          {progress.purpose === 'save' ? '사진 앱에 저장하기' : '공유하기'}
          {batchLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          닫기
        </Button>
      </>
    )
  }

  if (progress.status === 'failed') {
    return (
      <>
        <DrawerHeader className="p-0">
          <DrawerTitle>사진을 준비하지 못했어요</DrawerTitle>
          <DrawerDescription className="text-small leading-6">
            인터넷 연결을 확인하고 다시 시도하거나, 다운로드로 저장해주세요.
          </DrawerDescription>
        </DrawerHeader>
        <Button size="lg" onClick={onDownloadInstead}>
          다운로드로 저장하기
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          닫기
        </Button>
      </>
    )
  }

  return null
}
