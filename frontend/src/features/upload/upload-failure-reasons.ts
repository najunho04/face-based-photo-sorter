// 업로드 실패 이유 코드를 화면 문구로 바꾼다(시안 A4·M2: "IMG_0412.jpg · 네트워크 오류")
const failureReasonLabels: Record<string, string> = {
  UNSUPPORTED_FILE: '지원하지 않는 형식',
  FILE_TOO_LARGE: '용량이 너무 큼',
  NETWORK_ERROR: '네트워크 오류',
  TIMEOUT: '응답 시간 초과',
  INTERNAL_ERROR: '서버 오류',
  INVALID_STATUS: '업로드를 이미 완료한 행사',
  UNAUTHORIZED: '로그인 시간 끝남',
}

export function getUploadFailureLabel(reason: string | null): string {
  return (reason && failureReasonLabels[reason]) || '올리지 못함'
}

/** 다시 시도하면 올라갈 수 있는 실패인지(형식·용량 오류는 다시 보내도 같다) */
export function isRetryableUploadFailure(reason: string | null): boolean {
  return reason === 'NETWORK_ERROR' || reason === 'TIMEOUT' || reason === 'INTERNAL_ERROR'
}
