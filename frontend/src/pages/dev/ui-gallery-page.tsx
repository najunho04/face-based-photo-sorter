import { CameraIcon, ImageOffIcon, SearchIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { EventStatusBadge } from '@/entities/event/event-status-badge'
import type { EventStatus } from '@/entities/event/event-status'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { AppLogo } from '@/shared/ui/app-logo'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/shared/ui/carousel'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/ui/drawer'
import { EmptyState } from '@/shared/ui/empty-state'
import { ErrorState } from '@/shared/ui/error-state'
import { FaceCrop } from '@/shared/ui/face-crop'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { PhotoPlaceholder } from '@/shared/ui/photo-placeholder'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'
import { Toaster } from '@/shared/ui/sonner'

// 개발 서버에서만 열리는 컴포넌트 모음(/dev/ui). 색·글자·버튼·배지가 명세서와 같은지 눈으로 확인하는 용도

// 명세서 2장 색 토큰. 이름과 CSS 변수를 함께 보여 준다
const colorTokens = [
  'primary',
  'primary-hover',
  'primary-pressed',
  'secondary',
  'secondary-foreground',
  'foreground',
  'muted-foreground',
  'text-muted',
  'background',
  'muted',
  'border',
  'input',
  'placeholder',
  'success',
  'success-soft',
  'warning',
  'warning-soft',
  'danger',
  'danger-soft',
  'neutral-soft',
  'dark-bg',
  'dark-surface',
]

// 명세서 3장 글자 크기 단계
const typographySteps = [
  { className: 'text-display', name: 'display 28/36 Bold' },
  { className: 'text-title-1', name: 'title-1 24/32 Bold' },
  { className: 'text-title-2', name: 'title-2 20/28 Bold' },
  { className: 'text-headline', name: 'headline 17/24 SemiBold' },
  { className: 'text-body', name: 'body 16/24 Regular' },
  { className: 'text-small', name: 'small 14/20 Regular' },
  { className: 'text-caption', name: 'caption 12/16 Medium' },
]

const buttonVariantNames = ['default', 'secondary', 'ghost', 'destructive', 'link'] as const
const eventStatuses: EventStatus[] = ['uploading', 'extracting', 'clustering', 'open']

// FaceCrop 확인용 그림. 800×600 안에 얼굴(타원)이 x=330, y=150, 너비 140, 높이 180 위치에 있다
const sampleFaceBox = { x: 330, y: 150, w: 140, h: 180 }
const samplePhotoUrl = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="#C7D2FE"/>
  <rect y="420" width="800" height="180" fill="#A5B4FC"/>
  <rect x="300" y="330" width="200" height="270" rx="60" fill="#4F46E5"/>
  <ellipse cx="400" cy="240" rx="70" ry="90" fill="#FDE2C8"/>
  <circle cx="375" cy="225" r="8" fill="#1E1B4B"/>
  <circle cx="425" cy="225" r="8" fill="#1E1B4B"/>
  <path d="M370 280 Q400 305 430 280" stroke="#1E1B4B" stroke-width="6" fill="none" stroke-linecap="round"/>
</svg>`)}`

// 각 묶음의 제목과 내용을 감싸는 틀
function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border py-8">
      <h2 className="text-title-2 text-foreground">{title}</h2>
      {children}
    </section>
  )
}

