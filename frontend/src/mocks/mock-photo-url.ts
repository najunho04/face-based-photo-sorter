import { getMockSettings } from '@/mocks/mock-settings'

// 가짜 '사진 저장소(Object Storage)' 주소. 실제 Pre-signed URL처럼 만료 시각을 주소에 담고,
// 시각이 지나면 저장소 핸들러가 403을 돌려준다(만료 후 다시 불러오기 확인용).

export const mockStoragePath = '/mock-storage/photos'

/** 사진 한 장의 보기 주소·저장 주소와 만료 시간(초) */
export function createMockPhotoUrls(
  photoId: number,
  fileName: string,
): { url: string; downloadUrl: string; expiresIn: number } {
  const expiresIn = getMockSettings().shortImageExpiry ? 60 : 3600
  const viewUrl = new URL(`${mockStoragePath}/${photoId}.jpg`, window.location.origin)
  viewUrl.searchParams.set('expires', String(Date.now() + expiresIn * 1000))

  // 저장 주소는 받으면 바로 파일로 저장되도록 응답 헤더를 지정하는 값(S3 방식)을 붙인다
  const downloadUrl = new URL(viewUrl)
  downloadUrl.searchParams.set('response-content-disposition', `attachment; filename="${fileName}"`)
  return { url: viewUrl.toString(), downloadUrl: downloadUrl.toString(), expiresIn }
}
