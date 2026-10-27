// A5 사진 정리가 끝났을 때 다른 탭에 있는 관리자에게 알리는 작은 도구(탭 제목 표시, 브라우저 알림)

/** 탭 제목 앞에 붙이는 완료 표시 */
const completedTitlePrefix = '(완료) '

// 탭 제목 앞에 '(완료)'를 붙인다. 화면이 다시 그려져 여러 번 불려도 한 번만 붙는다
export function markTitleAsCompleted(title: string): string {
  return title.startsWith(completedTitlePrefix) ? title : `${completedTitlePrefix}${title}`
}

type NotificationConstructorLike = new (title: string, options: NotificationOptions) => unknown

// 브라우저 알림을 보낸다. 안드로이드 Chrome은 권한이 있어도 new Notification이 예외를 던지므로
// (서비스 워커로만 보낼 수 있음) 예외를 삼키고 false를 돌려준다. 탭 제목 표시는 그대로 남는다
export function showCompletionNotification({
  title,
  body,
  NotificationConstructor = Notification,
}: {
  title: string
  body: string
  NotificationConstructor?: NotificationConstructorLike
}): boolean {
  try {
    new NotificationConstructor(title, { body })
    return true
  } catch {
    return false
  }
}
