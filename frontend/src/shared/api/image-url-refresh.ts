// 사진 주소(Pre-signed URL)는 expiresIn초 뒤에 만료된다. 목록을 오래 보고 있어도 사진이 깨지지 않도록
// 만료 전에 목록을 다시 받아 새 주소로 바꾸는 시간을 정한다.

/** 너무 자주 다시 받지 않도록 하는 최소 간격 */
const minimumRefreshMilliseconds = 30_000

/** 만료 시간의 80%가 지나면 다시 받는다. 만료 시간을 모르면 null(다시 받지 않음) */
export function getImageUrlRefreshMilliseconds(
  expiresInSeconds: number | undefined,
): number | null {
  if (expiresInSeconds === undefined) return null
  return Math.max(minimumRefreshMilliseconds, expiresInSeconds * 1000 * 0.8)
}
