import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/shared/lib/utils'

// 사진 격자 (명세서 8.3 PhotoGrid): 모서리 없이 2px 간격, 휴대폰은 3열 정사각형, PC는 160px 이상 칸의 4:3
export function PhotoGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-3 gap-0.5 lg:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]',
        className,
      )}
    >
      {children}
    </div>
  )
}

type PhotoThumbnailProps = {
  imageUrl: string
  /** 눌렀을 때 갈 주소(⑥ 크게 보기) */
  to: string
  /** 화면 낭독기가 읽을 이름(예: "사진 3") */
  label: string
  /** 사진이 깨졌을 때(주소 만료 403) 목록을 다시 받도록 알린다 */
  onImageError?: () => void
}

// 격자의 사진 한 칸. 썸네일이 없어 원본을 쓰므로 화면에 보일 때만 불러오고(lazy), 불러오기 전에는 회색 자리를 보여 준다
export function PhotoThumbnail({ imageUrl, to, label, onImageError }: PhotoThumbnailProps) {
  // 불러오기 결과를 주소와 함께 기억한다. 주소가 바뀌면(만료 후 새 주소) 다시 '불러오는 중'
  const [loadedUrl, setLoadedUrl] = useState<string>()
  const isLoaded = loadedUrl === imageUrl

  return (
    <Link
      to={to}
      aria-label={label}
      className="relative block aspect-square overflow-hidden bg-placeholder outline-none focus-visible:ring-3 focus-visible:ring-ring focus-visible:ring-inset lg:aspect-[4/3]"
    >
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoadedUrl(imageUrl)}
        onError={onImageError}
        className={cn(
          'size-full object-cover transition-opacity duration-200',
          isLoaded ? 'opacity-100' : 'opacity-0',
        )}
      />
    </Link>
  )
}
