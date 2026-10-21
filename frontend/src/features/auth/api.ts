export type User = { id: number; email: string; role: 'admin' | 'employee'; active: boolean }

export async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.')
  return result as T
}
