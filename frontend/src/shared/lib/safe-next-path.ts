// 입장·로그인 뒤 돌아갈 주소(next)를 안전하게 고른다.
// 주소창의 next는 누구나 바꿀 수 있으므로, 우리 사이트 안의 경로('/'로 시작)만 허용하고
// 다른 사이트로 넘어가는 모양('//', '/\', 'https:' 등)은 기본 주소로 바꾼다.
export function getSafeNextPath(nextPath: string | null | undefined, fallbackPath: string): string {
  if (!nextPath || !nextPath.startsWith('/')) return fallbackPath
  if (nextPath.startsWith('//') || nextPath.startsWith('/\\')) return fallbackPath
  return nextPath
}
