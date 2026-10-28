import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Requests } from './Requests'

afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear()})

const request=(id:number,dueDate:string)=>({id,assetId:id,assetName:`장비 ${id}`,assetNumber:`TEST-${id}`,dueDate,status:'pending',reason:'',createdAt:''})

function stubRequests(rows:ReturnType<typeof request>[]) {
  const fetch=vi.fn().mockImplementation(async(path:string)=>path.endsWith('/cancel')?Response.json({status:'cancelled'}):Response.json(rows))
  vi.stubGlobal('fetch',fetch)
  return fetch
}

async function shownIds() {
  await screen.findAllByText('승인 대기')
  return within(screen.getByRole('table')).getAllByRole('row').slice(1).map(row=>row.querySelector('small')?.textContent)
}

test('keeps the server order by default and sorts by the earliest due date on request',async()=>{
  stubRequests([request(18,'2099-10-30'),request(14,'2099-10-28'),request(12,'2099-10-28')])
  render(<Requests revision={0}/>)
  expect(await shownIds()).toEqual(['TEST-18','TEST-14','TEST-12'])
  fireEvent.change(screen.getByLabelText('정렬'),{target:{value:'due-asc'}})
  expect(await shownIds()).toEqual(['TEST-12','TEST-14','TEST-18'])
})

test('sends records with a missing or invalid due date to the end in both orders',async()=>{
  stubRequests([request(30,''),request(18,'2099-10-30'),request(25,'2099-02-30'),request(12,'2099-10-28')])
  render(<Requests revision={0}/>)
  await shownIds()
  fireEvent.change(screen.getByLabelText('정렬'),{target:{value:'due-asc'}})
  expect(await shownIds()).toEqual(['TEST-12','TEST-18','TEST-25','TEST-30'])
  fireEvent.change(screen.getByLabelText('정렬'),{target:{value:'due-desc'}})
  expect(await shownIds()).toEqual(['TEST-18','TEST-12','TEST-25','TEST-30'])
  expect(screen.getAllByText('날짜 확인 필요')).toHaveLength(2)
})

test('cancels the clicked request after sorting and keeps the chosen order after a reload',async()=>{
  const fetch=stubRequests([request(18,'2099-10-30'),request(12,'2099-10-28')])
  render(<Requests revision={0}/>)
  await shownIds()
  fireEvent.change(screen.getByLabelText('정렬'),{target:{value:'due-desc'}})
  fireEvent.click(screen.getByRole('button',{name:'장비 12 신청 취소'}))
  await screen.findByText('신청을 취소했습니다.')
  expect(fetch).toHaveBeenCalledWith('/api/loan-requests/12/cancel',expect.anything())
  cleanup()
  render(<Requests revision={0}/>)
  expect(await shownIds()).toEqual(['TEST-18','TEST-12'])
  expect(screen.getByLabelText('정렬')).toHaveProperty('value','due-desc')
})
