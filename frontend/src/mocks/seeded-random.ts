// 씨앗값(seed)이 같으면 항상 같은 순서로 나오는 난수. 가짜 사진·사람 배치를 새로고침해도 똑같이 만들려고 쓴다.

/** 0 이상 1 미만의 수를 돌려주는 함수 */
export type RandomNumberGenerator = () => number

// mulberry32 알고리즘: 짧고 빠르며 화면용 가짜 데이터에는 충분히 고르게 섞인다
export function createSeededRandom(seed: number): RandomNumberGenerator {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let mixed = state
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}

// minimum 이상 maximum 이하의 정수
export function randomInteger(
  random: RandomNumberGenerator,
  minimum: number,
  maximum: number,
): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1))
}

// 목록에서 하나를 고른다
export function pickRandom<Item>(random: RandomNumberGenerator, items: readonly Item[]): Item {
  return items[Math.floor(random() * items.length)]
}

// 가중치에 비례해 위치(index)를 고른다. 가중치가 클수록 자주 뽑힌다
export function pickWeightedIndex(
  random: RandomNumberGenerator,
  weights: readonly number[],
): number {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  let remaining = random() * totalWeight
  for (let index = 0; index < weights.length; index += 1) {
    remaining -= weights[index]
    if (remaining < 0) return index
  }
  return weights.length - 1
}

// 배열을 제자리에서 섞는다(Fisher–Yates)
export function shuffleInPlace<Item>(random: RandomNumberGenerator, items: Item[]): Item[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }
  return items
}
