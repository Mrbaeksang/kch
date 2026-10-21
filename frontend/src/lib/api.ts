export async function checkConnection(signal: AbortSignal): Promise<void> {
  const response = await fetch('/api/readyz', { signal })
  if (!response.ok) throw new Error('서비스에 연결할 수 없습니다.')
  const result = await response.json()
  if (result.status !== 'ok' || result.database !== 'connected') {
    throw new Error('서비스를 준비하고 있습니다.')
  }
}
