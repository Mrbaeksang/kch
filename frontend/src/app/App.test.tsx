import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

test('shows a connected service without offering an unfinished login', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (path: string) => {
    if (path === '/api/auth/config') return Response.json({ developmentLogin: false })
    if (path === '/api/auth/me') return Response.json({}, { status: 401 })
    return Response.json({ status: 'ok', database: 'connected' })
  }))
  render(<App />)
  await screen.findByText('서비스 연결됨')
  expect((screen.getByRole('button', { name: 'Google 로그인 준비 중' }) as HTMLButtonElement).disabled).toBe(true)
})

test('explains when the service is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({}, { status: 503 })))
  render(<App />)
  await screen.findByText('서비스 연결 확인 필요')
})

test('a development account can log in and log out', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (path: string) => {
    if (path === '/api/auth/config') return Response.json({ developmentLogin: true })
    if (path === '/api/auth/me') return Response.json({}, { status: 401 })
    if (path === '/api/auth/dev-login') return Response.json({ id: 1, email: 'admin@example.invalid', role: 'admin', active: true })
    if (path === '/api/assets') return Response.json([])
    return Response.json({ status: 'ok', database: 'connected' })
  }))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: '관리자 테스트 로그인' }))
  await screen.findByText('관리자로 로그인했습니다.')
  fireEvent.click(screen.getByRole('button', { name: '로그아웃' }))
  await screen.findByRole('button', { name: '직원 테스트 로그인' })
})
