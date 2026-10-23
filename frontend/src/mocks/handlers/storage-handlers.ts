import { http, HttpResponse } from 'msw'
import { getMockEvent, splitMockId } from '@/mocks/mock-database'
import { renderMockPhotoImage } from '@/mocks/mock-photo-image'
import { mockStoragePath } from '@/mocks/mock-photo-url'

// 가짜 사진 저장소(Object Storage) 핸들러. API가 아니라서 공통 응답 형식·토큰·지연 설정을 쓰지 않는다.

// Object Storage가 만료된 주소에 돌려주는 것과 비슷한 XML 오류
function expiredResponse() {
  return new HttpResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>',
    { status: 403, headers: { 'Content-Type': 'application/xml' } },
  )
}

export const storageHandlers = [
  http.get(`*${mockStoragePath}/:fileName`, async ({ request, params }) => {
    const requestUrl = new URL(request.url)
    const expiresAt = Number(requestUrl.searchParams.get('expires'))
    if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return expiredResponse()

    // 주소의 사진 번호로 행사와 사진을 찾는다(예: /mock-storage/photos/10007.jpg)
    const photoId = Number(String(params.fileName).replace(/\.jpg$/, ''))
    const { eventId, numberInEvent } = splitMockId(photoId)
    const content = getMockEvent(eventId)?.content
    const photo = content?.photos[numberInEvent - 1]
    if (!content || !photo) return new HttpResponse(null, { status: 404 })

    const image = await renderMockPhotoImage(photoId, photo, content.persons)
    const contentDisposition = requestUrl.searchParams.get('response-content-disposition')
    return new HttpResponse(image, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600',
        ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {}),
      },
    })
  }),
]
