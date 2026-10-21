import { useEffect, useState } from 'react'
import { loanRequest, type LoanRequest } from './api'

const labels:Record<string,string>={pending:'승인 대기',cancelled:'취소됨',approved:'승인됨',rejected:'거절됨'}

export function Requests({revision,onCancelled}:{revision:number;onCancelled?:()=>void}) {
  const [requests,setRequests]=useState<LoanRequest[]>([])
  const [refresh,setRefresh]=useState(0)
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState<number|null>(null)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  useEffect(()=>{
    let active=true
    setLoading(true)
    loanRequest<LoanRequest[]>().then(result=>{if(active)setRequests(result)})
      .catch(failure=>{if(active)setError(failure.message)})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[revision,refresh])
  async function cancel(id:number) {
    setBusy(id);setError('');setMessage('')
    try {await loanRequest(`/${id}/cancel`,{});setMessage('신청을 취소했습니다.');setRefresh(value=>value+1);onCancelled?.()}
    catch(failure){setError(failure instanceof Error?failure.message:'취소하지 못했습니다.');setRefresh(value=>value+1)}
    finally{setBusy(null)}
  }
  return <section className="requests" aria-label="내 대여 신청">
    <div className="requests-heading"><div><div className="eyebrow">MY REQUESTS</div><h2>내 대여 신청</h2></div><button onClick={()=>{setError('');setRefresh(value=>value+1)}} disabled={loading}>새로고침</button></div>
    <p className="muted">승인 대기 중에만 취소할 수 있습니다. 반납 예정일은 한국 시간 기준입니다.</p>
    {error?<p className="notice error" role="alert">{error}</p>:null}
    {message?<p className="notice" role="status">{message}</p>:null}
    {loading?<p role="status">신청을 불러오고 있습니다.</p>:requests.length===0?<p>아직 신청한 장비가 없습니다.</p>:<div className="table-scroll"><table><thead><tr><th>장비</th><th>반납 예정일</th><th>처리 상태</th><th>관리</th></tr></thead><tbody>{requests.map(request=><tr key={request.id}>
      <td>{request.assetName}<small>{request.assetNumber}</small>{request.reason?<small>{request.reason}</small>:null}</td>
      <td>{request.dueDate}</td><td><span className="badge">{labels[request.status]||request.status}</span></td>
      <td>{request.status==='pending'?<button className="cancel-request" disabled={busy!==null} aria-label={`${request.assetName} 신청 취소`} onClick={()=>cancel(request.id)}>{busy===request.id?'취소 중…':'신청 취소'}</button>:'—'}</td>
    </tr>)}</tbody></table></div>}
  </section>
}
