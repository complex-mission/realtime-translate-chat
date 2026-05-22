import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { query, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { generateInviteCode } from '@/lib/utils'
export async function GET(req: NextRequest) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const sql = u.role==='admin'
    ? 'SELECT r.*,(SELECT COUNT(*) FROM room_members WHERE room_id=r.id) as member_count FROM rooms r ORDER BY r.created_at DESC'
    : 'SELECT r.*,(SELECT COUNT(*) FROM room_members WHERE room_id=r.id) as member_count FROM rooms r INNER JOIN room_members rm ON r.id=rm.room_id WHERE rm.user_id=? ORDER BY r.created_at DESC'
  return okResponse(await query(sql, u.role==='admin'?[]:[u.id]))
}
export async function POST(req: NextRequest) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  if(u.role==='member') return errResponse('USER_NO_PERM')
  const {name,description,user_ids} = await req.json()
  if(!name?.trim()) return errResponse('ROOM_NAME_REQUIRED')
  if(!user_ids?.length) return errResponse('ROOM_NO_INVITEES')
  const ic = generateInviteCode()
  const r = await execute('INSERT INTO rooms (name,description,creator_id,invite_code) VALUES (?,?,?,?)',[name.trim(),description||null,u.id,ic])
  await execute('INSERT INTO room_members (room_id,user_id,role) VALUES (?,?,?)',[r.insertId,u.id,'leader'])
  for(const uid of user_ids) if(uid!==u.id) await execute('INSERT IGNORE INTO room_members (room_id,user_id) VALUES (?,?)',[r.insertId,uid]).catch(()=>{})
  return okResponse({id:r.insertId,invite_code:ic},201)
}
