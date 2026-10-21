import { useEffect, useState } from 'react'
import { checkConnection } from '../lib/api'
import { Login } from '../features/auth/Login'

export function App() {
  const [status, setStatus] = useState('연결 확인 중')
  useEffect(() => {
    const controller = new AbortController()
    checkConnection(controller.signal)
      .then(() => setStatus('서비스 연결됨'))
      .catch(() => { if (!controller.signal.aborted) setStatus('서비스 연결 확인 필요') })
    return () => controller.abort()
  }, [])
  return <div className="shell">
    <header><a href="/" className="brand">KCH <span>장비 대여</span></a><span role="status">{status}</span></header>
    <main><Login /></main>
    <footer>사내 구성원 전용 · 장비 대여 관리</footer>
  </div>
}
