import { ApiError, type ClientErrorCode, type ServerErrorCode } from '@/shared/api/api-error'

// 오류 코드별 화면 문구. 명세서 10장 규칙: 무슨 일이 있었는지 + 무엇을 하면 되는지, "~해요" 체.
// 화면마다 더 알맞은 문구가 있으면(예: 입장 화면의 코드 오류) 그 화면에서 따로 정한다.
const errorMessages: Record<ServerErrorCode | ClientErrorCode, string> = {
  INVALID_REQUEST: '입력한 내용을 확인할 수 없어요. 다시 확인해주세요.',
  UNAUTHORIZED: '접속 시간이 끝났어요. 다시 들어와주세요.',
  LOGIN_FAILED: '아이디 또는 비밀번호가 맞지 않아요. 다시 확인해주세요.',
  FORBIDDEN: '이 행사를 볼 수 없어요. 인증코드로 다시 들어와주세요.',
  INVALID_ACCESS_CODE: '인증코드를 찾을 수 없어요. 다시 확인해주세요.',
  EVENT_NOT_FOUND: '행사를 찾을 수 없어요. 주소나 인증코드를 다시 확인해주세요.',
  PERSON_NOT_FOUND: '사진 폴더를 찾을 수 없어요. 목록에서 다시 골라주세요.',
  EVENT_NOT_READY: '아직 사진을 정리하고 있어요. 잠시 후 다시 확인해주세요.',
  INVALID_STATUS: '지금은 할 수 없는 작업이에요. 화면을 새로고침해주세요.',
  FILE_TOO_LARGE: '사진 용량이 너무 커요. 더 작은 사진으로 다시 시도해주세요.',
  UNSUPPORTED_FILE: 'JPG·PNG 사진만 올릴 수 있어요. 다른 사진을 골라주세요.',
  FACE_NOT_DETECTED: '얼굴이 잘 보이지 않아요. 밝은 곳에서 정면으로 다시 찍어주세요.',
  INTERNAL_ERROR: '서버에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
  NETWORK_ERROR: '인터넷에 연결되지 않았어요. 연결을 확인하고 다시 시도해주세요.',
  TIMEOUT: '응답이 너무 늦어요. 잠시 후 다시 시도해주세요.',
  UNKNOWN_ERROR: '문제가 생겼어요. 잠시 후 다시 시도해주세요.',
}

// 어떤 오류든 화면에 보여 줄 한 문장으로 바꾼다. 순서: 프론트 문구 → 서버 문구 → 일반 문구
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return errorMessages.UNKNOWN_ERROR
  if (Object.hasOwn(errorMessages, error.code)) {
    return errorMessages[error.code as keyof typeof errorMessages]
  }
  return error.serverMessage || errorMessages.UNKNOWN_ERROR
}
