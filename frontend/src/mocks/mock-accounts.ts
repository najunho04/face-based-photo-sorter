// 가짜 API 전용 테스트 값. 실제 서버의 계정·코드가 아니며, 개발 서버의 오류 재현 패널에도 보여 준다.

/** 관리자 로그인 테스트 계정 */
export const mockAdministratorAccount = {
  loginId: 'admin',
  password: 'mock-password-1234',
} as const

/** 상태별 샘플 행사의 인증코드 (시안 A2의 행사 4개) */
export const mockSampleAccessCodes = {
  open: 'A7K2Q9',
  clustering: 'G7R4D2',
  extracting: 'M3T8K5',
  uploading: 'C4B9N1',
} as const
