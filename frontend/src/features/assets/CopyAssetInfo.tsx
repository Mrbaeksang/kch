import { useEffect, useRef, useState } from 'react'

type CopyableAsset = { assetNumber: string; name: string; model: string; category: string; location: string }
const lines: { key: keyof CopyableAsset; label: string }[] = [
  { key: 'assetNumber', label: '자산번호' },
  { key: 'name', label: '장비명' },
  { key: 'model', label: '모델' },
  { key: 'category', label: '분류' },
  { key: 'location', label: '보관 위치' },
]

export function CopyAssetInfo({ asset, statusLabel }: { asset: CopyableAsset; statusLabel: string }) {
  const [result, setResult] = useState<'idle' | 'copied' | 'failed'>('idle')
  const manual = useRef<HTMLTextAreaElement>(null)
  const text = ['[장비 정보]', ...lines.map(line => `${line.label}: ${asset[line.key] || '미입력'}`), `현재 상태: ${statusLabel}`].join('\n')
  useEffect(() => { if (result === 'failed') manual.current?.select() }, [result])
  async function copy() {
    try { await navigator.clipboard.writeText(text); setResult('copied') }
    catch { setResult('failed') }
  }
  return <>
    <button type="button" onClick={copy}>장비 정보 복사</button>
    {result === 'copied' ? <p className="notice" role="status">장비 정보를 복사했습니다.</p> : null}
    {result === 'failed' ? <>
      <p className="notice error" role="alert">자동 복사에 실패했습니다. 아래 내용을 선택해 복사하세요.</p>
      <textarea ref={manual} readOnly rows={7} aria-label="복사할 장비 정보" value={text} onFocus={event => event.target.select()} />
    </> : null}
  </>
}
