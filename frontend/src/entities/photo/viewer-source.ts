// ⑥ 크게 보기가 어떤 목록에서 열렸는지(결정 기록 6단계). 주소에 남겨 좌우로 넘길 때 같은 목록을 따라가고 새로고침해도 유지한다

/** 사람 폴더 합쳐 보기(⑤)에서 열었으면 그 사람들, 전체 사진(⑦)에서 열었으면 all */
export type ViewerSource = { kind: 'persons'; personIds: number[] } | { kind: 'all' }

// 주소의 persons=3,12를 사람 번호 목록으로 읽는다. 양의 정수만, 중복 없이
export function parsePersonIdsParameter(value: string | null): number[] {
  if (!value) return []
  const personIds = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((personId) => Number.isInteger(personId) && personId > 0)
  return [...new Set(personIds)]
}

export function readViewerSource(searchParams: URLSearchParams): ViewerSource | null {
  if (searchParams.get('from') === 'all') return { kind: 'all' }
  const personIds = parsePersonIdsParameter(searchParams.get('persons'))
  return personIds.length > 0 ? { kind: 'persons', personIds } : null
}

// 주소 검색어로 바꾼다(쉼표는 그대로 두어 사람이 읽기 쉽게)
export function viewerSourceToQuery(source: ViewerSource): string {
  return source.kind === 'all' ? 'from=all' : `persons=${source.personIds.join(',')}`
}
