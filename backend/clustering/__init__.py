"""분류 도메인 (처리 3): 행사의 얼굴(faces)을 같은 사람끼리 묶어 사람 폴더(persons)를 만듦.

- face_grouping.py : 벡터만 보고 묶는 순수 계산 (DB 없음) — 계층적 군집, centroid, 대표 얼굴
- service.py       : 행사 1개 분류해서 persons 저장, faces.person_id 채우기 (다시 실행해도 안전)
- scheduler.py     : 웹서버 백그라운드 작업 — 멈춘 사진 복구(5분), 추출 끝난 행사 분류 시작 → 보관 → open
"""
