import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Assets } from './Assets'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const admin = { id: 1, role: 'admin' as const, email: 'admin@example.invalid', active: true }

test('administrator registers an asset and sees it in the list', async () => {
  const asset = { id: 1, assetNumber: 'TEST-001', name: '테스트 노트북', model: '', category: '', description: '', location: '', status: 'available' }
  let saved = false
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === 'POST') { saved = true; return Response.json(asset, { status: 201 }) }
    return Response.json(path === '/api/assets/1' ? asset : saved ? [asset] : [])
  }))
  render(<Assets user={admin} />)
  await screen.findByText('아직 등록된 장비가 없습니다.')
  fireEvent.click(screen.getByRole('button', { name: '+ 장비 등록' }))
  fireEvent.change(screen.getByLabelText('자산번호 *'), { target: { value: 'TEST-001' } })
  fireEvent.change(screen.getByLabelText('장비명 *'), { target: { value: '테스트 노트북' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await screen.findByText('새 장비를 등록했습니다.')
  await screen.findByRole('button', { name: '테스트 노트북' })
  await waitFor(() => expect(screen.getByRole('button', { name: '장비 정보 수정' })).toBeTruthy())
  expect(within(screen.getByRole('region', { name: '장비 상태별 수량' })).getByText('전체').nextElementSibling?.textContent).toBe('1대')
})

test('searching the list does not change the full inventory summary', async () => {
  const assets = ['available', 'loaned', 'repair'].map((status, index) => ({ id: index + 1, assetNumber: `TEST-${index}`, name: `장비 ${index}`, model: '', category: '', description: '', location: '', status }))
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json(assets)))
  render(<Assets user={{ ...admin, role: 'employee' }} />)
  await screen.findByRole('button', { name: '장비 0' })
  fireEvent.change(screen.getByLabelText('장비 검색'), { target: { value: '장비 0' } })
  expect(screen.queryByRole('button', { name: '장비 1' })).toBeNull()
  const summary = screen.getByRole('region', { name: '장비 상태별 수량' })
  expect(within(summary).getByText('전체').nextElementSibling?.textContent).toBe('3대')
  expect(assets.map(asset => asset.status)).toEqual(['available', 'loaned', 'repair'])
})

test('failed list retrieval is not shown as a zero inventory and retry recovers', async () => {
  const fetchMock = vi.fn().mockRejectedValueOnce(new Error('목록 조회 실패')).mockResolvedValueOnce(Response.json([]))
  vi.stubGlobal('fetch', fetchMock)
  render(<Assets user={admin} />)
  await screen.findByText('장비 현황 확인 불가')
  expect(within(screen.getByRole('region', { name: '장비 상태별 수량' })).queryByText('0대')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '다시 조회' }))
  await waitFor(() => expect(within(screen.getByRole('region', { name: '장비 상태별 수량' })).getAllByText('0대')).toHaveLength(4))
})

test('employee can view assets but has no registration control', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json([])))
  render(<Assets user={{ ...admin, role: 'employee' }} />)
  await screen.findByText('아직 등록된 장비가 없습니다.')
  expect(screen.queryByRole('button', { name: '+ 장비 등록' })).toBeNull()
})

test('search ignores accidental spaces around the equipment name', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json([
    { id: 1, assetNumber: 'TEST-001', name: '업무 노트북', model: '', category: '', description: '', location: '', status: 'available' },
  ])))
  render(<Assets user={{ ...admin, role: 'employee' }} />)
  await screen.findByRole('button', { name: '업무 노트북' })
  fireEvent.change(screen.getByLabelText('장비 검색'), { target: { value: '  업무 노트북  ' } })
  expect(screen.getByRole('button', { name: '업무 노트북' })).toBeTruthy()
})
