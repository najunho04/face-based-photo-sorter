import { redirect, type LoaderFunctionArgs } from 'react-router'
import { paths } from '@/shared/config/paths'
import {
  readAdministratorSession,
  readParticipantSession,
  type AdministratorSession,
  type ParticipantSession,
} from '@/shared/api/token-storage'
import { getSafeNextPath } from '@/shared/lib/safe-next-path'

// 화면을 그리기 전에 실행되는 가드(React Router loader). 조건이 맞지 않으면 redirect를 던져 다른 화면으로 보낸다.

// 요청 주소에서 경로 + 검색어만 꺼낸다(돌아올 주소로 쓰려고)
function getPathWithSearch(request: Request): string {
  const requestUrl = new URL(request.url)
  return `${requestUrl.pathname}${requestUrl.search}`
}

// 참가자 화면(/e/:code/...): 이 행사에 입장한 세션이 없으면 주소의 코드로 자동 입장(①-0)한 뒤 돌아오게 한다
export function requireParticipantSession({
  request,
  params,
}: LoaderFunctionArgs): ParticipantSession {
  const accessCode = params.code ?? ''
  const session = readParticipantSession()
  if (!session || session.accessCode !== accessCode) {
    throw redirect(paths.eventJoin(accessCode, getPathWithSearch(request)))
  }
  return session
}

// 공개 후에만 쓰는 참가자 화면: 입장 확인 뒤, 공개 전이면 ①-1 사진 정리 중으로 보낸다
export function requireOpenEvent(loaderArguments: LoaderFunctionArgs): ParticipantSession {
  const session = requireParticipantSession(loaderArguments)
  if (!session.isEventOpen) throw redirect(paths.eventPreparing(session.accessCode))
  return session
}

// 관리자 화면: 로그인하지 않았거나 만료됐으면 로그인 화면으로 보내고, 로그인 뒤 돌아올 주소를 붙인다
export function requireAdministratorSession({ request }: LoaderFunctionArgs): AdministratorSession {
  const session = readAdministratorSession()
  if (!session) throw redirect(paths.administratorLogin(getPathWithSearch(request)))
  return session
}

// 로그인 화면: 이미 로그인했으면 돌아갈 주소(없으면 최근 행사)로 바로 보낸다
export function redirectSignedInAdministrator({ request }: LoaderFunctionArgs): null {
  if (readAdministratorSession()) {
    const nextPath = new URL(request.url).searchParams.get('next')
    throw redirect(getSafeNextPath(nextPath, paths.administratorEvents))
  }
  return null
}
