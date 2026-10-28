import { todayInKST } from './api'
import { addDays, dueDateShortcuts } from './dueDate'
import './DueDateShortcuts.css'

export function DueDateShortcuts({onSelect,disabled}:{onSelect:(dueDate:string)=>void;disabled:boolean}) {
  return <div className="due-date-shortcuts" role="group" aria-label="반납 예정일 빠른 선택">
    {dueDateShortcuts.map(({label,days})=><button key={label} type="button" disabled={disabled} onClick={()=>onSelect(addDays(todayInKST(),days))}>{label}</button>)}
  </div>
}
