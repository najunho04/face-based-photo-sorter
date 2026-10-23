// 사진 관련 API 응답 타입 (docs/api.md #7, #9). 필드 이름은 서버 계약이라 그대로 쓴다.

/** 사진 한 장. url은 Object Storage Pre-signed URL이라 expiresIn초 뒤에 만료된다 */
export type EventPhoto = {
  photoId: number
  fileName: string
  url: string
  expiresIn: number
}

/** 저장용 주소가 있는 사진(#9). downloadUrl은 받으면 바로 파일로 저장되는 주소 */
export type DownloadablePhoto = EventPhoto & { downloadUrl: string }

/** #7 전체 사진 한 페이지 */
export type EventPhotoPage = {
  page: number
  size: number
  total: number
  photos: EventPhoto[]
}
