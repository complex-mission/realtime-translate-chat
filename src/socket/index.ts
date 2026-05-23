import { Server as SIO } from 'socket.io'
import type { Server as HTTP } from 'http'
import { verifyAccess, isRevoked } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import redis from '@/lib/redis'
import type { User } from '@/types'

let io: SIO | null = null
export function getIO() { return io }

export function initSocket(server: HTTP) {
  io = new SIO(server, {
    cors: {
      origin: (process.env.ALLOWED_ORIGINS || process.env.APP_URL || 'http://localhost:19716')
        .split(',').map(s => s.trim()),
      credentials: true,
    },
    pingInterval: 25000, pingTimeout: 60000,
  })
  // 存到 globalThis，解决 Next.js API 路由是独立 bundle 导致 io 为 null 的问题
  ;(globalThis as any).__socket_io = io

  // PRD 6.2: 鉴权中间件
  io.use(async (s, next) => {
    try {
      const t = s.handshake.auth?.token
      if (!t) return next(new Error('NO_TOKEN'))
      const p = verifyAccess(t)
      if (!p) return next(new Error('BAD_TOKEN'))
      if (await isRevoked(p.jti)) return next(new Error('REVOKED'))
      const u = await queryOne<User>('SELECT * FROM users WHERE id=?', [p.sub])
      if (!u || u.status !== 'active') return next(new Error('BAD_USER'))
      s.data.user = u
      next()
    } catch (e: any) {
      next(new Error('AUTH_FAIL'))
    }
  })

  io.on('connection', (s) => {
    const u: User = s.data.user

    // PRD 九: user:online:{userId} - 在线状态
    redis.hset('user:online:' + u.id, { socketId: s.id, ts: Date.now().toString() })
    redis.expire('user:online:' + u.id, 60)

    // PRD 16.12: heartbeat
    s.on('heartbeat', () => {
      redis.hset('user:online:' + u.id, { ts: Date.now().toString() })
      redis.expire('user:online:' + u.id, 60)
    })

    // PRD 16.12: join_room - 一个用户同时只在一个房间 (PRD 4.4)
    s.on('join_room', async ({ room_id }: { room_id: number }) => {
      const prev = await redis.hget('user:online:' + u.id, 'currentRoom')
      if (prev) {
        s.leave('room:' + prev)
        await redis.srem('room:members:' + prev, String(u.id))
      }
      s.join('room:' + room_id)
      await redis.hset('user:online:' + u.id, { currentRoom: String(room_id) })
      await redis.sadd('room:members:' + room_id, String(u.id))
      await redis.expire('room:members:' + room_id, 60)
      const room = io?.sockets?.adapter?.rooms?.get('room:' + room_id)
    })

    // PRD 16.12: leave_room
    s.on('leave_room', async ({ room_id }: { room_id: number }) => {
      s.leave('room:' + room_id)
      await redis.srem('room:members:' + room_id, String(u.id))
      await redis.hdel('user:online:' + u.id, 'currentRoom')
    })

    // 断开连接
    s.on('disconnect', async () => {
      const cr = await redis.hget('user:online:' + u.id, 'currentRoom')
      if (cr) {
        await redis.srem('room:members:' + cr, String(u.id))
        
        // Check if user was in a call and handle leave
        const callActive = await redis.get('call:active:' + cr)
        if (callActive) {
          const csId = parseInt(callActive)
          // Mark user as left in the call
          const { execute } = await import('@/lib/db')
          await execute(
            'UPDATE call_participants SET left_at=NOW() WHERE call_session_id=? AND user_id=? AND left_at IS NULL',
            [csId, u.id]
          )
          // Broadcast participant left event
          emitToRoom(parseInt(cr), 'call:participant_left', { 
            call_session_id: csId, 
            user_id: u.id 
          })
          
          // Check if anyone is still in the call
          const { queryOne } = await import('@/lib/db')
          const cnt = await queryOne<any>(
            'SELECT COUNT(*) as c FROM call_participants WHERE call_session_id=? AND left_at IS NULL',
            [csId]
          )
          if (!cnt?.c) {
            // End the call if no one is left
            await execute("UPDATE call_sessions SET status='ended',ended_at=NOW() WHERE id=?", [csId])
            await redis.del('call:active:' + cr)
            const sr = await execute(
              'INSERT INTO messages (room_id,sender_id,msg_type,content) VALUES (?,?,?,?)',
              [parseInt(cr), u.id, 'system', '通话已结束']
            )
            emitToRoom(parseInt(cr), 'message:new', {
              id: sr.insertId,
              room_id: parseInt(cr),
              sender_id: u.id,
              msg_type: 'system',
              content: '通话已结束',
              created_at: new Date().toISOString()
            })
            emitToRoom(parseInt(cr), 'call:ended', {
              call_session_id: csId,
              ended_at: new Date().toISOString()
            })
          }
        }
      }
      await redis.del('user:online:' + u.id)
    })
  })

  return io
}

// ─── 事件发射辅助函数 ───

// PRD 16.12: message:new - 新消息推送
export function emitToRoom(rid: number, event: string, data: any) {
  const instance = io || (globalThis as any).__socket_io
  instance?.to('room:' + rid).emit(event, data)
}

// PRD 16.12: subtitle:stream - 实时字幕流
// is_final=false: 流式中间结果 → 卡片浮层显示
// is_final=true: 本句最终结果 → 同时入库为 voice_transcript 消息
export function emitSubtitle(rid: number, data: {
  user_id: number; call_session_id: number
  text_original: string; text_translated: string
  lang_target: string; is_final: boolean
}) {
  io?.to('room:' + rid).emit('subtitle:stream', data)
}

// PRD 16.12: user:speaking - 发言音量回调
export function emitSpeaking(rid: number, data: { user_id: number; volume: number }) {
  io?.to('room:' + rid).emit('user:speaking', data)
}

// PRD 16.12: call:started / call:ended / call:participant_joined / call:participant_left
// 这些事件通过 emitToRoom 在 API 路由中发射

// PRD 16.12: error - 错误推送
export function emitError(rid: number, code: string, message: string) {
  io?.to('room:' + rid).emit('error', { code, message_i18n: { zh: message } })
}
