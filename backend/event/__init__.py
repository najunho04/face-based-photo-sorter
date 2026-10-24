"""행사 도메인: 관리자 API 2~5 (행사 생성, 사진 업로드, 업로드 완료, 진행 상황).

- photo_storage.py : NAS 저장 (파일 이름 정리, 이미지 형식 확인)
- service.py       : 처리 순서와 상태 규칙 (uploading에서만 업로드, 완료는 한 번)
- router.py        : HTTP 요청·응답 모양
"""
