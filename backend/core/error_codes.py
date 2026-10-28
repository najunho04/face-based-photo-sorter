from enum import Enum


class ErrorCode(Enum):
    # docs/api.md 에러코드 표와 1:1. 새 코드는 문서에 먼저 추가한 뒤 여기에 추가
    # 값: (HTTP 상태, 화면에 그대로 띄울 기본 문구)
    INVALID_REQUEST = (400, "요청 형식이 올바르지 않습니다.")
    UNAUTHORIZED = (401, "로그인이 필요하거나 인증이 만료되었습니다.")
    LOGIN_FAILED = (401, "아이디 또는 비밀번호가 일치하지 않습니다.")
    FORBIDDEN = (403, "접근 권한이 없습니다.")
    INVALID_ACCESS_CODE = (404, "존재하지 않는 인증코드입니다.")
    EVENT_NOT_FOUND = (404, "행사를 찾을 수 없습니다.")
    PERSON_NOT_FOUND = (404, "사람 폴더를 찾을 수 없습니다.")
    EVENT_NOT_READY = (409, "사진을 정리하는 중입니다. 잠시 후 다시 시도해 주세요.")
    INVALID_STATUS = (409, "현재 행사 상태에서는 할 수 없는 요청입니다.")
    FILE_TOO_LARGE = (413, "파일 용량이 너무 큽니다.")
    UNSUPPORTED_FILE = (415, "jpg, png 파일만 올릴 수 있습니다.")
    FACE_NOT_DETECTED = (422, "얼굴을 찾지 못했어요. 다시 찍어 주세요.")
    INTERNAL_ERROR = (500, "서버 오류가 발생했습니다.")

    @property
    def code(self) -> str:
        # 응답 error.code에 들어갈 문자열 (프론트 분기용)
        return self.name

    @property
    def http_status(self) -> int:
        return self.value[0]

    @property
    def default_message(self) -> str:
        return self.value[1]


class ApplicationError(Exception):
    # 도메인 코드에서 raise하면 core.responses의 핸들러가 공통 실패 응답으로 바꿔 줌
    def __init__(self, error_code: ErrorCode, message: str | None = None):
        self.error_code = error_code
        self.message = message or error_code.default_message
        super().__init__(self.message)
