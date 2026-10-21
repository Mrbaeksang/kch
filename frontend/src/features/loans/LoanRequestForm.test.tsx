import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LoanRequestForm } from './LoanRequestForm'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('employee submits an unchanged return date and sees approval pending', async () => {
  const fetchMock=vi.fn().mockImplementation(async () => Response.json({id:1,status:'pending',dueDate:'2099-01-02'},{status:201}))
  vi.stubGlobal('fetch',fetchMock)
  const submitted=vi.fn()
  render(<LoanRequestForm assetId={1} onSubmitted={submitted} />)
  fireEvent.change(screen.getByLabelText('반납 예정일'),{target:{value:'2099-01-02'}})
  fireEvent.click(screen.getByRole('button',{name:'대여 신청'}))
  await screen.findByText('대여를 신청했습니다. 관리자 승인을 기다려주세요.')
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).dueDate).toBe('2099-01-02')
  expect(submitted).toHaveBeenCalledOnce()
})

test('a cancelled request allows the employee to apply again without reloading',async()=>{
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>Response.json({id:1,status:'pending'},{status:201})))
  const {rerender}=render(<LoanRequestForm assetId={1} onSubmitted={()=>{}} resetVersion={0}/> )
  fireEvent.change(screen.getByLabelText('반납 예정일'),{target:{value:'2099-01-02'}})
  fireEvent.click(screen.getByRole('button',{name:'대여 신청'}))
  await screen.findByText('대여를 신청했습니다. 관리자 승인을 기다려주세요.')
  rerender(<LoanRequestForm assetId={1} onSubmitted={()=>{}} resetVersion={1}/> )
  expect((screen.getByRole('button',{name:'대여 신청'}) as HTMLButtonElement).disabled).toBe(false)
})
