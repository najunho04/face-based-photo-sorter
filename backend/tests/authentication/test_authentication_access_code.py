"""인증코드 정규화 테스트: 입력·QR 값이 달라도 같은 코드면 같은 값으로 맞춰지는지 (DB 불필요)."""

import pytest

from authentication.access_code import normalize_access_code


@pytest.mark.parametrize("raw_access_code", ["A7K2Q9", "a7k2q9", " A7K2Q9 ", "A7K-2Q9", "a7k 2q9"])
def test_normalize_access_code_removes_spaces_and_hyphens_and_uppercases(raw_access_code):
    # 프론트 normalizeAccessCode와 같은 규칙: 공백·하이픈 제거 + 대문자
    assert normalize_access_code(raw_access_code) == "A7K2Q9"


def test_normalize_access_code_of_only_spaces_is_empty():
    assert normalize_access_code(" - ") == ""
