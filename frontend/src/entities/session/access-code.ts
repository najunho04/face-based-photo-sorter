// 사용자가 입력하거나 주소에 들어 있는 인증코드를 한 모양으로 맞춘다.
// 공백·하이픈을 빼고 대문자로 바꿔, 입력·QR 주소·저장된 세션이 항상 같은 값으로 비교되게 한다(결정 기록 4단계)
export function normalizeAccessCode(accessCode: string): string {
  return accessCode.replace(/[\s-]/g, '').toUpperCase()
}
