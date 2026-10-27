import { CheckIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useLongPress } from '@/shared/lib/use-long-press'
import { cn } from '@/shared/lib/utils'
import { Checkbox } from '@/shared/ui/checkbox'

type SelectablePhotoTileProps = {
  imageUrl: string
  /** 사진 순서 이름(예: "사진 3"). 화면 낭독기용 */
  label: string
  /** 선택 모드가 아닐 때 누르면 갈 주소(⑥ 크게 보기) */
  viewerPath: string
  isSelecting: boolean
  isSelected: boolean
  /** PC(P5)는 선택 모드 없이 칸마다 체크박스를 보여 준다 */
  showCheckbox: boolean
  onToggle: () => void
  onLongPress: () => void
  onImageError?: () => void
}

// ⑤ 사진 한 칸. 평소에는 누르면 ⑥으로, 선택 모드에서는 눌러서 고르고(⑤-1), 휴대폰에서는 길게 눌러 선택 모드로 들어간다
export function SelectablePhotoTile({
  imageUrl,
  label,
  viewerPath,
  isSelecting,
  isSelected,
  showCheckbox,
  onToggle,
  onLongPress,
  onImageError,
}: SelectablePhotoTileProps) {
  const longPressHandlers = useLongPress(onLongPress)
  const image = <TileImage imageUrl={imageUrl} onImageError={onImageError} />
  const selectedRing = isSelected && (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 ring-3 ring-primary ring-inset"
    />
  )
  const tileClassName =
    'relative block aspect-square overflow-hidden bg-placeholder select-none outline-none [-webkit-touch-callout:none] focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset lg:aspect-[4/3]'

  if (isSelecting) {
    return (
      <button
        type="button"
        aria-pressed={isSelected}
        aria-label={label}
        onClick={onToggle}
        className={tileClassName}
      >
        {image}
        {selectedRing}
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full',
            isSelected ? 'bg-primary text-white' : 'border-2 border-white bg-white/70',
          )}
        >
          {isSelected && <CheckIcon className="size-3.5" strokeWidth={3} />}
        </span>
      </button>
    )
  }

  return (
    <div className="relative">
      <Link to={viewerPath} aria-label={label} className={tileClassName} {...longPressHandlers}>
        {image}
        {selectedRing}
      </Link>
      {showCheckbox && (
        <Checkbox
          checked={isSelected}
          onCheckedChange={onToggle}
          aria-label={`${label} 선택`}
          className="absolute top-2.5 left-2.5 border-white bg-white/80 shadow-sm"
        />
      )}
    </div>
  )
}

// 사진 이미지. 화면에 보일 때만 불러오고(lazy), 불러오기 전에는 회색 칸을 보여 준다
function TileImage({ imageUrl, onImageError }: { imageUrl: string; onImageError?: () => void }) {
  const [loadedUrl, setLoadedUrl] = useState<string>()
  return (
    <img
      src={imageUrl}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onLoad={() => setLoadedUrl(imageUrl)}
      onError={onImageError}
      className={cn(
        'size-full object-cover transition-opacity duration-200',
        loadedUrl === imageUrl ? 'opacity-100' : 'opacity-0',
      )}
    />
  )
}
