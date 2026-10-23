import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tokens.css에서 만든 글자 크기(text-title-1 등)를 크기로 알려 준다.
// 알려 주지 않으면 tailwind-merge가 글자 색으로 착각해서 text-primary와 같이 쓸 때 하나를 지운다.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'title-1', 'title-2', 'headline', 'body', 'small', 'caption'] },
      ],
    },
  },
})

/** Tailwind 클래스를 조건부로 합치고, 충돌하는 클래스는 뒤의 것을 남긴다 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
