import type { PersonList, PersonPhotos, SelfieMatch } from '@/entities/person/person-types'
import { requestApi, type Requester } from '@/shared/api/client'

/** #9·#10은 관리자와 참가자가 모두 부른다. 누가 부르는지에 따라 붙일 토큰이 달라진다 */
export type PersonRequester = Extract<Requester, 'administrator' | 'participant'>

/** 셀카 검색은 서버가 그 자리에서 얼굴을 분석하므로 기본 대기 시간보다 길게 기다린다 */
const selfieMatchTimeoutMilliseconds = 30_000

// #10 사람 폴더 목록. minPhotos 이상 찍힌 사람만 사진 수 많은 순으로 온다(참가자 화면은 2 고정)
export function getPersons({
  eventId,
  minPhotos,
  requester,
  signal,
}: {
  eventId: number
  minPhotos?: number
  requester: PersonRequester
  signal?: AbortSignal
}): Promise<PersonList> {
  return requestApi<PersonList>(`/api/events/${eventId}/persons`, {
    requester,
    query: { minPhotos },
    signal,
  })
}

// #9 사람 폴더 사진 전체(페이지 없음). downloadUrl로 저장한다
export function getPersonPhotos({
  eventId,
  personId,
  requester,
  signal,
}: {
  eventId: number
  personId: number
  requester: PersonRequester
  signal?: AbortSignal
}): Promise<PersonPhotos> {
  return requestApi<PersonPhotos>(`/api/events/${eventId}/persons/${personId}/photos`, {
    requester,
    signal,
  })
}

// #8 셀카 검색: multipart의 selfie 필드로 사진 한 장을 보낸다. 셀카는 보내기만 하고 어디에도 저장하지 않는다
export function matchSelfie({
  eventId,
  selfie,
  signal,
}: {
  eventId: number
  selfie: Blob
  signal?: AbortSignal
}): Promise<SelfieMatch> {
  const formData = new FormData()
  formData.append('selfie', selfie, 'selfie.jpg')
  return requestApi<SelfieMatch>(`/api/events/${eventId}/match`, {
    method: 'POST',
    requester: 'participant',
    formData,
    timeoutMilliseconds: selfieMatchTimeoutMilliseconds,
    signal,
  })
}
