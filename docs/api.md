# API 명세

> 출처: Notion [API 명세](https://app.notion.com/p/API-4020ea4df7858001a2a6f14efcfd123d) (2026-10-26 동기화). 원본이 바뀌면 이 문서도 갱신.
> **구현 중 정한 규칙**(아래 "구현 규칙" 줄)은 2026-10-24·25 추가, Notion "5. 구현 규칙"에도 반영 (2026-10-26).

## 공통

### 인증

| 대상 | 방식 |
|---|---|
| 관리자 | 로그인 응답 JWT를 `Authorization: Bearer <token>` (role=`admin`) |
| 참가자 | 인증코드 입장 응답 JWT를 같은 방식 (role=`participant`, `eventId` 포함) |

참가자 토큰의 `eventId`와 경로의 `{eventId}`가 다르면 `FORBIDDEN`.

### 응답 형식

```json
// 성공
{ "success": true, "data": { ... }, "error": null }
// 실패
{ "success": false, "data": null,
  "error": { "code": "EVENT_NOT_FOUND", "message": "행사를 찾을 수 없습니다." } }
```

- 프론트는 `success`로 분기, 실패 시 `error.code`로 분기. `message`는 화면에 그대로 노출 가능한 문구.
- 이미지 URL은 모두 Object Storage **Pre-signed URL** (기본 3600초 만료 — 장시간 열람 시 이미지 깨짐 방지).
- 필드명은 camelCase.

## 엔드포인트 목록

| # | 이름 | Method | Endpoint | 인증 |
|---|---|---|---|---|
| 1 | 관리자 로그인 | POST | `/api/admin/login` | 없음 |
| 2 | 행사 생성 | POST | `/api/admin/events` | 관리자 |
| 3 | 사진 업로드 | POST | `/api/admin/events/{eventId}/photos` | 관리자 |
| 4 | 업로드 완료 | POST | `/api/admin/events/{eventId}/upload-complete` | 관리자 |
| 5 | 진행 상황 조회 | GET | `/api/admin/events/{eventId}` | 관리자 |
| 6 | 참가자 입장 | POST | `/api/events/join` | 없음 |
| 7 | 전체 사진 보기 | GET | `/api/events/{eventId}/photos?page=1&size=30` | 참가자 |
| 8 | 셀카 매칭 | POST | `/api/events/{eventId}/match` | 참가자 |
| 9 | 사람 폴더 사진 | GET | `/api/events/{eventId}/persons/{personId}/photos` | 관리자·참가자 |
| 10 | 사람 폴더 목록 | GET | `/api/events/{eventId}/persons?minPhotos=2` | 관리자·참가자 |

## 상세

### 1. 관리자 로그인 `POST /api/admin/login`
데모에선 계정 1개를 설정 파일에 고정.
```json
// req
{ "loginId": "admin", "password": "<비밀번호>" }
// res.data
{ "accessToken": "eyJhbGciOi...", "expiresIn": 3600 }
```
에러: `LOGIN_FAILED`, `INVALID_REQUEST`

### 2. 행사 생성 `POST /api/admin/events`
인증코드 발급. 프론트가 `accessCode`로 QR을 그림.
```json
// req
{ "name": "2026 가을 축제" }
// res.data
{ "eventId": 1, "name": "2026 가을 축제", "accessCode": "A7K2Q9", "status": "uploading" }
```
에러: `INVALID_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`

구현 규칙: `name`은 앞뒤 공백 제거 후 1~100자. `accessCode`는 대문자+숫자 6자리, 다른 행사와 겹치지 않게 생성.

### 3. 사진 업로드 `POST /api/admin/events/{eventId}/photos`
`multipart/form-data`, 필드 `files` (여러 장). NAS 저장 + `photos` 행 생성(`status=uploaded`). 프론트는 요청당 3~5장씩 나눠 전송. 파일 단위 실패는 `failed`에 담고 나머지는 성공 처리.
```json
// res.data
{ "uploaded": 4, "failed": [ { "fileName": "IMG_0013.heic", "reason": "UNSUPPORTED_FILE" } ] }
```
에러: `EVENT_NOT_FOUND`, `INVALID_STATUS`(완료 후 추가 업로드), `UNSUPPORTED_FILE`, `FILE_TOO_LARGE`

구현 규칙: `UNSUPPORTED_FILE`·`FILE_TOO_LARGE`는 요청 전체 실패가 아니라 `failed[].reason`으로 옴. 사진 1장 최대 20MB. jpg·png 여부는 확장자가 아니라 파일 내용으로 판단. 파일 이름은 경로를 뺀 마지막 부분만 쓰고, 같은 행사에 같은 이름을 다시 올리면 NAS 파일을 덮어씀.

### 4. 업로드 완료 `POST /api/admin/events/{eventId}/upload-complete`
요청 바디 없음. `events.status`를 `extracting`으로 바꾸고 이후 업로드 차단.
```json
// res.data
{ "eventId": 1, "status": "extracting", "totalPhotos": 100 }
```
에러: `EVENT_NOT_FOUND`, `INVALID_STATUS`(이미 완료, 또는 올린 사진이 0장)

### 5. 진행 상황 조회 `GET /api/admin/events/{eventId}`
관리자 화면이 몇 초마다 폴링. `status=open`이면 분류 완료.
```json
{
  "eventId": 1, "name": "2026 가을 축제", "accessCode": "A7K2Q9",
  "status": "extracting",            // uploading / extracting / clustering / open
  "photos": { "total": 100, "extracted": 63, "processing": 4, "failed": 1 },
  "personCount": null,               // open 이후 분류된 사람 수
  "failedPhotos": [ { "photoId": 13, "fileName": "IMG_0013.jpg" } ]
}
```
에러: `EVENT_NOT_FOUND`

구현 규칙: `photos.total`은 아직 워커가 가져가지 않은 `uploaded` 사진도 포함.

### 6. 참가자 입장 `POST /api/events/join`
인증코드(QR 값 또는 텍스트)로 참가자 토큰 발급. `status≠open`이면 프론트가 "사진 정리 중" 화면 표시.
```json
// req
{ "accessCode": "A7K2Q9" }
// res.data
{ "accessToken": "eyJhbGciOi...", "eventId": 1, "eventName": "2026 가을 축제", "status": "open" }
```
에러: `INVALID_ACCESS_CODE`, `INVALID_REQUEST`

구현 규칙: `accessCode`의 공백·하이픈은 무시하고 대소문자를 구분하지 않음 (`a7k-2q9` = `A7K2Q9`, 프론트와 같은 규칙).

### 7. 전체 사진 보기 `GET /api/events/{eventId}/photos`
쿼리: `page`(기본 1), `size`(기본 30).
```json
{
  "page": 1, "size": 30, "total": 100,
  "photos": [ { "photoId": 1, "fileName": "IMG_0001.jpg", "url": "https://kr.object.ncloudstorage.com/...", "expiresIn": 3600 } ]
}
```
에러: `EVENT_NOT_FOUND`, `FORBIDDEN`

구현 규칙: 참가자 토큰만 (관리자 토큰은 `FORBIDDEN`). `status≠open`이면 `EVENT_NOT_READY`. `page`는 1 이상, `size`는 1~100 (벗어나면 `INVALID_REQUEST`). 사진 id(업로드) 순서. Object Storage에 보관된 사진만 목록·`total`에 포함 (`failed`·보관 누락 사진 제외).

### 8. 셀카 매칭 `POST /api/events/{eventId}/match`
`multipart/form-data`, 필드 `selfie`. 웹서버가 동기로 얼굴 검출·벡터 추출 → `persons.centroid`와 코사인 유사도 → 기준값 이상 상위 0~3개.
```json
{
  "candidates": [
    { "personId": 3, "label": "user3", "photoCount": 12,
      "repFace": { "url": "https://...", "bbox": { "x": 120, "y": 80, "w": 96, "h": 96 } } }
  ]
}
```
- 대표 얼굴은 원본 URL + `bbox` → 프론트가 CSS로 크롭
- 유사도 점수는 응답에서 **제외** (확률로 오해 방지). 유사도 높은 순 정렬
- 빈 배열이면 "찾지 못했어요, 다시 찍어주세요"

에러: `EVENT_NOT_READY`, `FACE_NOT_DETECTED`, `UNSUPPORTED_FILE`, `FILE_TOO_LARGE`

### 9. 사람 폴더 사진 `GET /api/events/{eventId}/persons/{personId}/photos`
```json
{
  "personId": 3, "label": "user3", "total": 12,
  "photos": [
    { "photoId": 7, "fileName": "IMG_0007.jpg", "url": "https://...",
      "downloadUrl": "https://...?response-content-disposition=attachment", "expiresIn": 3600 }
  ]
}
```
"전체 다운로드"는 프론트가 `downloadUrl`을 차례로 받음 (ZIP 없음).
에러: `EVENT_NOT_READY`, `PERSON_NOT_FOUND`, `FORBIDDEN`

구현 규칙: 사진 id 순서, 한 사진에 같은 사람 얼굴이 여러 개여도 한 번만. `downloadUrl`은 `Content-Disposition: attachment; filename*=UTF-8''<파일 이름>`으로 내려와 원래 이름으로 저장됨. 다른 행사의 `personId`는 `PERSON_NOT_FOUND`.

### 10. 사람 폴더 목록 `GET /api/events/{eventId}/persons`
쿼리: `minPhotos`(선택, 기본 1) — 사진 수가 이 값 이상인 폴더만 (배경에 한 번 찍힌 사람 숨김). `photoCount` 내림차순.
```json
{
  "total": 48,
  "persons": [
    { "personId": 3, "label": "user3", "photoCount": 12,
      "repFace": { "url": "https://...", "bbox": { "x": 120, "y": 80, "w": 96, "h": 96 } } }
  ]
}
```
에러: `EVENT_NOT_READY`, `EVENT_NOT_FOUND`, `FORBIDDEN`

구현 규칙: `minPhotos`는 1 이상 (0 이하면 `INVALID_REQUEST`). `photoCount`는 보관된 서로 다른 사진 수 (API 9의 `total`과 같음), 같으면 `personId` 순. `repFace`는 대표 얼굴이 없거나 그 사진이 보관되지 않았으면 `null` (API 8도 같은 규칙).

## 에러코드

| code | HTTP | 범위 | 의미 |
|---|---|---|---|
| `INVALID_REQUEST` | 400 | 공통 | 필수값 누락, 형식 오류 |
| `UNAUTHORIZED` | 401 | 인증 | 토큰 없음·만료 (로그인·입장 제외 전체) |
| `LOGIN_FAILED` | 401 | 인증 | 관리자 아이디/비밀번호 불일치 |
| `FORBIDDEN` | 403 | 인증 | 참가자가 관리자 API 호출, 다른 행사 토큰 |
| `INVALID_ACCESS_CODE` | 404 | 인증 | 존재하지 않는 인증코드 |
| `EVENT_NOT_FOUND` | 404 | 행사 | 행사 없음 |
| `PERSON_NOT_FOUND` | 404 | 매칭 | 존재하지 않는 사람 폴더 |
| `EVENT_NOT_READY` | 409 | 행사 | 아직 분류 중 (`status≠open`) |
| `INVALID_STATUS` | 409 | 행사 | 현재 상태에서 불가 (완료 후 업로드, 완료 중복 호출) |
| `FILE_TOO_LARGE` | 413 | 파일 | 파일 용량 초과 |
| `UNSUPPORTED_FILE` | 415 | 파일 | jpg·png 외 형식 |
| `FACE_NOT_DETECTED` | 422 | 매칭 | 셀카에서 얼굴 없음 → 재촬영 안내 |
| `INTERNAL_ERROR` | 500 | 서버 | 서버 내부 오류 |

## 호출 흐름

- **관리자**: 1 로그인 → 2 행사 생성 → 3 업로드(반복) → 4 업로드 완료 → 5 폴링(`open`까지) → 10 폴더 목록 → 9 폴더 사진
- **참가자**: 6 입장 → (`open`) 10 폴더 목록 → 9 폴더 사진 / 8 셀카 매칭 → "이게 나예요" → 9 / 7 전체 사진 둘러보기

## 필수 범위 제외 (추후 후보)

- 검수: 사람 폴더 합치기·나누기
- ZIP 묶음 다운로드
- 관리자 행사 목록 조회
