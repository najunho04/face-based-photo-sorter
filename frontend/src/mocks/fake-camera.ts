import { getMockSettings } from '@/mocks/mock-settings'

// 개발용 가짜 카메라: 웹캠이 없는 PC에서도 촬영 → 검색 흐름을 확인할 수 있게,
// 패널에서 켜면 카메라 요청(getUserMedia)에 실제 카메라 대신 캔버스로 그린 움직이는 얼굴 영상을 돌려준다.

/** 가짜 영상 크기(세로로 긴 휴대폰 앞 카메라 비율) */
const fakeVideoWidth = 720
const fakeVideoHeight = 960
const framesPerSecond = 24

// 카메라 요청을 가로채도록 한 번만 설치한다. 가짜 카메라 설정이 꺼져 있으면 원래 카메라를 쓴다
export function installFakeCamera(): void {
  const mediaDevices = navigator.mediaDevices
  if (!mediaDevices?.getUserMedia) return
  const originalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices)

  mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    if (getMockSettings().useFakeCamera && constraints?.video) return createFakeCameraStream()
    return originalGetUserMedia(constraints)
  }
}

// 캔버스에 사람 얼굴을 그리고 조금씩 움직여 영상처럼 만든다
function createFakeCameraStream(): MediaStream {
  const canvas = document.createElement('canvas')
  canvas.width = fakeVideoWidth
  canvas.height = fakeVideoHeight
  const context = canvas.getContext('2d')!
  let frameNumber = 0

  const drawFrame = () => {
    const swayX = Math.sin(frameNumber / 18) * 12
    const swayY = Math.cos(frameNumber / 24) * 6
    const centerX = fakeVideoWidth / 2 + swayX
    const centerY = fakeVideoHeight * 0.45 + swayY

    // 방 배경
    const background = context.createLinearGradient(0, 0, 0, fakeVideoHeight)
    background.addColorStop(0, '#C7D2FE')
    background.addColorStop(1, '#E0E7FF')
    context.fillStyle = background
    context.fillRect(0, 0, fakeVideoWidth, fakeVideoHeight)
    // 몸·얼굴·머리·눈·입
    context.fillStyle = '#4F46E5'
    context.beginPath()
    context.roundRect(centerX - 220, centerY + 170, 440, 600, 160)
    context.fill()
    context.fillStyle = '#F9DCC4'
    context.beginPath()
    context.ellipse(centerX, centerY, 150, 190, 0, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#2B1B17'
    context.beginPath()
    context.ellipse(centerX, centerY - 40, 158, 170, 0, Math.PI, Math.PI * 2)
    context.fill()
    context.fillStyle = '#1E1B4B'
    for (const side of [-1, 1]) {
      context.beginPath()
      context.ellipse(centerX + side * 55, centerY + 10, 14, 18, 0, 0, Math.PI * 2)
      context.fill()
    }
    context.strokeStyle = '#1E1B4B'
    context.lineWidth = 8
    context.lineCap = 'round'
    context.beginPath()
    context.arc(centerX, centerY + 60, 55, Math.PI * 0.15, Math.PI * 0.85)
    context.stroke()
    // 가짜 카메라임을 알리는 표시
    context.fillStyle = 'rgba(17, 24, 39, 0.6)'
    context.fillRect(0, fakeVideoHeight - 70, fakeVideoWidth, 70)
    context.fillStyle = '#FFFFFF'
    context.font = '600 30px sans-serif'
    context.textAlign = 'center'
    context.fillText('가짜 카메라 (개발용)', fakeVideoWidth / 2, fakeVideoHeight - 25)
    frameNumber += 1
  }

  drawFrame()
  // 탭이 숨으면 멈추는 requestAnimationFrame 대신 일정 간격으로 그린다
  const intervalId = window.setInterval(drawFrame, 1000 / framesPerSecond)
  const stream = canvas.captureStream(framesPerSecond)
  // 카메라를 끌 때(track.stop) 그리기도 멈춘다
  for (const track of stream.getVideoTracks()) {
    const originalStop = track.stop.bind(track)
    track.stop = () => {
      window.clearInterval(intervalId)
      originalStop()
    }
  }
  return stream
}
