import { ConsentPanel } from '@/features/selfie-search/consent-panel'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer'

type FaceConsentSheetProps = {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  /** 동의하고 촬영하기를 눌렀을 때(동의 저장·이동은 부르는 쪽이 한다) */
  onAgree: () => void
}

// ②-1 셀카 전 동의(휴대폰): 아래에서 올라오는 시트. 닫으면 지금 화면에 그대로 남는다
export function FaceConsentSheet({ isOpen, onOpenChange, onAgree }: FaceConsentSheetProps) {
  return (
    <Drawer open={isOpen} onOpenChange={onOpenChange}>
      <DrawerContent>
        {/* 시안 ②-1: 손잡이↔제목 20px, 제목↔안내 목록 20px */}
        <DrawerHeader className="pt-5 pb-5">
          <DrawerTitle>셀카로 찾기 전에 확인해주세요</DrawerTitle>
          <DrawerDescription className="sr-only">
            셀카 사용 목적과 촬영 방법을 확인하고 얼굴 정보 처리에 동의해주세요.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-6 pb-8">
          <ConsentPanel onAgree={onAgree} onClose={() => onOpenChange(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
