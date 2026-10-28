import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Assets } from './Assets'
import { CopyAssetInfo } from './CopyAssetInfo'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); Reflect.deleteProperty(navigator, 'clipboard') })
const employee = { id: 2, role: 'employee' as const, email: 'employee@example.invalid', active: true }
const laptop = { id: 1, assetNumber: 'TEST-001', name: '테스트 노트북', model: '', category: '노트북', description: '설명은 복사하지 않음', location: '본사 3층', status: 'available' }
const monitor = { id: 2, assetNumber: 'TEST-002', name: '테스트 모니터', model: 'M-27', category: '모니터', description: '', location: '', status: 'repair' }
const laptopText = '[장비 정보]\n자산번호: TEST-001\n장비명: 테스트 노트북\n모델: 미입력\n분류: 노트북\n보관 위치: 본사 3층\n현재 상태: 대여 가능'
const monitorText = '[장비 정보]\n자산번호: TEST-002\n장비명: 테스트 모니터\n모델: M-27\n분류: 모니터\n보관 위치: 미입력\n현재 상태: 수리 중'
function stubClipboard(clipboard?: { writeText: (text: string) => Promise<void> }) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true })
}
function stubAssets() {
  const fetchMock = vi.fn().mockImplementation(async (path: string) => Response.json(path === '/api/assets/1' ? laptop : path === '/api/assets/2' ? monitor : [laptop, monitor]))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

test('copies the asset with labels and marks missing values', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  stubClipboard({ writeText })
  render(<CopyAssetInfo asset={laptop} statusLabel="대여 가능" />)
  fireEvent.click(screen.getByRole('button', { name: '장비 정보 복사' }))
  expect((await screen.findByRole('status')).textContent).toBe('장비 정보를 복사했습니다.')
  expect(writeText).toHaveBeenCalledWith(laptopText)
  expect(screen.queryByRole('alert')).toBeNull()
})

test('shows the text to copy by hand when clipboard permission is denied', async () => {
  stubClipboard({ writeText: vi.fn().mockRejectedValue(new DOMException('denied', 'NotAllowedError')) })
  render(<CopyAssetInfo asset={laptop} statusLabel="대여 가능" />)
  fireEvent.click(screen.getByRole('button', { name: '장비 정보 복사' }))
  expect((await screen.findByRole('alert')).textContent).toBe('자동 복사에 실패했습니다. 아래 내용을 선택해 복사하세요.')
  expect((screen.getByLabelText('복사할 장비 정보') as HTMLTextAreaElement).value).toBe(laptopText)
  expect(screen.queryByText('장비 정보를 복사했습니다.')).toBeNull()
})

test('shows the text to copy by hand when the browser has no clipboard', async () => {
  stubClipboard(undefined)
  render(<CopyAssetInfo asset={laptop} statusLabel="대여 가능" />)
  fireEvent.click(screen.getByRole('button', { name: '장비 정보 복사' }))
  await screen.findByRole('alert')
  expect((screen.getByLabelText('복사할 장비 정보') as HTMLTextAreaElement).value).toBe(laptopText)
})

test('employee copies the newly selected asset without sending a request', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  stubClipboard({ writeText })
  const fetchMock = stubAssets()
  render(<Assets user={employee} />)
  fireEvent.click(await screen.findByRole('button', { name: '테스트 노트북' }))
  await screen.findByRole('heading', { name: '테스트 노트북' })
  fireEvent.click(screen.getByRole('button', { name: '장비 정보 복사' }))
  await screen.findByText('장비 정보를 복사했습니다.')
  fireEvent.click(screen.getByRole('button', { name: '테스트 모니터' }))
  await screen.findByRole('heading', { name: '테스트 모니터' })
  expect(screen.queryByText('장비 정보를 복사했습니다.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '장비 정보 복사' }))
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(monitorText))
  expect(writeText).toHaveBeenNthCalledWith(1, laptopText)
  expect(writeText.mock.calls.join('\n')).not.toContain(employee.email)
  expect(fetchMock.mock.calls.every(([, options]) => !options?.method)).toBe(true)
})

test('administrator can copy and still edit the asset', async () => {
  stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) })
  stubAssets()
  render(<Assets user={{ ...employee, id: 1, role: 'admin', email: 'admin@example.invalid' }} />)
  fireEvent.click(await screen.findByRole('button', { name: '테스트 노트북' }))
  await screen.findByRole('heading', { name: '테스트 노트북' })
  fireEvent.click(screen.getByRole('button', { name: '장비 정보 복사' }))
  await screen.findByText('장비 정보를 복사했습니다.')
  expect(screen.getByRole('button', { name: '장비 정보 수정' })).toBeTruthy()
})
