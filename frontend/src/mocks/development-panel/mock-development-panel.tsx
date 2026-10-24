import { FlaskConicalIcon } from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { EventStatusBadge } from '@/entities/event/event-status-badge'
import { addRecentEvent } from '@/entities/event/recent-event-storage'
import { saveMyPersonIds } from '@/entities/person/my-person-storage'
import { joinEvent, loginAdministrator } from '@/entities/session/session-api'
import { mockAdministratorAccount, mockSampleAccessCodes } from '@/mocks/mock-accounts'
import {
  listMockEvents,
  resetMockDatabase,
  toPersonId,
  type MockEventSnapshot,
} from '@/mocks/mock-database'
import {
  getMockSettings,
  resetMockSettings,
  subscribeMockSettings,
  updateMockSettings,
  type MockSettings,
} from '@/mocks/mock-settings'
import {
  clearAllSessions,
  saveAdministratorSession,
  saveParticipantSession,
} from '@/shared/api/token-storage'
import { paths } from '@/shared/config/paths'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/shared/ui/drawer'

// 가짜 API 오류 재현 패널. 개발 서버에서 가짜 API를 켰을 때만 화면 왼쪽 아래에 나타난다.
// 휴대폰으로 실제 셀카를 찍어도 결과(후보 수·얼굴 없음)를 여기서 고를 수 있다.

type ChoiceOption<Value extends string> = { value: Value; label: string }

const selfieMatchOptions: ChoiceOption<MockSettings['selfieMatchScenario']>[] = [
  { value: 'three-candidates', label: '후보 3명' },
  { value: 'one-candidate', label: '후보 1명' },
  { value: 'no-candidates', label: '후보 0명' },
  { value: 'face-not-detected', label: '얼굴 없음' },
]
// 대표 얼굴 비우기: 실제 백엔드가 주소·대표 얼굴을 비워 보낼 때 화면이 깨지지 않는지 확인용
const representativeFaceOptions: ChoiceOption<MockSettings['representativeFaceMode']>[] = [
  { value: 'normal', label: '보통' },
  { value: 'missing-url', label: '사진 주소 없음' },
  { value: 'missing-face', label: '대표 얼굴 없음' },
]
const responseSpeedOptions: ChoiceOption<MockSettings['responseSpeed']>[] = [
  { value: 'normal', label: '보통' },
  { value: 'slow', label: '느리게 (2~3초)' },
]
const nextRequestFailureOptions: ChoiceOption<MockSettings['nextRequestFailure']>[] = [
  { value: 'none', label: '없음' },
  { value: 'server-error', label: '서버 오류' },
  { value: 'network-error', label: '네트워크 끊김' },
  { value: 'timeout', label: '시간 초과' },
]

