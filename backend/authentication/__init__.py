"""인증 도메인: 관리자 로그인(API 1), 참가자 입장(API 6).

- access_code.py : 인증코드 정규화 (입력·QR 값을 한 모양으로)
- service.py     : 로그인 확인·입장 처리 후 토큰 발급 (토큰 생성·검증 자체는 core.security)
- router.py      : HTTP 요청·응답 모양
"""
