import { useState } from 'react'
import './RequestOrder.css'

export type RequestOrder='default'|'due-asc'|'due-desc'

const storageKey='kch.requestOrder'
const orders:RequestOrder[]=['default','due-asc','due-desc']

// 새로고침 후에도 고른 정렬을 유지한다. 저장소를 쓸 수 없으면 기본 순서로 동작한다.
export function useRequestOrder():[RequestOrder,(order:RequestOrder)=>void] {
  const [order,setOrder]=useState<RequestOrder>(()=>{
    try {const saved=localStorage.getItem(storageKey);return orders.find(value=>value===saved)||'default'}
    catch {return 'default'}
  })
  return [order,next=>{setOrder(next);try {localStorage.setItem(storageKey,next)} catch {}}]
}

export function isValidDueDate(value:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date=new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime())&&date.toISOString().startsWith(value)
}

// 원본 배열은 그대로 두고, 날짜 확인이 필요한 기록은 어느 방향이든 맨 뒤에 신청 ID 순으로 둔다.
export function orderRequests<T extends {id:number;dueDate:string}>(requests:T[],order:RequestOrder):T[] {
  if(order==='default') return requests
  const direction=order==='due-asc'?1:-1
  return [...requests].sort((a,b)=>{
    const validA=isValidDueDate(a.dueDate),validB=isValidDueDate(b.dueDate)
    if(validA!==validB) return validA?-1:1
    return (validA?direction*a.dueDate.localeCompare(b.dueDate):0)||a.id-b.id
  })
}

export function RequestOrderSelect({value,onChange}:{value:RequestOrder;onChange:(order:RequestOrder)=>void}) {
  return <label className="request-order">정렬 <select value={value} onChange={event=>onChange(event.target.value as RequestOrder)}>
    <option value="default">기본 순서</option>
    <option value="due-asc">반납 예정일 빠른 순</option>
    <option value="due-desc">반납 예정일 늦은 순</option>
  </select></label>
}
