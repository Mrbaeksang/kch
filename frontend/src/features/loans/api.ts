export type LoanRequest = { id:number; assetId:number; assetName:string; assetNumber:string; dueDate:string; status:string; reason:string; createdAt:string }

export async function loanRequest<T>(path='',body?:unknown):Promise<T> {
  const response=await fetch(`/api/loan-requests${path}`,{
    method:body===undefined?'GET':'POST',
    headers:body===undefined?undefined:{'Content-Type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body),
  })
  const result=await response.json()
  if(!response.ok) throw new Error(result.error || '신청을 처리하지 못했습니다.')
  return result
}

export function todayInKST() {
  return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
}