export default function MockDevelopmentPanel() {
  const settings = useSyncExternalStore(subscribeMockSettings, getMockSettings)
  const [mockEvents, setMockEvents] = useState<MockEventSnapshot[]>([])
  const [tokenExpiredNotice, setTokenExpiredNotice] = useState(false)
  const [quickEntryNotice, setQuickEntryNotice] = useState('')

  // 로그인·입장 화면을 건너뛰고 바로 들어간다(화면 확인용). 실패하면 패널에 알린다
  function runQuickEntry(enter: () => Promise<void>) {
    setQuickEntryNotice('')
    enter().catch(() => setQuickEntryNotice('실패했어요. 다시 눌러주세요.'))
  }

  // 패널을 열 때마다 행사 목록을 새로 읽는다(관리자가 만든 행사·진행 상태 반영)
  function handleOpenChange(open: boolean) {
    if (open) setMockEvents(listMockEvents())
  }

  // 지금까지 발급된 토큰을 모두 만료시킨다. 다음 API 요청이 401을 받는다
  function expireAllTokens() {
    updateMockSettings({ tokensInvalidBefore: Date.now() })
    setTokenExpiredNotice(true)
    window.setTimeout(() => setTokenExpiredNotice(false), 2500)
  }

  // 가짜 데이터·설정·로그인 정보를 처음 상태로 되돌리고 새로고침한다
  function resetEverything() {
    resetMockDatabase()
    resetMockSettings()
    clearAllSessions()
    window.location.reload()
  }

  return (
    <Drawer onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <button
          type="button"
          // 휴대폰: 화면 아래 고정 버튼·관리자 '새 행사' 버튼을 가리지 않게 왼쪽 가장자리 가운데에 작은 탭으로,
          // PC: 관리자 왼쪽 메뉴(로그아웃)를 가리지 않게 오른쪽 아래에 둔다
          className="fixed top-1/2 left-0 z-50 flex h-11 -translate-y-1/2 items-center gap-1.5 rounded-r-full bg-foreground/85 pr-3.5 pl-2.5 text-caption text-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:top-auto lg:right-4 lg:bottom-4 lg:left-auto lg:translate-y-0 lg:rounded-full lg:px-3.5"
        >
          <FlaskConicalIcon className="size-4" aria-hidden="true" />
          가짜 API
          {settings.nextRequestFailure !== 'none' && (
            <span className="size-2 rounded-full bg-warning" aria-label="실패 예약됨" />
          )}
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>가짜 API 설정</DrawerTitle>
          <DrawerDescription>
            개발 서버에서만 보여요. 설정은 새로고침해도 유지돼요.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex max-h-[65vh] flex-col gap-6 overflow-y-auto px-5 pb-6">
          <PanelSection title="셀카 검색 결과">
            <ChoiceGroup
              label="셀카 검색 결과"
              options={selfieMatchOptions}
              selectedValue={settings.selfieMatchScenario}
              onSelect={(value) => updateMockSettings({ selfieMatchScenario: value })}
            />
          </PanelSection>

          <PanelSection title="대표 얼굴">
            <ChoiceGroup
              label="대표 얼굴"
              options={representativeFaceOptions}
              selectedValue={settings.representativeFaceMode}
              onSelect={(value) => updateMockSettings({ representativeFaceMode: value })}
            />
          </PanelSection>

          <PanelSection title="응답 속도">
            <ChoiceGroup
              label="응답 속도"
              options={responseSpeedOptions}
              selectedValue={settings.responseSpeed}
              onSelect={(value) => updateMockSettings({ responseSpeed: value })}
            />
          </PanelSection>

          <PanelSection
            title="다음 요청 한 번 실패"
            description="API 요청 한 번에만 적용되고 '없음'으로 돌아가요."
          >
            <ChoiceGroup
              label="다음 요청 한 번 실패"
              options={nextRequestFailureOptions}
              selectedValue={settings.nextRequestFailure}
              onSelect={(value) => updateMockSettings({ nextRequestFailure: value })}
            />
          </PanelSection>

          <PanelSection title="만료">
            <label className="flex items-center gap-3 text-body">
              <Checkbox
                checked={settings.shortImageExpiry}
                onCheckedChange={(checked) =>
                  updateMockSettings({ shortImageExpiry: checked === true })
                }
              />
              이미지 주소 만료를 60초로 줄이기
            </label>
            <label className="flex items-center gap-3 text-body">
              <Checkbox
                checked={settings.useFakeCamera}
                onCheckedChange={(checked) =>
                  updateMockSettings({ useFakeCamera: checked === true })
                }
              />
              가짜 카메라 쓰기(웹캠 없이 촬영 확인)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={expireAllTokens}>
                지금 토큰 만료시키기
              </Button>
              <span role="status" className="text-small text-muted-foreground">
                {tokenExpiredNotice ? '만료시켰어요. 다음 요청이 401을 받아요.' : ''}
              </span>
            </div>
          </PanelSection>

          <PanelSection title="빠른 이동" description="로그인·입장 화면을 건너뛰고 바로 들어가요.">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runQuickEntry(signInAsMockAdministrator)}
              >
                관리자로 로그인
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runQuickEntry(() => joinMockEvent(mockSampleAccessCodes.open))}
              >
                공개된 행사로 입장
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runQuickEntry(() => joinMockEvent(mockSampleAccessCodes.extracting))}
              >
                정리 중인 행사로 입장
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => runQuickEntry(rememberSampleMyPersons)}
              >
                내 폴더 예시 저장(②-2)
              </Button>
            </div>
            {quickEntryNotice && (
              <p role="status" className="text-small text-danger">
                {quickEntryNotice}
              </p>
            )}
          </PanelSection>

          <PanelSection title="테스트 정보">
            <p className="text-small text-muted-foreground">
              관리자 계정{' '}
              <code className="text-foreground">{mockAdministratorAccount.loginId}</code> /{' '}
              <code className="text-foreground">{mockAdministratorAccount.password}</code>
            </p>
            <ul className="flex flex-col divide-y divide-border rounded-md border border-border">
              {mockEvents.map((mockEvent) => (
                <li
                  key={mockEvent.eventId}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-small font-semibold">{mockEvent.name}</span>
                    <span className="text-caption text-muted-foreground">
                      코드 <code className="text-foreground">{mockEvent.accessCode}</code> · 사진{' '}
                      {mockEvent.photoCounts.total}장
                    </span>
                  </div>
                  <EventStatusBadge status={mockEvent.status} />
                </li>
              ))}
            </ul>
          </PanelSection>

          <Button variant="destructive" onClick={resetEverything}>
            가짜 데이터 처음으로 되돌리기
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// 테스트 계정으로 로그인하고 최근 행사 화면을 새로 연다(패널은 라우터 밖에 있어 주소를 직접 바꾼다)
async function signInAsMockAdministrator() {
  const login = await loginAdministrator(mockAdministratorAccount)
  saveAdministratorSession({
    accessToken: login.accessToken,
    expiresInSeconds: login.expiresIn,
    loginId: mockAdministratorAccount.loginId,
  })
  // 최근 행사는 이 기기에 남긴 목록이라, 가짜 서버의 행사를 넣어 둔다(뒤에서부터 넣어 행사 1이 맨 앞)
  for (const mockEvent of listMockEvents().reverse()) addRecentEvent(mockEvent.eventId)
  window.location.assign(paths.administratorEvents)
}

