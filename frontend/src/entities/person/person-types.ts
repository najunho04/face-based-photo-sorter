import type { DownloadablePhoto } from '@/entities/photo/photo-types'

// 사람(얼굴 폴더) 관련 API 응답 타입 (docs/api.md #8~#10). 필드 이름은 서버 계약이라 그대로 쓴다.

/** 원본 사진 안에서 얼굴 위치(픽셀). w·h는 서버 필드 이름 */
export type FaceBox = { x: number; y: number; w: number; h: number }

/**
 * 대표 얼굴: 잘린 이미지가 아니라 원본 URL + 얼굴 위치. 화면이 FaceCrop으로 잘라 보여 준다.
 * url은 백엔드가 사진 주소를 만들지 못하면 null로 온다(그때 화면은 사람 아이콘)
 */
export type RepresentativeFace = { url: string | null; bbox: FaceBox }

/** 사람 폴더 하나. label은 'user3' 같은 서버 이름(화면에는 formatPersonName으로 "사람 3") */
export type Person = {
  personId: number
  label: string
  photoCount: number
  /** 대표 얼굴이 없으면 null(백엔드 응답 기준) */
  repFace: RepresentativeFace | null
}

/** #10 사람 폴더 목록 */
export type PersonList = { total: number; persons: Person[] }

/** #8 셀카 검색 결과. 비슷한 순서로 0~3명, 점수는 주지 않는다 */
export type SelfieMatch = { candidates: Person[] }

/** #9 사람 폴더 사진 */
export type PersonPhotos = {
  personId: number
  label: string
  total: number
  photos: DownloadablePhoto[]
}
