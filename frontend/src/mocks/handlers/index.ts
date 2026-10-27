import { administratorHandlers } from '@/mocks/handlers/administrator-handlers'
import { participantHandlers } from '@/mocks/handlers/participant-handlers'
import { storageHandlers } from '@/mocks/handlers/storage-handlers'

// 가짜 API 전체. 개발 서버(브라우저)와 테스트(Node)가 같은 목록을 쓴다
export const mockHandlers = [...administratorHandlers, ...participantHandlers, ...storageHandlers]
