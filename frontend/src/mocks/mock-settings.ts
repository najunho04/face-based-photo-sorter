import { readStoredValue, removeStoredValue, writeStoredValue } from '@/shared/lib/stored-value'

// 오류 재현 패널에서 바꾸는 가짜 API 설정. 새로고침해도 유지되도록 localStorage에 둔다.

/** 셀카 검색 결과를 무엇으로 돌려줄지 */
export type SelfieMatchScenario =
  'three-candidates' | 'one-candidate' | 'no-candidates' | 'face-not-detected'

/** 다음 API 요청 한 번을 어떻게 실패시킬지 */
export type NextRequestFailure = 'none' | 'server-error' | 'network-error' | 'timeout'

export type MockSettings = {
  selfieMatchScenario: SelfieMatchScenario
  /** slow면 응답마다 2~3초 기다린다(로딩 화면 확인용) */
  responseSpeed: 'normal' | 'slow'
  nextRequestFailure: NextRequestFailure
  /** 이미지 주소 만료를 3600초 대신 60초로 줄인다(만료 후 다시 불러오기 확인용) */
  shortImageExpiry: boolean
  /** 이 시각(밀리초) 전에 발급된 토큰은 모두 만료로 본다 */
  tokensInvalidBefore: number
}

const settingsKey = 'insaengnaecut.mock-settings'

const defaultMockSettings: MockSettings = {
  selfieMatchScenario: 'three-candidates',
  responseSpeed: 'normal',
  nextRequestFailure: 'none',
  shortImageExpiry: false,
  tokensInvalidBefore: 0,
}

// 저장된 값이 객체인지만 확인한다. 항목별 값은 아래에서 기본값과 합쳐 빈 항목을 채운다
function isStoredSettings(value: unknown): value is Partial<MockSettings> {
  return typeof value === 'object' && value !== null
}

let currentSettings: MockSettings = {
  ...defaultMockSettings,
  ...readStoredValue('local', settingsKey, isStoredSettings),
}
const settingsListeners = new Set<() => void>()

// 설정을 바꾼 뒤 저장하고, 패널 화면이 다시 그려지도록 알린다
function replaceSettings(nextSettings: MockSettings): void {
  currentSettings = nextSettings
  writeStoredValue('local', settingsKey, currentSettings)
  for (const listener of settingsListeners) listener()
}

export function getMockSettings(): MockSettings {
  return currentSettings
}

export function updateMockSettings(changes: Partial<MockSettings>): void {
  replaceSettings({ ...currentSettings, ...changes })
}

export function resetMockSettings(): void {
  removeStoredValue('local', settingsKey)
  replaceSettings({ ...defaultMockSettings })
}

/** 설정이 바뀔 때 부를 함수를 등록한다(useSyncExternalStore용). 돌려받은 함수로 해제 */
export function subscribeMockSettings(listener: () => void): () => void {
  settingsListeners.add(listener)
  return () => settingsListeners.delete(listener)
}

// '다음 요청 한 번 실패' 설정을 꺼내 쓰고 바로 되돌린다. 그래서 실패는 딱 한 번만 일어난다
export function takeNextRequestFailure(): NextRequestFailure {
  const failure = currentSettings.nextRequestFailure
  if (failure !== 'none') updateMockSettings({ nextRequestFailure: 'none' })
  return failure
}
