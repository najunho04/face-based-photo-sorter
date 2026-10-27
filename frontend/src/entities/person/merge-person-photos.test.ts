import { describe, expect, it } from 'vitest'
import { mergePersonPhotos } from '@/entities/person/merge-person-photos'
import type { DownloadablePhoto } from '@/entities/photo/photo-types'

// 테스트용 사진 한 장
function photo(photoId: number): DownloadablePhoto {
  return {
    photoId,
    fileName: `IMG_${photoId}.jpg`,
    url: `https://storage.example/${photoId}.jpg`,
    downloadUrl: `https://storage.example/${photoId}.jpg?download`,
    expiresIn: 3600,
  }
}

describe('mergePersonPhotos (여러 폴더 사진 합치기)', () => {
  it('여러 폴더의 사진을 하나로 합친다', () => {
    const merged = mergePersonPhotos([[photo(3), photo(9)], [photo(5)]])

    expect(merged.map((mergedPhoto) => mergedPhoto.photoId)).toEqual([3, 5, 9])
  })

  it('두 폴더에 같이 나온 사진은 한 번만 넣는다', () => {
    const merged = mergePersonPhotos([
      [photo(3), photo(7)],
      [photo(7), photo(8)],
    ])

    expect(merged.map((mergedPhoto) => mergedPhoto.photoId)).toEqual([3, 7, 8])
  })

  it('사진 번호 순(올린 순서)으로 정렬한다', () => {
    const merged = mergePersonPhotos([[photo(20), photo(4)], [photo(11)]])

    expect(merged.map((mergedPhoto) => mergedPhoto.photoId)).toEqual([4, 11, 20])
  })

  it('폴더가 없으면 빈 목록', () => {
    expect(mergePersonPhotos([])).toEqual([])
  })
})
