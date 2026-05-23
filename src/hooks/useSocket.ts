'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

let sock: Socket | null = null

export function useSocket(token: string | null) {
  const [connected, setConnected] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [kicked, setKicked] = useState(false)
  const [kickMessage, setKickMessage] = useState<string | null>(null)
  const ref = useRef<Socket | null>(null)

  useEffect(() => {
    if (!token) return

    if (!sock) {
      sock = io(process.env.NEXT_PUBLIC_APP_URL || window.location.origin, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        reconnectionAttempts: 10,
      })
    }

    ref.current = sock

    sock.on('connect', () => { setConnected(true); setAuthError(false); setKicked(false); setKickMessage(null) })
    sock.on('disconnect', (reason) => {
      setConnected(false)
      // 鉴权失败不重连
      if (reason === 'io server disconnect') {
        setAuthError(true)
        sessionStorage.clear()
        window.location.href = '/login'
      }
    })
    sock.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message)
      if (err.message.includes('AUTH') || err.message.includes('TOKEN')) {
        setAuthError(true)
        sock?.disconnect()
      }
    })
    
    // Handle kicked event (single device login)
    sock.on('error', (data) => {
      if (data?.message?.includes('其他设备登录')) {
        console.log('[Socket] Kicked by another device')
        setKicked(true)
        setKickMessage(data.message)
        
        // Dispatch a custom event to notify RTC to cleanup
        window.dispatchEvent(new CustomEvent('rtc-kicked', { detail: { message: data.message } }))
        
        // Disconnect socket
        sock?.disconnect()
        sessionStorage.clear()
      }
    })

    return () => { /* keep connection alive */ }
  }, [token])

  const joinRoom = useCallback((roomId: number) => { sock?.emit('join_room', { room_id: roomId }) }, [])
  const leaveRoom = useCallback((roomId: number) => { sock?.emit('leave_room', { room_id: roomId }) }, [])
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    sock?.on(event, handler)
    return () => { sock?.off(event, handler) }
  }, [])

  return { socket: ref.current, connected, authError, kicked, kickMessage, joinRoom, leaveRoom, on }
}
