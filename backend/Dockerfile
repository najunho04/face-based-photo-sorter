# API 서버·워커 이미지. 같은 코드에서 시작 명령만 달라서 Dockerfile 하나에 target 2개로 둠
#   docker build --target api    -t photo-sorter-api .      (backend/에서)
#   docker build --target worker -t photo-sorter-worker .
# 설정은 이미지에 넣지 않고 실행할 때 --env-file로 넘김 (.env는 .dockerignore로 제외)
# 자세한 배포 순서: docs/deployment.md

# --- 공통 바탕: 파이썬 + OpenCV가 쓰는 시스템 라이브러리 ---
FROM python:3.12-slim-bookworm AS base
# insightface가 opencv-python(GUI 포함판)도 함께 설치해서 libGL·glib가 없으면 import에서 실패함
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
# root가 아닌 계정으로 실행 (컨테이너가 뚫려도 피해를 줄임). uid는 NAS 권한을 맞출 때 쓰므로 고정
RUN useradd --create-home --uid 10001 app
WORKDIR /app

# --- 의존성: uv.lock 그대로 설치 (코드보다 먼저 복사해서, 코드만 바뀌면 이 단계는 캐시 재사용) ---
FROM base AS dependencies
COPY --from=ghcr.io/astral-sh/uv:0.11.14 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

# --- 얼굴 분석 모델: 빌드할 때 받아서 이미지에 넣음 ---
# 서버가 뜰 때마다 인터넷에서 받지 않아도 되고(NAT 불필요), 오토스케일링으로 새로 뜬 서버도 바로 시작함
# insightface가 받는 것과 같은 파일(buffalo_l, 288MB). 큰 파일이라 끊겨도 이어 받게 curl 재시도
FROM debian:bookworm-slim AS model
ARG MODEL_URL=https://github.com/deepinsight/insightface/releases/download/model-zoo/buffalo_l.zip
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl unzip \
    && curl -fL --retry 5 --retry-all-errors --retry-delay 5 -C - -o /tmp/buffalo_l.zip "$MODEL_URL" \
    && mkdir -p /models/models/buffalo_l \
    # 검출(det_10g)·벡터(w600k_r50)만 꺼냄: 코드가 쓰는 모듈만 (나이·성별·랜드마크 모델은 빼서 크기·시작 시간 절약)
    && unzip -j /tmp/buffalo_l.zip det_10g.onnx w600k_r50.onnx -d /models/models/buffalo_l \
    && rm -rf /tmp/buffalo_l.zip /var/lib/apt/lists/*

# --- 실행 공통: 의존성 + 모델 + 코드 ---
FROM base AS runtime
COPY --from=dependencies /app/.venv /app/.venv
# insightface 기본 모델 위치(~/.insightface)에 둠 → 코드 수정 없이 그대로 찾음
COPY --from=model --chown=app:app /models /home/app/.insightface
COPY --chown=app:app . .
# NAS는 서버에 NFS로 마운트한 폴더를 컨테이너 /nas로 연결해서 씀 (docker run -v /mnt/nas:/nas)
# HOME 고정: NAS 권한에 맞춰 --user로 실행 계정을 바꿔도 모델(~/.insightface)을 같은 곳에서 찾게 함
ENV PATH="/app/.venv/bin:$PATH" \
    HOME=/home/app \
    NAS_ROOT_PATH=/nas
USER app

# --- API 서버: API 1~10 + 분류 스케줄러 ---
FROM runtime AS api
EXPOSE 8000
# 로드밸런서가 보는 상태 확인 주소와 같음 (DB는 확인하지 않음)
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
# --proxy-headers: 로드밸런서 뒤에서 실제 접속 IP·프로토콜을 X-Forwarded-* 헤더로 받음
CMD ["uvicorn", "main:application", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

# --- 워커: 업로드된 사진에서 얼굴 추출 ---
# docker stop(SIGTERM)을 받으면 지금 사진만 끝내고 멈춤 (extraction/worker.py)
FROM runtime AS worker
CMD ["python", "-m", "extraction.worker"]
