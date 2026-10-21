import { useEffect, useState } from 'react'
import { authRequest, type User } from './api'
import { Assets } from '../assets/Assets'
import { Requests } from '../loans/Requests'

export function Login() {
  const [enabled, setEnabled] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestRevision,setRequestRevision] = useState(0)
  const [requestResetVersion,setRequestResetVersion] = useState(0)
  useEffect(() => {
    let active = true
    authRequest<{ developmentLogin: boolean }>('config').then(result => {
      if (active) setEnabled(result.developmentLogin)
    }).catch(() => { if (active) setError('로그인 설정을 확인할 수 없습니다.') })
    authRequest<User>('me').then(result => { if (active) setUser(result) }).catch(() => {})
    return () => { active = false }
  }, [])
  async function login(role: User['role'],account='') {
    setBusy(true); setError('')
    try { setUser(await authRequest<User>('dev-login', { role,account })) }
    catch (failure) { setError(failure instanceof Error ? failure.message : '로그인에 실패했습니다.') }
    finally { setBusy(false) }
  }
  async function logout() {
    setBusy(true); setError('')
    try { await authRequest('logout', {}); setUser(null) }
    catch { setError('로그아웃에 실패했습니다.') }
    finally { setBusy(false) }
  }
  if (user) return <>
    <section className="account-bar">
    <div><strong>{user.role === 'admin' ? '관리자로' : '직원으로'} 로그인했습니다.</strong><small>{user.email} · 개발 테스트 계정</small></div>
    {error ? <p role="alert">{error}</p> : null}
    <button disabled={busy} onClick={logout}>로그아웃</button>
    </section>
    <Assets key={user.id} user={user} requestResetVersion={requestResetVersion} onRequestCreated={()=>setRequestRevision(value=>value+1)} />
    {user.role === 'employee' ? <Requests key={user.id} revision={requestRevision} onCancelled={()=>setRequestResetVersion(value=>value+1)}/> : null}
  </>
  return <section className="login">
    <h2>회사 장비, 필요한 순간에.</h2>
    <p>등록된 회사 Google 계정으로 장비를 신청하고<br />대여와 반납 현황을 확인하세요.</p>
    {enabled ? <>
      <button disabled={busy} onClick={() => login('employee')}>직원 A 테스트 로그인</button>
      <button disabled={busy} onClick={() => login('employee','employee-b')}>직원 B 테스트 로그인</button>
      <button disabled={busy} onClick={() => login('admin')}>관리자 테스트 로그인</button>
      <small>로컬 개발 전용 · 실제 Google 로그인은 최종 검증에서 연결합니다.</small>
    </> : <><button disabled>Google 로그인 준비 중</button><small>로그인 연결은 최종 검증에서 제공됩니다.</small></>}
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
