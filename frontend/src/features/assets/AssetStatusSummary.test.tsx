import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { AssetStatusSummary } from './AssetStatusSummary'

afterEach(cleanup)

test('shows all equipment counts including stored and unknown states', () => {
  const assets = ['available', 'available', 'loaned', 'repair', 'archived', 'unknown'].map(status => ({ status }))
  render(<AssetStatusSummary assets={assets} loading={false} failed={false} />)
  const summary = screen.getByRole('region', { name: '장비 상태별 수량' })
  for (const [label, count] of [['전체', '6대'], ['대여 가능', '2대'], ['대여 중', '1대'], ['수리 중', '1대']]) {
    expect(within(summary).getByText(label).nextElementSibling?.textContent).toBe(count)
  }
  expect(within(summary).getByText('보관 1대 · 기타 1대')).toBeTruthy()
  expect(within(summary).getByText('전체 장비 기준')).toBeTruthy()
})

test('distinguishes loading and failure from a successfully empty inventory', () => {
  const { rerender } = render(<AssetStatusSummary assets={[]} loading={true} failed={false} />)
  expect(screen.getByText('장비 현황을 불러오는 중입니다.')).toBeTruthy()
  expect(screen.queryByText('0대')).toBeNull()
  rerender(<AssetStatusSummary assets={[]} loading={false} failed={true} />)
  expect(screen.getByText('장비 현황 확인 불가')).toBeTruthy()
  expect(screen.queryByText('0대')).toBeNull()
  rerender(<AssetStatusSummary assets={[]} loading={false} failed={false} />)
  expect(screen.getAllByText('0대')).toHaveLength(4)
  expect(screen.queryByText(/보관 \d/)).toBeNull()
})

test('recounts refreshed equipment without modifying the source array', () => {
  const assets = Object.freeze([Object.freeze({ status: 'available' })])
  const { rerender } = render(<AssetStatusSummary assets={assets} loading={false} failed={false} />)
  expect(screen.getByText('대여 가능').nextElementSibling?.textContent).toBe('1대')
  rerender(<AssetStatusSummary assets={[{ status: 'repair' }, { status: 'archived' }]} loading={false} failed={false} />)
  expect(screen.getByText('전체').nextElementSibling?.textContent).toBe('2대')
  expect(screen.getByText('대여 가능').nextElementSibling?.textContent).toBe('0대')
  expect(screen.getByText('수리 중').nextElementSibling?.textContent).toBe('1대')
  expect(screen.getByText('보관 1대')).toBeTruthy()
  expect(assets).toEqual([{ status: 'available' }])
  rerender(<AssetStatusSummary assets={assets} loading={false} failed={true} />)
  expect(screen.getByText('장비 현황 확인 불가')).toBeTruthy()
  expect(screen.queryByText('1대')).toBeNull()
})
