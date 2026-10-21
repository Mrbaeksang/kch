import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Requests } from './Requests'

afterEach(()=>{cleanup();vi.unstubAllGlobals()})

test('employee cancels a pending request and sees the cancelled result',async()=>{
  let cancelled=false
  vi.stubGlobal('fetch',vi.fn().mockImplementation(async(path:string)=>{
    if(path.endsWith('/cancel')){cancelled=true;return Response.json({id:1,status:'cancelled'})}
    return Response.json([{id:1,assetId:1,assetName:'테스트 장비',assetNumber:'TEST-001',dueDate:'2099-01-02',status:cancelled?'cancelled':'pending',reason:'',createdAt:''}])
  }))
  render(<Requests revision={0}/> )
  await screen.findByText('승인 대기')
  fireEvent.click(screen.getByRole('button',{name:'테스트 장비 신청 취소'}))
  await screen.findByText('취소됨')
  expect(screen.queryByRole('button',{name:'테스트 장비 신청 취소'})).toBeNull()
})
