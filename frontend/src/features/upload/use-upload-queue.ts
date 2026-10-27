import { useEffect, useState } from 'react'
import { uploadEventPhotos } from '@/entities/event/event-api'
import {
  createUploadQueue,
  UploadPreparationError,
  type UploadSnapshot,
} from '@/features/upload/upload-queue'
import { isUploadableImage } from '@/features/upload/uploadable-image'
import { resizeImageFileToJpeg } from '@/shared/lib/image-resize'

/** 업로드 전에 줄이는 긴 변 길이(계획 문서 3장) */
const uploadLongEdge = 2000

const emptySnapshot: UploadSnapshot = {
  items: [],
  totalCount: 0,
  doneCount: 0,
  failedCount: 0,
  remainingCount: 0,
  isIdle: true,
}

// 확장자를 .jpg로 바꾼다(줄인 사진은 모두 JPG)
function toJpegFileName(fileName: string): string {
  return `${fileName.replace(/\.[^.]+$/, '')}.jpg`
}

// 사진 한 장을 긴 변 2000px JPG로 줄인다. 브라우저가 열지 못하는 형식(다른 브라우저의 HEIC 등)은 '지원하지 않는 형식'
async function prepareUploadFile(file: File): Promise<File> {
  try {
    const resizedImage = await resizeImageFileToJpeg(file, uploadLongEdge)
    return new File([resizedImage], toJpegFileName(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch {
    throw new UploadPreparationError('UNSUPPORTED_FILE')
  }
}

// 업로드 대기열을 화면에 연결한다. 화면을 떠나면 보내는 중인 요청을 멈춘다
export function useUploadQueue(eventId: number) {
  const [snapshot, setSnapshot] = useState<UploadSnapshot>(emptySnapshot)
  const [queue] = useState(() =>
    createUploadQueue({
      prepareFile: prepareUploadFile,
      uploadBatch: (files, signal) => uploadEventPhotos({ eventId, files, signal }),
      onChange: setSnapshot,
    }),
  )

  useEffect(() => () => queue.cancel(), [queue])

  return {
    snapshot,
    /** 고르거나 끌어다 놓은 파일 중 사진만 대기열에 넣는다. 새로 넣은 장 수를 돌려준다 */
    addFiles: (files: File[]) => queue.add(files.filter(isUploadableImage)),
    retryFailed: () => queue.retryFailed(),
  }
}
