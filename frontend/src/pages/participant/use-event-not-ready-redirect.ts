import { useEffect } from 'react'
import { useNavigate } from 'react-router'
import { isApiErrorWithCode } from '@/shared/api/api-error'
import { saveParticipantSession, type ParticipantSession } from '@/shared/api/token-storage'
import { paths } from '@/shared/config/paths'

// 공개된 줄 알고 들어왔는데 API가 EVENT_NOT_READY(아직 정리 중)를 주면 ①-1 사진 정리 중으로 보낸다.
// 세션의 공개 여부도 false로 고쳐 가드가 다시 같은 화면으로 보내지 않게 한다
export function useEventNotReadyRedirect(error: unknown, session: ParticipantSession) {
  const navigate = useNavigate()
  const isEventNotReady = isApiErrorWithCode(error, 'EVENT_NOT_READY')

  useEffect(() => {
    if (!isEventNotReady) return
    saveParticipantSession({ ...session, isEventOpen: false })
    void navigate(paths.eventPreparing(session.accessCode), { replace: true })
  }, [isEventNotReady, navigate, session])
}