export default function UiGalleryPage() {
  return (
    <main className="mx-auto max-w-content px-4 pb-24 md:px-8">
      <header className="flex flex-col gap-2 py-8">
        <AppLogo size="large" />
        <h1 className="text-title-1">컴포넌트 모음</h1>
        <p className="text-small text-muted-foreground">
          개발 서버에서만 보이는 화면입니다. 기준: docs/design-system/insaengnaecut/MASTER.md
        </p>
      </header>

      <GallerySection title="색">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {colorTokens.map((tokenName) => (
            <div key={tokenName} className="flex flex-col gap-1.5">
              <div
                className="h-14 rounded-md border border-border"
                style={{ background: `var(--${tokenName})` }}
              />
              <span className="text-caption text-muted-foreground">{tokenName}</span>
            </div>
          ))}
        </div>
      </GallerySection>

      <GallerySection title="글자 (Pretendard)">
        <div className="flex flex-col gap-3">
          {typographySteps.map((step) => (
            <div key={step.name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className={step.className}>내 얼굴로 사진 찾기</span>
              <span className="text-caption text-text-muted">{step.name}</span>
            </div>
          ))}
        </div>
      </GallerySection>

      <GallerySection title="로고">
        <div className="flex flex-wrap items-center gap-6">
          <AppLogo size="small" />
          <AppLogo size="medium" />
          <AppLogo size="large" />
          <AppLogo size="medium" showAdministratorBadge />
        </div>
      </GallerySection>

      <GallerySection title="버튼">
        <div className="flex flex-col gap-4">
          {buttonVariantNames.map((variantName) => (
            <div key={variantName} className="flex flex-wrap items-center gap-3">
              <span className="w-24 text-caption text-muted-foreground">{variantName}</span>
              <Button variant={variantName} size="lg">
                셀카로 찾기
              </Button>
              <Button variant={variantName}>저장</Button>
              <Button variant={variantName} size="sm">
                선택
              </Button>
              <Button variant={variantName} disabled>
                비활성
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <span className="w-24 text-caption text-muted-foreground">기타</span>
            <Button size="lg" loading>
              저장하는 중
            </Button>
            <Button size="icon" variant="secondary" aria-label="사진 찍기">
              <CameraIcon />
            </Button>
            <Button size="lg">
              <SearchIcon />내 사진 찾기
            </Button>
          </div>
          <Button size="lg" className="w-full max-w-sm">
            가로 꽉 찬 주 버튼
          </Button>
        </div>
      </GallerySection>

      <GallerySection title="입력칸 · 체크">
        <div className="grid max-w-md gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-event-code">입장 코드</Label>
            <Input id="gallery-event-code" inputSize="lg" placeholder="6자리 코드" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-event-name">행사 이름</Label>
            <Input id="gallery-event-name" placeholder="2026 봄 축제" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-invalid">오류 상태</Label>
            <Input id="gallery-invalid" aria-invalid defaultValue="12" />
            <p className="text-small text-danger">코드는 6자리예요.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gallery-disabled">비활성</Label>
            <Input id="gallery-disabled" disabled defaultValue="수정할 수 없음" />
          </div>
          <label className="flex items-center gap-3 text-body">
            <Checkbox defaultChecked />
            얼굴 사진 사용에 동의합니다
          </label>
          <label className="flex items-center gap-3 text-body">
            <Checkbox />
            체크 안 됨
          </label>
        </div>
      </GallerySection>

      <GallerySection title="배지 · 행사 상태">
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">정보</Badge>
          <Badge tone="success">성공</Badge>
          <Badge tone="warning">주의</Badge>
          <Badge tone="danger">오류</Badge>
          <Badge tone="neutral">기본</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {eventStatuses.map((status) => (
            <EventStatusBadge key={status} status={status} />
          ))}
        </div>
      </GallerySection>

      <GallerySection title="진행 · 불러오는 중 · 사진 자리">
        <div className="grid max-w-md gap-3">
          <Progress value={40} />
          <Progress value={100} tone="success" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className="grid max-w-md grid-cols-3 gap-0.5">
          <PhotoPlaceholder />
          <PhotoPlaceholder showIcon />
          <PhotoPlaceholder />
        </div>
        <div className="grid max-w-md grid-cols-2 gap-2">
          <PhotoPlaceholder aspectRatio="landscape" className="rounded-md" />
          <PhotoPlaceholder aspectRatio="landscape" showIcon className="rounded-md" />
        </div>
      </GallerySection>

      <GallerySection title="얼굴 동그라미 (FaceCrop)">
        <div className="flex flex-wrap items-end gap-6">
          <figure className="flex flex-col items-center gap-2">
            <img src={samplePhotoUrl} alt="" className="w-60 rounded-md" />
            <figcaption className="text-caption text-muted-foreground">원본</figcaption>
          </figure>
          {[88, 92, 140].map((size) => (
            <figure key={size} className="flex flex-col items-center gap-2">
              <FaceCrop imageUrl={samplePhotoUrl} faceBox={sampleFaceBox} size={size} />
              <figcaption className="text-caption text-muted-foreground">{size}px</figcaption>
            </figure>
          ))}
          <figure className="flex flex-col items-center gap-2">
            <FaceCrop imageUrl="/not-found.jpg" faceBox={sampleFaceBox} size={92} />
            <figcaption className="text-caption text-muted-foreground">불러오기 실패</figcaption>
          </figure>
        </div>
      </GallerySection>

      <GallerySection title="카드">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>2026 봄 축제</CardTitle>
            <CardDescription>사진 1,240장 · 사람 312명</CardDescription>
          </CardHeader>
          <CardContent>
            <EventStatusBadge status="open" />
          </CardContent>
        </Card>
      </GallerySection>

      <GallerySection title="빈 화면 · 오류 화면">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <EmptyState
              icon={ImageOffIcon}
              title="아직 찾은 사진이 없어요"
              description="셀카로 한 번 찾아 보세요."
              action={<Button variant="secondary">셀카로 찾기</Button>}
            />
          </Card>
          <Card>
            <ErrorState
              title="사진을 불러오지 못했어요"
              description="인터넷 연결을 확인하고 다시 시도해 주세요."
              onRetry={() => toast('다시 시도를 눌렀어요')}
            />
          </Card>
        </div>
      </GallerySection>

      <GallerySection title="겹쳐 뜨는 창 · 알림">
        <div className="flex flex-wrap gap-3">
          <Drawer>
            <DrawerTrigger asChild>
              <Button variant="secondary">아래에서 올라오는 창</Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>사진 저장</DrawerTitle>
                <DrawerDescription>선택한 사진 12장을 휴대폰에 저장할까요?</DrawerDescription>
              </DrawerHeader>
              <DrawerFooter>
                <Button size="lg">저장하기</Button>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">가운데 창</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>입장 QR</DialogTitle>
                <DialogDescription>참가자에게 이 화면을 보여 주세요.</DialogDescription>
              </DialogHeader>
              <PhotoPlaceholder className="rounded-md" />
              <DialogFooter>
                <DialogClose asChild>
                  <Button>닫기</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">확인 창</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>업로드를 멈출까요?</AlertDialogTitle>
                <AlertDialogDescription>
                  올라가지 않은 사진 34장은 다시 선택해야 해요.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>계속 올리기</AlertDialogCancel>
                <AlertDialogAction>멈추기</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="ghost" onClick={() => toast('링크를 복사했어요')}>
            알림
          </Button>
          <Button variant="ghost" onClick={() => toast.success('사진 12장을 저장했어요')}>
            성공 알림
          </Button>
          <Button
            variant="ghost"
            onClick={() => toast.error('저장하지 못했어요. 다시 시도해 주세요.')}
          >
            오류 알림
          </Button>
        </div>
      </GallerySection>

      <GallerySection title="사진 넘겨 보기 (Carousel)">
        <Carousel className="mx-14 max-w-md">
          <CarouselContent>
            {[1, 2, 3, 4].map((photoNumber) => (
              <CarouselItem key={photoNumber}>
                <PhotoPlaceholder aspectRatio="landscape" showIcon className="rounded-md" />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious />
          <CarouselNext />
        </Carousel>
      </GallerySection>

      {/* 알림 표시 자리. 3단계에서 앱 전체 Provider로 옮긴다 */}
      <Toaster />
    </main>
  )
}
