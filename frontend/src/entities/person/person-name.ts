// 백엔드 폴더 이름(label, 예: 'user3')을 화면용 이름으로 바꾼다. 결정: 숫자만 살려 "사람 3"으로 보여 준다

// label 끝의 숫자를 꺼낸다. 숫자가 없으면 null
export function getPersonNumber(label: string): number | null {
  const numberMatch = /(\d+)$/.exec(label)
  return numberMatch ? Number(numberMatch[1]) : null
}

// 화면에 보여 줄 사람 이름. 번호를 못 찾으면 서버 이름을 그대로 쓴다
export function formatPersonName(label: string): string {
  const personNumber = getPersonNumber(label)
  return personNumber === null ? label : `사람 ${personNumber}`
}
