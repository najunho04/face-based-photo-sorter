import type { EventJoin } from '@/entities/session/session-api'
import {
  readParticipantSession,
  saveParticipantSession,
  type ParticipantSession,
} from '@/shared/api/token-storage'

// 참가자 입장 결과를 세션으로 저장한다(①·①-0·①-1이 같이 쓴다). 공개 여부도 함께 남겨 가드가 확인한다
export function saveJoinedEvent(join: EventJoin, accessCode: string): ParticipantSession {
  const session: ParticipantSession = {
    accessToken: join.accessToken,
    eventId: join.eventId,
    eventName: join.eventName,
    accessCode,
    isEventOpen: join.status === 'open',
  }
  saveParticipantSession(session)
  return session
}

// 가드를 통과한 참가자 화면에서 지금 세션을 꺼낸다. 없으면 가드가 잘못된 것이므로 오류 화면으로 보낸다
export function useCurrentParticipantSession(): ParticipantSession {
  const session = readParticipantSession()
  if (!session) throw new Error('참가자 세션 없이 참가자 화면에 들어왔어요(가드 확인 필요)')
  return session
}
