import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { queryOne } from './db'
import redis from './redis'
import type { User } from '@/types'

function getAS() { return process.env.JWT_ACCESS_SECRET || 'dev_access_secret_32chars_long!!' }
function getRS() { return process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_32chars_long!' }

export interface JwtPayload { sub: number; jti: string; iat: number; exp: number; issued_at_user_ts: string; fingerprint?: string }

export async function hashPassword(pw: string) { return bcrypt.hash(pw, 12) }
export async function verifyPassword(pw: string, h: string) { return bcrypt.compare(pw, h) }
export function genJti() { return Date.now()+'_'+Math.random().toString(36).slice(2,10) }

export function signAccessToken(u: User, jti: string, fp?: string) {
  return jwt.sign({ sub: u.id, jti, fingerprint: fp, issued_at_user_ts: u.updated_at }, getAS(), { expiresIn: '2h' })
}
export function signRefreshToken(uid: number, jti: string) {
  return jwt.sign({ sub: uid, jti }, getRS(), { expiresIn: '7d' })
}
export function verifyAccess(t: string): JwtPayload | null { try { return jwt.verify(t, getAS()) as unknown as JwtPayload } catch { return null } }
export function verifyRefresh(t: string) { try { return jwt.verify(t, getRS()) as any } catch { return null } }

export async function isRevoked(jti: string) { return (await redis.get('jwt:blacklist:'+jti)) !== null }
export async function revoke(jti: string, ttl: number) { await redis.setex('jwt:blacklist:'+jti, ttl, '1') }
export async function revokeAll(uid: number) {
  const jtis = await redis.smembers('jwt:user_tokens:'+uid)
  if (jtis.length) { const p = redis.pipeline(); jtis.forEach(j=>p.setex('jwt:blacklist:'+j,7200,'1')); p.del('jwt:user_tokens:'+uid); await p.exec() }
}
export async function track(uid: number, jti: string) { await redis.sadd('jwt:user_tokens:'+uid, jti) }

export async function getUser(req: Request): Promise<User | null> {
  const h = req.headers.get('authorization')
  if (!h?.startsWith('Bearer ')) return null
  const token = h.slice(7)
  const p = verifyAccess(token)
  if (!p) return null
  if (await isRevoked(p.jti)) return null
  const u = await queryOne<User>('SELECT * FROM users WHERE id=?', [p.sub])
  if (!u || u.status !== 'active') return null
  const raw = u.updated_at as unknown
  const userTs = raw instanceof Date ? raw.toISOString() : String(raw)
  if (userTs !== p.issued_at_user_ts) {
    await revoke(p.jti, 7200); return null
  }
  return u
}
