// 앱 안 브라우저(카카오톡·인스타그램 등) 알아보기. 이런 브라우저는 카메라 권한이 막히는 경우가 많아
// 다른 브라우저로 여는 방법을 안내한다(결정 기록 5단계)

export type InAppBrowser = 'kakaotalk' | 'instagram' | 'facebook' | 'naver' | 'line'

// 사용자 에이전트에 들어가는 앱 표시. 위에서부터 확인한다(페이스북 표시는 인스타그램에도 섞일 수 있어 인스타그램을 먼저)
const inAppBrowserPatterns: Array<{ browser: InAppBrowser; pattern: RegExp }> = [
  { browser: 'kakaotalk', pattern: /KAKAOTALK/i },
  { browser: 'instagram', pattern: /Instagram/ },
  { browser: 'facebook', pattern: /FBAN|FBAV|FB_IAB/ },
  { browser: 'naver', pattern: /NAVER\(inapp/ },
  { browser: 'line', pattern: /\bLine\//i },
]

export function detectInAppBrowser(userAgent: string): InAppBrowser | null {
  return inAppBrowserPatterns.find(({ pattern }) => pattern.test(userAgent))?.browser ?? null
}

/** 화면에 보여 줄 앱 이름 */
export const inAppBrowserNames: Record<InAppBrowser, string> = {
  kakaotalk: '카카오톡',
  instagram: '인스타그램',
  facebook: '페이스북',
  naver: '네이버 앱',
  line: '라인',
}

// 카카오톡이 제공하는 주소 형식으로, 지금 페이지를 휴대폰 기본 브라우저(크롬·사파리)에서 연다
export function createKakaoTalkExternalBrowserUrl(pageUrl: string): string {
  return `kakaotalk://web/openExternal?url=${encodeURIComponent(pageUrl)}`
}
