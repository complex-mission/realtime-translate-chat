import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { errResponse, okResponse } from '@/lib/errors'
import { query } from '@/lib/db'

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')
  
  const rid = parseInt((await params).roomId)
  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const before = searchParams.get('before') // timestamp for pagination

  try {
    let sql = `SELECT id, room_id, user_id, source_lang, text_zh, text_en, text_ja, created_at 
               FROM live_translations 
               WHERE room_id = ?`
    const params: any[] = [rid]

    if (before) {
      sql += ` AND created_at < ?`
      params.push(before)
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)

    const translations = await query(sql, params)
    
    return okResponse(translations)
  } catch (err: any) {
    console.error('Failed to fetch live translations:', err)
    return errResponse('SYS_INTERNAL')
  }
}
