import { FolderUpIcon, ImageIcon, UploadIcon } from 'lucide-react'
import { useId, useState, type ChangeEvent, type DragEvent } from 'react'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button-variants'

/** 사진 고르기 창에서 보여 줄 형식(HEIC는 사파리가 JPG로 바꿔 줌) */
const acceptedImageTypes = 'image/jpeg,image/png,image/heic,image/heif,.heic,.heif'

// 사진 끌어다 놓기·고르기(시안 A4, 명세서 UploadDropzone): 점선 상자, 끌어올리면 인디고 점선 + 연한 배경.
// 폴더를 통째로 끌어다 놓거나 [폴더 고르기]로 고를 수 있다
export function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const photoInputId = useId()
  const folderInputId = useId()

  async function handleDrop(dropEvent: DragEvent) {
    dropEvent.preventDefault()
    setIsDraggingOver(false)
    onFiles(await readDroppedFiles(dropEvent.dataTransfer))
  }

  function handleInputChange(changeEvent: ChangeEvent<HTMLInputElement>) {
    const files = [...(changeEvent.target.files ?? [])]
    // 같은 파일을 다시 골라도 바뀐 것으로 알도록 값을 비운다
    changeEvent.target.value = ''
    onFiles(files)
  }

  return (
    <div
      onDragOver={(dragEvent) => {
        dragEvent.preventDefault()
        setIsDraggingOver(true)
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={(dropEvent) => void handleDrop(dropEvent)}
      className={cn(
        'flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        isDraggingOver ? 'border-primary bg-secondary' : 'border-input bg-background',
      )}
    >
      <UploadIcon className="size-8 text-primary" aria-hidden="true" />
      <span className="text-[15px] font-semibold">사진이나 폴더를 끌어다 놓으세요</span>
      <span className="text-[13px] text-muted-foreground">JPG, PNG · 크기를 줄여서 올려요</span>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <label
          htmlFor={photoInputId}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'cursor-pointer')}
        >
          <ImageIcon aria-hidden="true" />
          사진 고르기
          <input
            id={photoInputId}
            type="file"
            multiple
            accept={acceptedImageTypes}
            className="sr-only"
            onChange={handleInputChange}
          />
        </label>
        <label
          htmlFor={folderInputId}
          className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'cursor-pointer')}
        >
          <FolderUpIcon aria-hidden="true" />
          폴더 고르기
          {/* webkitdirectory: 폴더 안의 파일을 모두 고른다(표준 속성이 아니라 직접 넣는다) */}
          <input
            id={folderInputId}
            type="file"
            multiple
            className="sr-only"
            onChange={handleInputChange}
            {...{ webkitdirectory: '' }}
          />
        </label>
      </div>
    </div>
  )
}

// 끌어다 놓은 항목에서 파일을 모두 꺼낸다. 폴더면 안쪽까지 차례로 들어간다
async function readDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const entries = [...dataTransfer.items]
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry))
  if (entries.length === 0) return [...dataTransfer.files]

  const files: File[] = []
  async function collect(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      files.push(
        await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        ),
      )
      return
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      // readEntries는 한 번에 일부만 주므로 빈 목록이 올 때까지 반복한다
      for (;;) {
        const childEntries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        )
        if (childEntries.length === 0) break
        for (const childEntry of childEntries) await collect(childEntry)
      }
    }
  }
  for (const entry of entries) await collect(entry)
  return files
}
