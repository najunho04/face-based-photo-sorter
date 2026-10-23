import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/api-error'
import { getErrorMessage } from '@/shared/api/error-messages'

describe('getErrorMessage', () => {
  it('아는 오류 코드는 프론트가 정한 문구를 쓴다', () => {
    const error = new ApiError({
      code: 'FACE_NOT_DETECTED',
      status: 422,
      serverMessage: 'face not detected',
    })

    expect(getErrorMessage(error)).toBe(
      '얼굴이 잘 보이지 않아요. 밝은 곳에서 정면으로 다시 찍어주세요.',
    )
  })

  it('프론트가 모르는 코드는 서버 문구를 쓴다', () => {
    const error = new ApiError({
      code: 'SOMETHING_NEW',
      status: 400,
      serverMessage: '서버가 새로 만든 오류예요.',
    })

    expect(getErrorMessage(error)).toBe('서버가 새로 만든 오류예요.')
  })

  it('모르는 코드에 서버 문구도 없으면 일반 문구를 쓴다', () => {
    const error = new ApiError({ code: 'SOMETHING_NEW', status: 400, serverMessage: null })

    expect(getErrorMessage(error)).toBe('문제가 생겼어요. 잠시 후 다시 시도해주세요.')
  })

  it('ApiError가 아닌 오류도 일반 문구를 쓴다', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('문제가 생겼어요. 잠시 후 다시 시도해주세요.')
  })

  it('네트워크 오류는 연결 확인을 안내한다', () => {
    const error = new ApiError({ code: 'NETWORK_ERROR', status: null, serverMessage: null })

    expect(getErrorMessage(error)).toBe(
      '인터넷에 연결되지 않았어요. 연결을 확인하고 다시 시도해주세요.',
    )
  })
})
