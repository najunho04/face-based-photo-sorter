"""얼굴 묶기 계산 테스트 (DB 없음). 사람마다 기준 벡터를 하나 두고, 그 주변에 조금씩 흔든 얼굴 벡터를 만듦."""

import numpy

from clustering.face_grouping import group_faces
from database.face_contract import EMBEDDING_DIMENSION


def build_person_base(seed: int) -> numpy.ndarray:
    base = numpy.random.default_rng(seed).normal(size=EMBEDDING_DIMENSION)
    return base / numpy.linalg.norm(base)


def build_face(base: numpy.ndarray, seed: int, noise: float = 0.3) -> numpy.ndarray:
    # 같은 사람의 다른 사진: 기준 벡터에 작은 잡음 → 서로 코사인 유사도 0.9 안팎
    # 다른 사람끼리는 무작위 512차원이라 거의 직교 (유사도 0 근처)
    jitter = numpy.random.default_rng(seed).normal(size=EMBEDDING_DIMENSION) * noise / numpy.sqrt(EMBEDDING_DIMENSION)
    face = base + jitter
    return face / numpy.linalg.norm(face)


def test_no_faces_makes_no_groups():
    assert group_faces(numpy.empty((0, EMBEDDING_DIMENSION)), [], numpy.empty(0)) == []


def test_single_face_becomes_its_own_person():
    groups = group_faces(numpy.stack([build_person_base(1)]), [10], numpy.array([100]))

    assert len(groups) == 1
    assert groups[0].face_indexes == [0]
    assert groups[0].representative_index == 0
    assert groups[0].photo_count == 1


def test_faces_of_same_person_are_grouped_and_others_separated():
    alice, bob = build_person_base(1), build_person_base(2)
    embeddings = numpy.stack([
        build_face(alice, 11), build_face(bob, 21), build_face(alice, 12), build_face(bob, 22), build_face(alice, 13),
    ])

    groups = group_faces(embeddings, [1, 1, 2, 2, 3], numpy.full(5, 100))

    assert [group.face_indexes for group in groups] == [[0, 2, 4], [1, 3]]


def test_groups_are_ordered_by_photo_count_so_labels_are_stable():
    # 폴더명 user1은 사진이 가장 많은 사람. 얼굴 수가 아니라 서로 다른 사진 수로 셈
    alice, bob = build_person_base(1), build_person_base(2)
    embeddings = numpy.stack([
        build_face(alice, 11), build_face(alice, 12), build_face(bob, 21), build_face(bob, 22), build_face(bob, 23),
    ])
    # 앨리스 얼굴 2개는 같은 사진(1)에 잡힘 → 사진 1장, 밥은 사진 3장
    groups = group_faces(embeddings, [1, 1, 2, 3, 4], numpy.full(5, 100))

    assert [group.photo_count for group in groups] == [3, 1]
    assert groups[0].face_indexes == [2, 3, 4]


def test_centroid_is_normalized_mean():
    alice = build_person_base(1)
    embeddings = numpy.stack([build_face(alice, seed) for seed in range(4)])

    [group] = group_faces(embeddings, [1, 2, 3, 4], numpy.full(4, 100))

    expected = embeddings.mean(axis=0)
    expected /= numpy.linalg.norm(expected)
    assert numpy.isclose(numpy.linalg.norm(group.centroid), 1.0)
    assert numpy.allclose(group.centroid, expected)


def test_representative_is_closest_to_centroid_among_large_faces():
    alice = build_person_base(1)
    closest_face = build_face(alice, 1, noise=0.05)
    embeddings = numpy.stack([closest_face, build_face(alice, 2), build_face(alice, 3)])

    # 가장 닮은 얼굴(0번)이 너무 작으면 대표에서 빠지고, 나머지 큰 얼굴 중 더 닮은 얼굴이 대표
    [group] = group_faces(embeddings, [1, 2, 3], numpy.array([10, 100, 90]))
    similarities = embeddings @ group.centroid
    expected_index = 1 if similarities[1] >= similarities[2] else 2
    assert group.representative_index == expected_index

    # 크기가 비슷하면 가장 닮은 얼굴이 대표
    [group] = group_faces(embeddings, [1, 2, 3], numpy.array([80, 100, 90]))
    assert group.representative_index == 0


def test_threshold_controls_how_far_faces_can_be_merged():
    # 거의 직교하는 두 벡터를 더한 방향 → 원래 벡터와 유사도 약 0.7 (거리 약 0.3)
    # 기준 거리 0.4면 같은 사람, 0.2면 다른 사람
    first = build_person_base(1)
    second = first + build_person_base(2)
    second /= numpy.linalg.norm(second)
    embeddings = numpy.stack([first, second])

    assert len(group_faces(embeddings, [1, 2], numpy.full(2, 100), distance_threshold=0.4)) == 1
    assert len(group_faces(embeddings, [1, 2], numpy.full(2, 100), distance_threshold=0.2)) == 2
