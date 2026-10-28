# 얼굴 벡터를 같은 사람끼리 묶는 계산만 담당 (DB를 모름 → numpy 배열로 바로 테스트)
# 방법: 평균 연결(average linkage) 계층적 군집
#   - 가장 가까운 두 묶음을 계속 합치되, 두 묶음 사이 "모든 얼굴 쌍의 평균 코사인 거리"가 기준값을 넘으면 멈춤
#   - 사람 수를 미리 몰라도 되고(k-means와 다름), 한 쌍만 가까워도 붙어 버리는 사슬 현상(single linkage)이 적음
from dataclasses import dataclass

import numpy
from scipy.cluster.hierarchy import fcluster, linkage

# 같은 사람으로 묶는 최대 평균 코사인 거리 (= 1 - 유사도). Gallagher 589장(얼굴 1240개) 실험으로 정함
#   0.40~0.70은 정밀도 0.996으로 같고 재현율만 오름, 0.75부터 다른 사람이 섞여 정밀도 0.57로 급락
#   → 급락 지점에서 0.10 떨어진 0.65 (재현율 0.988, F1 0.992). clustering/experiments/evaluate_gallagher_clustering.py
DEFAULT_DISTANCE_THRESHOLD = 0.65
# 대표 얼굴 후보: 그 사람 얼굴 중 가장 큰 얼굴 면적의 이 비율 이상인 얼굴만 (작고 흐린 얼굴을 대표로 쓰지 않게)
REPRESENTATIVE_MINIMUM_AREA_RATIO = 0.5


@dataclass
class FaceGroup:
    # 사람 1명 = 얼굴 위치(입력 배열의 순번) 묶음
    face_indexes: list[int]
    centroid: numpy.ndarray          # 소속 얼굴 벡터 평균을 길이 1로 정규화 (매칭이 이 값과 비교)
    representative_index: int        # 대표 얼굴의 입력 순번
    photo_count: int                 # 서로 다른 사진 수 (한 사진에 두 번 잡혀도 1장)


def cluster_embeddings(embeddings: numpy.ndarray, distance_threshold: float) -> numpy.ndarray:
    """얼굴마다 묶음 번호를 돌려줌 (같은 번호 = 같은 사람). 번호 자체에는 의미 없음."""
    face_count = len(embeddings)
    if face_count == 0:
        return numpy.empty(0, dtype=int)
    if face_count == 1:
        return numpy.zeros(1, dtype=int)   # linkage는 2개 이상부터 계산 가능
    # metric="cosine": 1 - 코사인 유사도. 벡터가 이미 길이 1이라 각도만 비교됨
    merge_tree = linkage(embeddings, method="average", metric="cosine")
    # criterion="distance": 평균 거리가 기준값 이하인 합치기까지만 인정하고 나무를 자름
    return fcluster(merge_tree, t=distance_threshold, criterion="distance")


def normalized_mean(embeddings: numpy.ndarray) -> numpy.ndarray:
    mean = embeddings.mean(axis=0)
    return mean / numpy.linalg.norm(mean)


def choose_representative_index(face_indexes: list[int], embeddings: numpy.ndarray,
                                centroid: numpy.ndarray, face_areas: numpy.ndarray) -> int:
    # 1) 충분히 큰 얼굴만 후보 (크롭해서 보여줄 때 알아보기 쉬움)
    # 2) 그중 centroid와 가장 닮은 얼굴 = 그 사람의 "평균적인" 얼굴 (옆모습·가린 얼굴이 뽑힐 가능성이 낮음)
    #    ERD에 검출 점수 컬럼이 없어서 이 두 기준만 씀
    largest_area = face_areas[face_indexes].max()
    candidates = [index for index in face_indexes
                  if face_areas[index] >= largest_area * REPRESENTATIVE_MINIMUM_AREA_RATIO]
    similarities = embeddings[candidates] @ centroid
    return candidates[int(numpy.argmax(similarities))]


def group_faces(
    embeddings: numpy.ndarray,
    photo_ids: list[int],
    face_areas: numpy.ndarray,
    distance_threshold: float = DEFAULT_DISTANCE_THRESHOLD,
) -> list[FaceGroup]:
    """얼굴들을 사람별로 묶음. 사진 수가 많은 사람부터 (같으면 먼저 나온 얼굴 순) → 폴더명 user1, user2 ... 순서.

    embeddings: (얼굴 수, 512) 길이 1 벡터, photo_ids·face_areas: 얼굴마다 사진 id, bbox 면적(w*h)
    한 번만 나온 사람도 폴더 1개가 됨 (숨기는 건 조회 API의 minPhotos가 담당)
    """
    embeddings = numpy.asarray(embeddings, dtype=numpy.float64)
    face_areas = numpy.asarray(face_areas, dtype=numpy.float64)
    cluster_numbers = cluster_embeddings(embeddings, distance_threshold)

    face_indexes_by_cluster: dict[int, list[int]] = {}
    for face_index, cluster_number in enumerate(cluster_numbers):
        face_indexes_by_cluster.setdefault(int(cluster_number), []).append(face_index)

    groups = []
    for face_indexes in face_indexes_by_cluster.values():
        centroid = normalized_mean(embeddings[face_indexes])
        groups.append(FaceGroup(
            face_indexes=face_indexes,
            centroid=centroid,
            representative_index=choose_representative_index(face_indexes, embeddings, centroid, face_areas),
            photo_count=len({photo_ids[index] for index in face_indexes}),
        ))
    # 같은 입력이면 항상 같은 폴더명이 나오도록 순서를 고정 (다시 분류해도 user1이 같은 사람)
    groups.sort(key=lambda group: (-group.photo_count, group.face_indexes[0]))
    return groups
