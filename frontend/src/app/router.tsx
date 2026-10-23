import { createBrowserRouter, redirect, type RouteObject } from 'react-router'
import { ParticipantLayout } from '@/app/layouts/participant-layout'
import { RootLayout, type RouteHandle } from '@/app/layouts/root-layout'
import { RouteErrorScreen } from '@/app/route-error-screen'
import {
  redirectSignedInAdministrator,
  requireAdministratorSession,
  requireOpenEvent,
  requireParticipantSession,
} from '@/app/route-guards'
import NotFoundPage from '@/pages/not-found-page'
import EntryPage from '@/pages/participant/entry-page'
import HomePage from '@/pages/participant/home-page'
import QrJoinPage from '@/pages/participant/qr-join-page'
import { paths } from '@/shared/config/paths'

// 화면 주소표 (계획 문서 5장). 가드는 loader에서 redirect를 던져 화면을 그리기 전에 돌려보낸다.
// 처음 들어오는 화면(입장·QR 입장·사람별 사진)만 바로 불러오고, 나머지는 처음 열 때 따로 불러온다(lazy, 8단계 결정).

// 탭 제목을 붙이는 짧은 도구
function titled(title: string): RouteHandle {
  return { title }
}

// 화면 파일을 처음 열 때 불러오는 lazy 라우트로 바꾼다(기본 내보내기 컴포넌트 사용)
function lazyPage(
  importPage: () => Promise<{ default: React.ComponentType }>,
): RouteObject['lazy'] {
  return async () => ({ Component: (await importPage()).default })
}

const participantRoutes: RouteObject[] = [
  { index: true, Component: EntryPage, handle: titled('입장') },
  {
    path: 'expired',
    lazy: lazyPage(() => import('@/pages/participant/session-expired-page')),
    handle: titled('입장 시간 만료'),
  },
  {
    path: 'e/:code',
    children: [
      { index: true, Component: QrJoinPage, handle: titled('입장 중') },
      {
        // 이 아래 화면은 이 행사에 입장해 있어야 한다
        loader: requireParticipantSession,
        children: [
          {
            path: 'preparing',
            lazy: lazyPage(() => import('@/pages/participant/preparing-page')),
            handle: titled('사진 정리 중'),
          },
          {
            // 이 아래 화면은 행사가 공개(open)돼 있어야 한다
            loader: requireOpenEvent,
            children: [
              { path: 'home', Component: HomePage, handle: titled('사람별 사진') },
              {
                path: 'all',
                lazy: lazyPage(() => import('@/pages/participant/all-photos-page')),
                handle: titled('전체 사진'),
              },
              {
                path: 'camera',
                lazy: lazyPage(() => import('@/pages/participant/camera-page')),
                handle: titled('셀카로 찾기'),
              },
              {
                path: 'candidates',
                lazy: lazyPage(() => import('@/pages/participant/candidates-page')),
                handle: titled('후보 선택'),
              },
              {
                path: 'photos',
                lazy: lazyPage(() => import('@/pages/participant/my-photos-page')),
                handle: titled('내 사진'),
              },
            ],
          },
        ],
      },
    ],
  },
]

const administratorRoutes: RouteObject[] = [
  { index: true, loader: () => redirect(paths.administratorEvents) },
  {
    path: 'events',
    lazy: lazyPage(() => import('@/pages/admin/events-page')),
    handle: titled('최근 행사'),
  },
  {
    path: 'events/new',
    lazy: lazyPage(() => import('@/pages/admin/event-create-page')),
    handle: titled('새 행사 만들기'),
  },
  {
    path: 'events/:eventId/upload',
    lazy: lazyPage(() => import('@/pages/admin/event-upload-page')),
    handle: titled('사진 올리기'),
  },
  {
    path: 'events/:eventId/processing',
    lazy: lazyPage(() => import('@/pages/admin/event-processing-page')),
    handle: titled('사진 정리 중'),
  },
  {
    path: 'events/:eventId/result',
    lazy: lazyPage(() => import('@/pages/admin/event-result-page')),
    handle: titled('분류 결과'),
  },
  {
    path: 'events/:eventId/persons/:personId',
    lazy: lazyPage(() => import('@/pages/admin/person-folder-page')),
    handle: titled('사람 폴더 사진'),
  },
]

// 개발 서버에서만 여는 화면. import.meta.env.DEV가 false인 빌드에서는 코드째 빠진다
const developmentRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/ui',
        lazy: lazyPage(() => import('@/pages/dev/ui-gallery-page')),
        handle: titled('컴포넌트 모음'),
      },
    ]
  : []

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    ErrorBoundary: RouteErrorScreen,
    children: [
      {
        Component: ParticipantLayout,
        // 레이아웃 안쪽에 오류 경계를 한 겹 더 두어, 화면 오류가 나도 PC 머리글은 남긴다
        children: [{ ErrorBoundary: RouteErrorScreen, children: participantRoutes }],
      },
      {
        // ⑥ 크게 보기는 참가자 레이아웃 밖의 어두운 전체 화면
        path: 'e/:code/photos/:photoId',
        loader: requireOpenEvent,
        lazy: lazyPage(() => import('@/pages/participant/photo-viewer-page')),
        ErrorBoundary: RouteErrorScreen,
        handle: titled('사진 크게 보기'),
      },
      {
        path: 'admin/login',
        loader: redirectSignedInAdministrator,
        lazy: lazyPage(() => import('@/pages/admin/administrator-login-page')),
        handle: titled('관리자 로그인'),
      },
      {
        path: 'admin',
        loader: requireAdministratorSession,
        // 관리자 레이아웃(왼쪽 메뉴·☰ 시트)도 관리자 화면을 열 때 받는다
        lazy: async () => ({
          Component: (await import('@/app/layouts/administrator-layout')).AdministratorLayout,
        }),
        children: [{ ErrorBoundary: RouteErrorScreen, children: administratorRoutes }],
      },
      ...developmentRoutes,
      { path: '*', Component: NotFoundPage, handle: titled('페이지를 찾을 수 없음') },
    ],
  },
])
