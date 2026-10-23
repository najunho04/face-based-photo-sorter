import { FlaskConicalIcon } from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { EventStatusBadge } from '@/entities/event/event-status-badge'
import { mockAdministratorAccount } from '@/mocks/mock-accounts'
import { listMockEvents, resetMockDatabase, type MockEventSnapshot } from '@/mocks/mock-database'
import {
  getMockSettings,
  resetMockSettings,
  subscribeMockSettings,
  updateMockSettings,
  type MockSettings,
} from '@/mocks/mock-settings'
import { clearAllSessions } from '@/shared/api/token-storage'
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
          className="fixed bottom-[calc(12px+env(safe-area-inset-bottom))] left-3 z-50 flex h-11 items-center gap-1.5 rounded-full bg-foreground/85 px-3.5 text-caption text-white shadow-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" size="sm" onClick={expireAllTokens}>
                지금 토큰 만료시키기
              </Button>
              <span role="status" className="text-small text-muted-foreground">
                {tokenExpiredNotice ? '만료시켰어요. 다음 요청이 401을 받아요.' : ''}
              </span>
            </div>
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
