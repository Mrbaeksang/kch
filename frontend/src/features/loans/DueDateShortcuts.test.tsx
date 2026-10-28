import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LoanRequestForm } from './LoanRequestForm'

const originalTZ=process.env.TZ
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); process.env.TZ=originalTZ })

function dueDateInput() { return screen.getByLabelText('반납 예정일') as HTMLInputElement }
function shortcut(name:string) { return screen.getByRole('button',{name}) as HTMLButtonElement }
function at(instant:string) { vi.useFakeTimers({toFake:['Date']}); vi.setSystemTime(new Date(instant)) }

test('shortcuts only fill the return date and never submit a request', () => {
  at('2026-10-28T03:00:00Z')
  const fetchMock=vi.fn()
  vi.stubGlobal('fetch',fetchMock)
  render(<LoanRequestForm assetId={1} onSubmitted={()=>{}} />)
  fireEvent.click(shortcut('오늘'))
  expect(dueDateInput().value).toBe('2026-10-28')
  fireEvent.click(shortcut('내일'))
  expect(dueDateInput().value).toBe('2026-10-29')
  fireEvent.click(shortcut('일주일 뒤'))
  expect(dueDateInput().value).toBe('2026-11-04')
  expect(fetchMock).not.toHaveBeenCalled()
})

test('a week later crosses month and year ends by Korean date', () => {
  at('2026-10-31T00:00:00Z')
  render(<LoanRequestForm assetId={1} onSubmitted={()=>{}} />)
  fireEvent.click(shortcut('일주일 뒤'))
  expect(dueDateInput().value).toBe('2026-11-07')
  cleanup()
  at('2026-12-28T00:00:00Z')
  render(<LoanRequestForm assetId={1} onSubmitted={()=>{}} />)
  fireEvent.click(shortcut('일주일 뒤'))
  expect(dueDateInput().value).toBe('2027-01-04')
  fireEvent.click(shortcut('내일'))
  expect(dueDateInput().value).toBe('2026-12-29')
})

test('a browser outside Korea still gets the Korean today', () => {
  process.env.TZ='America/Los_Angeles'
  at('2026-10-31T16:30:00Z') // 로스앤젤레스 10/31 09:30, 한국 11/01 01:30
  render(<LoanRequestForm assetId={1} onSubmitted={()=>{}} />)
  fireEvent.click(shortcut('오늘'))
  expect(dueDateInput().value).toBe('2026-11-01')
  fireEvent.click(shortcut('일주일 뒤'))
  expect(dueDateInput().value).toBe('2026-11-08')
  expect(dueDateInput().min).toBe('2026-11-01')
})

test('typing a date directly still works next to the shortcuts', () => {
  render(<LoanRequestForm assetId={1} onSubmitted={()=>{}} />)
  fireEvent.click(shortcut('내일'))
  fireEvent.change(dueDateInput(),{target:{value:'2099-01-02'}})
  expect(dueDateInput().value).toBe('2099-01-02')
})

test('shortcuts lock while submitting and after success, then unlock after cancellation', async () => {
  let respond:(value:Response)=>void=()=>{}
  const fetchMock=vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{respond=resolve}))
  vi.stubGlobal('fetch',fetchMock)
  const {rerender}=render(<LoanRequestForm assetId={1} onSubmitted={()=>{}} resetVersion={0} />)
  fireEvent.click(shortcut('일주일 뒤'))
  fireEvent.click(screen.getByRole('button',{name:'대여 신청'}))
  expect(shortcut('오늘').disabled).toBe(true)
  expect(shortcut('일주일 뒤').disabled).toBe(true)
  respond(Response.json({id:1,status:'pending'},{status:201}))
  await screen.findByText('대여를 신청했습니다. 관리자 승인을 기다려주세요.')
  expect(shortcut('내일').disabled).toBe(true)
  fireEvent.click(shortcut('내일'))
  expect((screen.getByRole('button',{name:'대여 신청'}) as HTMLButtonElement).disabled).toBe(true)
  expect(fetchMock).toHaveBeenCalledOnce()
  rerender(<LoanRequestForm assetId={1} onSubmitted={()=>{}} resetVersion={1} />)
  expect(shortcut('내일').disabled).toBe(false)
  expect((screen.getByRole('button',{name:'대여 신청'}) as HTMLButtonElement).disabled).toBe(false)
})
