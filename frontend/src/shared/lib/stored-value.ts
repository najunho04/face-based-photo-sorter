// sessionStorage·localStorage를 안전하게 읽고 쓰는 도구.
// 사파리 사생활 보호 모드·저장 공간 부족·차단된 사이트 데이터에서는 접근만 해도 예외가 나므로 모두 try/catch로 감싼다.

export type StorageKind = 'session' | 'local'

// 저장소 종류에 맞는 Storage 객체를 꺼낸다. 접근 자체가 막혀 있으면 null
function getStorage(storageKind: StorageKind): Storage | null {
  try {
    return storageKind === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

/**
 * 저장된 JSON 값을 읽는다. 없거나, 깨졌거나, isValid 검사를 통과하지 못하면 null.
 * isValid로 모양을 확인하는 이유: 예전 버전이 저장한 값이나 사용자가 고친 값이 들어 있을 수 있어서
 */
export function readStoredValue<Value>(
  storageKind: StorageKind,
  key: string,
  isValid: (value: unknown) => value is Value,
): Value | null {
  try {
    const storedText = getStorage(storageKind)?.getItem(key)
    if (storedText == null) return null
    const parsedValue: unknown = JSON.parse(storedText)
    return isValid(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

// 값을 JSON으로 저장한다. 저장하지 못해도(공간 부족 등) 화면은 계속 동작하도록 실패를 삼킨다
export function writeStoredValue(storageKind: StorageKind, key: string, value: unknown): void {
  try {
    getStorage(storageKind)?.setItem(key, JSON.stringify(value))
  } catch {
    // 저장 실패는 기능 저하일 뿐이라 무시한다(다음 방문 때 다시 입력하면 됨)
  }
}

// 저장된 값을 지운다
export function removeStoredValue(storageKind: StorageKind, key: string): void {
  try {
    getStorage(storageKind)?.removeItem(key)
  } catch {
    // 지우지 못해도 다음 읽기에서 모양 검사로 걸러진다
  }
}
