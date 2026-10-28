import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Assets } from './Assets'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const employee = { id: 2, role: 'employee' as const, email: 'employee-a@example.invalid', active: true }
const base = { model: '', description: '', location: '' }
const assets = [
  { ...base, id: 1, assetNumber: 'NB-001', name: '업무 노트북', category: '노트북', status: 'available' },
  { ...base, id: 2, assetNumber: 'NB-002', name: '수리 노트북', category: '노트북', status: 'repair' },
  { ...base, id: 3, assetNumber: 'MN-001', name: '회의실 모니터', category: '모니터', status: 'available' },
  { ...base, id: 4, assetNumber: 'CB-001', name: '충전 케이블', category: '', status: 'loaned' },
]

async function renderAssets() {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json(assets)))
  render(<Assets user={employee} />)
  await screen.findByRole('button', { name: '업무 노트북' })
}
function choose(label: string, text: string) {
  const select = screen.getByLabelText(label) as HTMLSelectElement
  const option = [...select.options].find(option => option.text === text)
  if (!option) throw new Error(`${label}에 '${text}' 선택지가 없습니다.`)
  fireEvent.change(select, { target: { value: option.value } })
}
const shown = () => screen.queryAllByRole('button').map(button => button.textContent).filter(name => assets.some(asset => asset.name === name))

test('status filter shows only equipment in the chosen status', async () => {
  await renderAssets()
  choose('상태 필터', '대여 가능')
  expect(shown()).toEqual(['업무 노트북', '회의실 모니터'])
})

test('category choices are unique and an empty category is offered as unclassified', async () => {
  await renderAssets()
  const category = screen.getByLabelText('분류 필터') as HTMLSelectElement
  expect([...category.options].map(option => option.text)).toEqual(['전체 분류', '노트북', '모니터', '미분류'])
  choose('분류 필터', '노트북')
  expect(shown()).toEqual(['업무 노트북', '수리 노트북'])
  choose('분류 필터', '미분류')
  expect(shown()).toEqual(['충전 케이블'])
})

test('search, category and status apply together and choosing all releases only that condition', async () => {
  await renderAssets()
  fireEvent.change(screen.getByLabelText('장비 검색'), { target: { value: '노트' } })
  choose('상태 필터', '대여 가능')
  expect(shown()).toEqual(['업무 노트북'])
  fireEvent.change(screen.getByLabelText('장비 검색'), { target: { value: '' } })
  choose('분류 필터', '노트북')
  choose('상태 필터', '수리 중')
  expect(shown()).toEqual(['수리 노트북'])
  choose('상태 필터', '전체 상태')
  expect(shown()).toEqual(['업무 노트북', '수리 노트북'])
  choose('분류 필터', '전체 분류')
  expect(shown()).toHaveLength(assets.length)
})

test('result count is shown separately from the total count', async () => {
  await renderAssets()
  expect(screen.getByText('결과 4대 / 전체 4대')).toBeTruthy()
  choose('분류 필터', '노트북')
  expect(screen.getByText('결과 2대 / 전체 4대')).toBeTruthy()
})

test('no matches explains why and reset releases search, category and status', async () => {
  await renderAssets()
  fireEvent.change(screen.getByLabelText('장비 검색'), { target: { value: '노트' } })
  choose('분류 필터', '노트북')
  choose('상태 필터', '대여 중')
  expect(shown()).toEqual([])
  expect(screen.getByText('조건에 맞는 장비가 없습니다.')).toBeTruthy()
  expect(screen.queryByText('아직 등록된 장비가 없습니다.')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '조건 초기화' }))
  expect(shown()).toHaveLength(assets.length)
  expect((screen.getByLabelText('장비 검색') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('분류 필터') as HTMLSelectElement).selectedOptions[0].text).toBe('전체 분류')
  expect((screen.getByLabelText('상태 필터') as HTMLSelectElement).selectedOptions[0].text).toBe('전체 상태')
})

test('a chosen category that disappears after an edit no longer hides the list', async () => {
  let current = assets
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (path: string, options?: RequestInit) => {
    if (options?.method === 'PUT') { current = current.map(asset => asset.id === 4 ? { ...asset, category: '케이블' } : asset); return Response.json(current[3]) }
    return Response.json(path === '/api/assets/4' ? current[3] : current)
  }))
  render(<Assets user={{ ...employee, role: 'admin' }} />)
  await screen.findByRole('button', { name: '충전 케이블' })
  choose('분류 필터', '미분류')
  fireEvent.click(screen.getByRole('button', { name: '충전 케이블' }))
  fireEvent.click(await screen.findByRole('button', { name: '장비 정보 수정' }))
  fireEvent.change(screen.getByLabelText('분류'), { target: { value: '케이블' } })
  fireEvent.click(screen.getByRole('button', { name: '저장' }))
  await screen.findByText('장비 정보를 수정했습니다.')
  await screen.findByText('결과 4대 / 전체 4대')
  expect((screen.getByLabelText('분류 필터') as HTMLSelectElement).selectedOptions[0].text).toBe('전체 분류')
})