// 샘플 행사로 입장하고, 공개됐으면 사람별 사진, 아니면 사진 정리 중 화면을 연다
async function joinMockEvent(accessCode: string) {
  const join = await joinEvent(accessCode)
  saveParticipantSession({
    accessToken: join.accessToken,
    eventId: join.eventId,
    eventName: join.eventName,
    accessCode,
    isEventOpen: join.status === 'open',
  })
  window.location.assign(
    join.status === 'open' ? paths.eventHome(accessCode) : paths.eventPreparing(accessCode),
  )
}

// 공개된 샘플 행사에 '내 폴더' 2개(사람 1·3)를 기억시키고 사람별 사진을 연다. 셀카 흐름(5단계) 전에 ②-2를 확인하려고 둔다
async function rememberSampleMyPersons() {
  const sampleEventId = 1
  saveMyPersonIds(sampleEventId, [toPersonId(sampleEventId, 1), toPersonId(sampleEventId, 3)])
  await joinMockEvent(mockSampleAccessCodes.open)
}

// 패널의 묶음 하나: 제목 + (설명) + 내용
function PanelSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-headline">{title}</h3>
        {description && <p className="text-caption text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

// 여러 값 중 하나를 고르는 버튼 묶음. 고른 버튼만 주 색으로 칠하고, 화면 낭독기에는 라디오로 알린다
function ChoiceGroup<Value extends string>({
  label,
  options,
  selectedValue,
  onSelect,
}: {
  label: string
  options: ChoiceOption<Value>[]
  selectedValue: Value
  onSelect: (value: Value) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = option.value === selectedValue
        return (
          <Button
            key={option.value}
            role="radio"
            aria-checked={isSelected}
            variant={isSelected ? 'default' : 'secondary'}
            size="sm"
            onClick={() => onSelect(option.value)}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
