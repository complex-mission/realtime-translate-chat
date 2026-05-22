import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
export async function GET(req: NextRequest, {params}:{params:Promise<{summaryId:string}>}) {
  const u = await getUser(req); if(!u) return errResponse('AUTH_TOKEN_INVALID')
  const s = await queryOne('SELECT * FROM meeting_summaries WHERE id=?',[parseInt((await params).summaryId)])
  if(!s) return errResponse('SUMMARY_NOT_FOUND'); return okResponse(s)
}
