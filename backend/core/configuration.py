from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # backend/.env(없으면 환경변수)에서 읽음. 필드명은 .env.example의 키를 소문자로 바꾼 것과 같음
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # DB
    postgres_db: str = "photo_sorter"
    postgres_user: str = "photo_sorter"
    postgres_password: str = "photo_sorter"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    # NAS: 로컬은 backend/nas, 운영은 /nas
    nas_root_path: str = "./nas"

    # 분류 스케줄러(멈춘 사진 복구, 분류 시작 → 보관 → open)를 API 서버 안에서 돌릴지
    clustering_scheduler_enabled: bool = True

    # 인증: 비밀키·관리자 계정은 기본값 없이 반드시 .env에서 받음 (실수로 기본값이 운영에 나가는 것 방지)
    jwt_secret_key: str
    admin_login_id: str
    admin_password: str
    access_token_expiration_seconds: int = 12 * 60 * 60   # 12시간: 행사 당일 업로드·열람 중 다시 로그인·입장하지 않게

    # NCP Object Storage (S3 호환)
    object_storage_endpoint: str = "https://kr.object.ncloudstorage.com"
    object_storage_region: str = "kr-standard"
    object_storage_bucket: str = ""
    object_storage_access_key: str = ""
    object_storage_secret_key: str = ""
    presigned_url_expiration_seconds: int = 3600

    @property
    def database_url(self) -> str:
        # SQLAlchemy가 psycopg(3) 드라이버로 접속하도록 드라이버명을 명시
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    # 요청마다 .env를 다시 읽지 않도록 한 번만 만들어 재사용 (테스트에선 cache_clear로 초기화)
    return Settings()
