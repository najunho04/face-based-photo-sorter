import { describe, expect, it } from 'vitest'
import {
  createKakaoTalkExternalBrowserUrl,
  detectInAppBrowser,
} from '@/features/camera/in-app-browser'

// 실제 기기에서 보이는 사용자 에이전트(User-Agent) 예시
const userAgents = {
  kakaoTalkAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36;KAKAOTALK 2410550',
  kakaoTalkIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.9.0',
  instagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.18.110 (iPhone15,2; iOS 17_5; ko_KR)',
  facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/450.0.0.38.108]',
  naverApp:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.10.3)',
  line: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.100 Mobile Safari/537.36',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
}

describe('detectInAppBrowser (카메라가 막힐 수 있는 앱 안 브라우저 알아보기)', () => {
  it('카카오톡(안드로이드·아이폰)', () => {
    expect(detectInAppBrowser(userAgents.kakaoTalkAndroid)).toBe('kakaotalk')
    expect(detectInAppBrowser(userAgents.kakaoTalkIos)).toBe('kakaotalk')
  })

  it('인스타그램·페이스북·네이버 앱·라인', () => {
    expect(detectInAppBrowser(userAgents.instagram)).toBe('instagram')
    expect(detectInAppBrowser(userAgents.facebook)).toBe('facebook')
    expect(detectInAppBrowser(userAgents.naverApp)).toBe('naver')
    expect(detectInAppBrowser(userAgents.line)).toBe('line')
  })

  it('일반 브라우저는 null', () => {
    expect(detectInAppBrowser(userAgents.chromeAndroid)).toBeNull()
    expect(detectInAppBrowser(userAgents.safariIos)).toBeNull()
  })
})

describe('createKakaoTalkExternalBrowserUrl', () => {
  it('카카오톡에서 지금 주소를 기본 브라우저로 여는 주소를 만든다', () => {
    expect(createKakaoTalkExternalBrowserUrl('https://example.com/e/A7K2Q9/camera')).toBe(
      'kakaotalk://web/openExternal?url=https%3A%2F%2Fexample.com%2Fe%2FA7K2Q9%2Fcamera',
    )
  })
})
