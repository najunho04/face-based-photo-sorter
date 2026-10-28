from core.error_codes import ApplicationError, ErrorCode

# docs/api.md 에러코드 표와 1:1로 맞아야 하는 값 (코드 → HTTP 상태)
EXPECTED_HTTP_STATUS_BY_CODE = {
    "INVALID_REQUEST": 400,
    "UNAUTHORIZED": 401,
    "LOGIN_FAILED": 401,
    "FORBIDDEN": 403,
    "INVALID_ACCESS_CODE": 404,
    "EVENT_NOT_FOUND": 404,
    "PERSON_NOT_FOUND": 404,
    "EVENT_NOT_READY": 409,
    "INVALID_STATUS": 409,
    "FILE_TOO_LARGE": 413,
    "UNSUPPORTED_FILE": 415,
    "FACE_NOT_DETECTED": 422,
    "INTERNAL_ERROR": 500,
}


def test_error_codes_match_api_document_exactly():
    # 문서에 없는 코드가 생기거나 문서 코드가 빠지면 실패해야 함
    actual_http_status_by_code = {error_code.code: error_code.http_status for error_code in ErrorCode}
    assert actual_http_status_by_code == EXPECTED_HTTP_STATUS_BY_CODE


def test_every_error_code_has_user_facing_message():
    # message는 프론트가 화면에 그대로 띄우므로 비어 있으면 안 됨
    for error_code in ErrorCode:
        assert error_code.default_message.strip()


def test_application_error_uses_default_message_unless_overridden():
    default_error = ApplicationError(ErrorCode.EVENT_NOT_FOUND)
    custom_error = ApplicationError(ErrorCode.EVENT_NOT_FOUND, message="3번 행사가 없습니다.")

    assert default_error.message == ErrorCode.EVENT_NOT_FOUND.default_message
    assert custom_error.message == "3번 행사가 없습니다."
