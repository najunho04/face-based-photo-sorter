import { describe, expect, it, vi } from 'vitest'
import { calculateResizedDimensions, drawResizedJpeg } from '@/shared/lib/image-resize'

describe('calculateResizedDimensions (긴 변 기준으로 줄일 크기)', () => {
  it('가로 사진은 가로를 최대 길이로 맞추고 비율을 지킨다', () => {
    expect(calculateResizedDimensions(4032, 3024, 1024)).toEqual({ width: 1024, height: 768 })
  })

  it('세로 사진은 세로를 최대 길이로 맞춘다', () => {
    expect(calculateResizedDimensions(3024, 4032, 1024)).toEqual({ width: 768, height: 1024 })
  })

  it('이미 작은 사진은 키우지 않는다', () => {
    expect(calculateResizedDimensions(800, 600, 1024)).toEqual({ width: 800, height: 600 })
  })

  it('소수점은 반올림하고 0이 되지 않게 한다', () => {
    expect(calculateResizedDimensions(3000, 1001, 2000)).toEqual({ width: 2000, height: 667 })
    expect(calculateResizedDimensions(5000, 1, 1000)).toEqual({ width: 1000, height: 1 })
  })
})

describe('drawResizedJpeg (줄여서 JPG로 만들기)', () => {
  // 브라우저 캔버스 흉내: 그리기는 기록만 하고, JPG 만들기는 정해진 결과를 돌려준다
  function fakeCanvas(blobResult: Blob | null) {
    const createdCanvases: HTMLCanvasElement[] = []
    const realCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation(
      (tagName: string, options?: ElementCreationOptions) => {
        const element = realCreateElement(tagName, options)
        if (tagName === 'canvas') createdCanvases.push(element as HTMLCanvasElement)
        return element
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(blobResult),
    )
    return createdCanvases
  }

  const source = { source: {} as CanvasImageSource, width: 4032, height: 3024 }

  it('JPG를 만든 뒤 캔버스 크기를 0으로 줄여 메모리를 바로 놓아준다(사파리는 캔버스 메모리를 늦게 회수해 한도를 넘김)', async () => {
    const createdCanvases = fakeCanvas(new Blob(['jpg'], { type: 'image/jpeg' }))

    await drawResizedJpeg(source, 2000)

    expect(createdCanvases).toHaveLength(1)
    expect([createdCanvases[0].width, createdCanvases[0].height]).toEqual([0, 0])
  })

  it('JPG를 만들지 못해도 캔버스는 놓아준다', async () => {
    const createdCanvases = fakeCanvas(null)

    await expect(drawResizedJpeg(source, 2000)).rejects.toThrow()

    expect([createdCanvases[0].width, createdCanvases[0].height]).toEqual([0, 0])
  })
})
