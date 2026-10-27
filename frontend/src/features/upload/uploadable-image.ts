// 끌어다 놓은 파일·폴더에서 사진만 고른다. HEIC는 사파리가 JPG로 바꿀 수 있어 일단 받고,
// 바꾸지 못하면 대기열의 준비 단계에서 '지원하지 않는 형식'으로 실패 처리한다
const imageExtensionPattern = /\.(jpe?g|png|heic|heif)$/i

export function isUploadableImage(file: File): boolean {
  if (file.name.startsWith('.')) return false
  if (['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(file.type)) return true
  return file.type === '' && imageExtensionPattern.test(file.name)
}
