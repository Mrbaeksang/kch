import { useEffect, useState, type FormEvent } from 'react'
import { loanRequest, todayInKST } from './api'
import { DueDateShortcuts } from './DueDateShortcuts'

export function LoanRequestForm({assetId,onSubmitted,resetVersion=0}:{assetId:number;onSubmitted:()=>void;resetVersion?:number}) {
  const [dueDate,setDueDate]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [submitted,setSubmitted]=useState(false)
  useEffect(()=>{setSubmitted(false);setError('')},[resetVersion])
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setError('');setSubmitted(false)
    try {await loanRequest('',{assetId,dueDate});setSubmitted(true);onSubmitted()}
    catch(failure){setError(failure instanceof Error?failure.message:'신청에 실패했습니다.')}
    finally{setBusy(false)}
  }
  return <form className="loan-form" onSubmit={submit}>
    <h3>이 장비 대여하기</h3>
    <label className="field">반납 예정일<input type="date" required min={todayInKST()} value={dueDate} onChange={event=>{setDueDate(event.target.value);setSubmitted(false)}} disabled={busy}/></label>
    <DueDateShortcuts onSelect={setDueDate} disabled={busy || submitted}/>
    <small>한국 시간 기준 · 관리자 승인 후 대여가 시작됩니다.</small>
    {error?<p role="alert" className="notice error">{error}</p>:null}
    {submitted?<p role="status" className="notice">대여를 신청했습니다. 관리자 승인을 기다려주세요.</p>:null}
    <button className="primary" disabled={busy || submitted}>{busy?'신청 중…':'대여 신청'}</button>
  </form>
}
