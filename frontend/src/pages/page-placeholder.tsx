import type { ReactNode } from 'react'
import { Link } from 'react-router'

type PagePlaceholderProps = {
  /** 시안 번호와 화면 이름 (예: '② 사람별 사진') */
  screenName: string
  /** 이 화면을 만들 단계 (계획 문서 7장) */
  plannedStep: number
  /** 라우팅 확인용으로 다른 화면으로 가 보는 링크 */
  links?: Array<{ label: string; to: string }>
  children?: ReactNode
}

// 아직 만들지 않은 화면의 자리. 3단계에서 주소·레이아웃·가드를 확인하려고 화면 이름만 보여 주고,
// 해당 단계에서 실제 화면으로 바꾼 뒤 이 파일은 지운다.
export function PagePlaceholder({
  screenName,
  plannedStep,
  links,
  children,
}: PagePlaceholderProps) {
  return (
    <section className="flex flex-col gap-3 px-5 py-8 lg:px-6 lg:py-10">
      <p className="text-caption text-muted-foreground">{plannedStep}단계에서 만들 화면</p>
      <h1 className="text-title-1">{screenName}</h1>
      {children}
      {links && links.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {links.map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="text-small font-semibold text-primary underline-offset-4 hover:underline"
              >
                {link.label} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
