import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Assets } from './Assets'
import { ExportAssetsCsv, toAssetsCsv } from './ExportAssetsCsv'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const labels = { available: '대여 가능', repair: '수리 중' }
const asset = { assetNumber: 'TEST-001', name: '업무 노트북', model: 'X1', category: 'IT', location: '3층', status: 'available' }

test('csv starts with a BOM and a header and holds only the six asset columns', () => {
  const csv = toAssetsCsv([{ ...asset, id: 7, description: '비공개 메모' } as typeof asset], labels)
  expect(csv.startsWith('﻿')).toBe(true)
  expect(csv.slice(1).split('\r\n')).toEqual(['자산번호,장비명,모델,분류,보관 위치,상태', 'TEST-001,업무 노트북,X1,IT,3층,대여 가능', ''])
})

test('commas, double quotes and line breaks stay inside their own cell', () => {
  const csv = toAssetsCsv([{ ...asset, name: '노트북, "15인치"', model: '1행\n2행', status: 'lost' }], labels)
  expect(csv.split('\r\n')[1]).toBe('TEST-001,"노트북, ""15인치""","1행\n2행",IT,3층,lost')
})

test('cells that a spreadsheet would run as a formula are kept as plain text', () => {
  const risky = ['=1+1', '+82', '-5', '@SUM(A1)', '\tTAB', '\rCR', '\nLF']
  const rows = risky.map(name => toAssetsCsv([{ ...asset, name }], labels).split('\r\n')[1].split(',')[1])
  expect(rows).toEqual(["'=1+1", "'+82", "'-5", "'@SUM(A1)", "'\tTAB", "\"'\rCR\"", "\"'\nLF\""])
})

test('download is blocked while loading, after a failure or for an empty list', () => {
  const { rerender } = render(<ExportAssetsCsv assets={[asset]} statusLabels={labels} disabled />)
  const button = () => screen.getByRole('button', { name: '전체 장비 CSV' }) as HTMLButtonElement
  expect(button().disabled).toBe(true)
  rerender(<ExportAssetsCsv assets={[]} statusLabels={labels} disabled={false} />)
  expect(button().disabled).toBe(true)
  rerender(<ExportAssetsCsv assets={[asset]} statusLabels={labels} disabled={false} />)
  expect(button().disabled).toBe(false)
})

test('download saves a csv file and releases the temporary object url', async () => {
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:assets')
  const revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<ExportAssetsCsv assets={[asset]} statusLabels={labels} disabled={false} />)
  fireEvent.click(screen.getByRole('button', { name: '전체 장비 CSV' }))
  const blob = createObjectURL.mock.calls[0][0]
  expect(blob.type).toBe('text/csv;charset=utf-8')
  expect(await blob.text()).toContain('TEST-001,업무 노트북')
  expect(click).toHaveBeenCalledOnce()
  expect((click.mock.contexts[0] as HTMLAnchorElement).download).toMatch(/^전체장비_\d{4}-\d{2}-\d{2}\.csv$/)
  await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:assets'))
})

const admin = { id: 1, role: 'admin' as const, email: 'admin@example.invalid', active: true }
const listed = [{ id: 1, description: '', ...asset }, { id: 2, description: '', ...asset, assetNumber: 'TEST-002', name: '회의실 모니터' }]

test('administrator exports every asset even while a search narrows the list', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json(listed)))
  const createObjectURL = vi.fn((_blob: Blob) => 'blob:assets')
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }))
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<Assets user={admin} />)
  const button = await screen.findByRole('button', { name: '전체 장비 CSV' }) as HTMLButtonElement
  await waitFor(() => expect(button.disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('장비 검색'), { target: { value: '모니터' } })
  expect(screen.queryByRole('button', { name: '업무 노트북' })).toBeNull()
  fireEvent.click(button)
  const csv = await (createObjectURL.mock.calls[0][0]).text()
  expect(csv).toContain('TEST-001,업무 노트북')
  expect(csv).toContain('TEST-002,회의실 모니터')
})

test('download stays blocked when the asset list cannot be loaded', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ error: '조회 실패' }, { status: 500 })))
  render(<Assets user={admin} />)
  await screen.findByRole('alert')
  expect((screen.getByRole('button', { name: '전체 장비 CSV' }) as HTMLButtonElement).disabled).toBe(true)
})

test('employee does not see the asset export button', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json(listed)))
  render(<Assets user={{ ...admin, role: 'employee' }} />)
  await screen.findByRole('button', { name: '업무 노트북' })
  expect(screen.queryByRole('button', { name: '전체 장비 CSV' })).toBeNull()
})
