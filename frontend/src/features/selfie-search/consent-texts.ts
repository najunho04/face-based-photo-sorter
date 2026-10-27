import { ShieldCheckIcon, UserRoundIcon } from 'lucide-react'

// 셀카 전에 알릴 내용(시안 ②-1·P3). 휴대폰 시트와 PC 옆 칸이 같은 문구를 쓴다
export const consentNotices = [
  { icon: ShieldCheckIcon, text: '셀카는 닮은 얼굴을 찾는 데만 써요.' },
  { icon: UserRoundIcon, text: '한 명만 나오게, 밝은 곳에서 정면으로 찍어주세요.' },
]

/** 동의를 기억하는 범위에 맞춘 안내(결정: 행사별로 기기에 기억) */
export const consentRememberNotice = '한 번 동의하면 이 행사에서는 다시 묻지 않아요.'
