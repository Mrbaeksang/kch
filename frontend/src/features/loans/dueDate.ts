// YYYY-MM-DD 날짜를 UTC로만 계산해 브라우저 시간대와 무관하게 n일 뒤 날짜를 구한다.
export function addDays(date:string,days:number) {
  const [year,month,day]=date.split('-').map(Number)
  return new Date(Date.UTC(year,month-1,day+days)).toISOString().slice(0,10)
}

export const dueDateShortcuts=[{label:'오늘',days:0},{label:'내일',days:1},{label:'일주일 뒤',days:7}]
