import type { DownloadablePhoto } from '@/entities/photo/photo-types'

// 여러 사람 폴더(#9)의 사진을 하나로 합친다. 같은 사진이 두 폴더에 있으면 한 번만 넣고,
// 사진 번호 순(올린 순서)으로 정렬한다. ②-2의 '내 사진 N장'과 ⑤ 합쳐 보기가 같은 결과를 쓴다
export function mergePersonPhotos(photoLists: DownloadablePhoto[][]): DownloadablePhoto[] {
  const photosById = new Map<number, DownloadablePhoto>()
  for (const photoList of photoLists) {
    for (const photo of photoList) {
      if (!photosById.has(photo.photoId)) photosById.set(photo.photoId, photo)
    }
  }
  return [...photosById.values()].sort((first, second) => first.photoId - second.photoId)
}
