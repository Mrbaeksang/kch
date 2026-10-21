import { useEffect, useState, type FormEvent } from 'react'
import type { User } from '../auth/api'
import { LoanRequestForm } from '../loans/LoanRequestForm'

type Asset = { id: number; assetNumber: string; name: string; model: string; category: string; description: string; location: string; status: string }
type Draft = Omit<Asset, 'id' | 'status'>
const empty: Draft = { assetNumber: '', name: '', model: '', category: '', description: '', location: '' }
const statusLabels:Record<string,string>={available:'대여 가능',repair:'수리 중',loaned:'대여 중',archived:'보관됨'}
const fields: { key: keyof Draft; label: string; max: number; required?: boolean }[] = [
  { key: 'assetNumber', label: '자산번호', max: 80, required: true },
  { key: 'name', label: '장비명', max: 120, required: true },
  { key: 'model', label: '모델', max: 120 },
  { key: 'category', label: '분류', max: 80 },
  { key: 'location', label: '보관 위치', max: 120 },
]

async function request<T>(path = '', options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/assets${path}`, options)
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.')
  return result
}

export function Assets({ user, onRequestCreated,requestResetVersion=0 }: { user: User; onRequestCreated?: () => void;requestResetVersion?:number }) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [detail, setDetail] = useState<Asset | null>(null)
  const [draft, setDraft] = useState<Draft>({ ...empty })
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    request<Asset[]>('', { signal: controller.signal }).then(setAssets)
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [version])
  useEffect(() => {
    setDetail(null)
    if (selected === null) return
    const controller = new AbortController()
    setDetailLoading(true)
    request<Asset>(`/${selected}`, { signal: controller.signal }).then(setDetail)
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selected, version])
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('')
    try {
      const result = await request<Asset>(mode === 'edit' ? `/${selected}` : '', {
        method: mode === 'edit' ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      })
      setSelected(result.id); setDetail(result); setMode('view'); setVersion(value => value + 1)
      setMessage(mode === 'edit' ? '장비 정보를 수정했습니다.' : '새 장비를 등록했습니다.')
    } catch (failure) { setError(failure instanceof Error ? failure.message : '저장에 실패했습니다.') }
    finally { setBusy(false) }
  }
  function open(asset: Asset) { setSelected(asset.id); setMode('view'); setError(''); setMessage('') }
  const visible = assets.filter(asset => `${asset.assetNumber} ${asset.name} ${asset.model} ${asset.category}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <section className="assets" aria-label="장비 관리">
    <div className="assets-title"><div><div className="eyebrow">EQUIPMENT</div><h1>장비 목록</h1><p>업무에 필요한 장비와 보관 위치를 확인하세요.</p></div>
      {user.role === 'admin' ? <button className="primary" onClick={() => { setMode('create'); setSelected(null); setDraft({ ...empty }); setError(''); setMessage('') }}>+ 장비 등록</button> : null}
    </div>
    {error ? <div className="notice error" role="alert">{error}<button onClick={() => { setError(''); setVersion(value => value + 1) }}>다시 조회</button></div> : null}
    {message ? <p className="notice" role="status">{message}</p> : null}
    <div className="asset-layout"><div className="asset-list">
      <div className="list-tools"><label htmlFor="asset-search" className="sr-only">장비 검색</label><input id="asset-search" value={search} onChange={event => setSearch(event.target.value)} placeholder="장비명, 자산번호, 모델 검색" /><span>전체 {assets.length}대</span></div>
      {loading ? <p className="empty" role="status">장비를 불러오고 있습니다.</p> : visible.length === 0 ? <div className="empty"><h2>{assets.length ? '검색 결과가 없습니다.' : '아직 등록된 장비가 없습니다.'}</h2><p>{user.role === 'admin' ? '장비 등록 버튼으로 첫 장비를 추가하세요.' : '관리자가 장비를 등록하면 여기에 표시됩니다.'}</p></div> :
      <div className="table-scroll"><table><thead><tr><th>장비</th><th>분류</th><th>보관 위치</th><th>상태</th></tr></thead><tbody>{visible.map(asset => <tr key={asset.id} className={selected === asset.id ? 'selected' : ''}><td><button className="asset-link" onClick={() => open(asset)}>{asset.name}</button><small>{asset.assetNumber} · {asset.model || '모델 미입력'}</small></td><td>{asset.category || '—'}</td><td>{asset.location || '—'}</td><td><span className="badge">{statusLabels[asset.status]||asset.status}</span></td></tr>)}</tbody></table></div>}
    </div><aside className="asset-panel" aria-label="장비 상세">
      {mode !== 'view' ? <form onSubmit={save}>
        <h2>{mode === 'create' ? '새 장비 등록' : '장비 정보 수정'}</h2><p className="muted">* 표시는 필수 항목입니다.</p>
        {fields.map(field => <label className="field" key={field.key}>{field.label}{field.required ? ' *' : ''}<input required={field.required} maxLength={field.max} value={draft[field.key]} onChange={event => setDraft({ ...draft, [field.key]: event.target.value })} disabled={busy} /></label>)}
        <label className="field">설명<textarea rows={3} maxLength={2000} value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} disabled={busy} /></label>
        <div className="actions"><button type="button" disabled={busy} onClick={() => setMode('view')}>취소</button><button className="primary" disabled={busy}>{busy ? '저장 중…' : '저장'}</button></div>
      </form> : detailLoading ? <p role="status">상세 정보를 불러오는 중입니다.</p> : detail ? <>
        <div className="eyebrow">ASSET DETAILS</div><h2>{detail.name}</h2><span className="badge">{statusLabels[detail.status]||detail.status}</span>
        <dl>{fields.filter(field => field.key !== 'name').map(field => <div key={field.key}><dt>{field.label}</dt><dd>{detail[field.key] || '—'}</dd></div>)}<div><dt>설명</dt><dd className="description">{detail.description || '등록된 설명이 없습니다.'}</dd></div></dl>
        {user.role === 'employee' && detail.status === 'available' ? <LoanRequestForm key={detail.id} assetId={detail.id} resetVersion={requestResetVersion} onSubmitted={() => onRequestCreated?.()} /> : null}
        {user.role === 'admin' ? <button onClick={() => { setDraft({ assetNumber: detail.assetNumber, name: detail.name, model: detail.model, category: detail.category, location: detail.location, description: detail.description }); setMode('edit'); setError('') }}>장비 정보 수정</button> : null}
      </> : <div className="panel-placeholder"><h2>장비 상세 정보</h2><p>목록에서 장비명을 선택하면<br />상세 정보를 확인할 수 있습니다.</p></div>}
    </aside></div>
  </section>
}
