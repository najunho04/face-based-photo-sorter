import re

# 공백·하이픈은 사람이 읽기 쉽게 끊어 쓴 것일 뿐이라 코드에서 뺌
ACCESS_CODE_SEPARATOR_PATTERN = re.compile(r"[\s-]")


def normalize_access_code(access_code: str) -> str:
    # 프론트 normalizeAccessCode와 같은 규칙(공백·하이픈 제거 + 대문자). "a7k-2q9"도 "A7K2Q9"로 찾게 함
    # 행사 생성(API 2)에서 코드를 만들 때도 이 모양(대문자·구분자 없음)으로 저장해야 함
    return ACCESS_CODE_SEPARATOR_PATTERN.sub("", access_code).upper()
