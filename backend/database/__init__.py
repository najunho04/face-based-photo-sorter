"""DB 공용 패키지 (A·B 공용).

- connection.py   : 엔진·세션 만들기 (API 서버는 get_database_session, 워커는 database_session_scope)
- models.py       : 테이블 4개(events, photos, persons, faces)에 대응하는 SQLAlchemy 모델
- face_contract.py: faces에 넣을 bbox·embedding 형식 검증 (A의 Mock과 B의 워커가 같이 지킬 규칙)
- migrations/     : 스키마의 기준. 모델을 바꾸려면 SQL과 docs/erd.md를 먼저 바꿀 것
"""
