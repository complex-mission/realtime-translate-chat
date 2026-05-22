import { NextRequest } from 'next/server'
import { getUser, signAccessToken, genJti, track } from '@/lib/auth'
import { execute, queryOne } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { uploadToOSS, generateAvatarKey, getSignedURL, isOSSConfigured } from '@/lib/oss'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'
import type { User } from '@/types'

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024
const AVATAR_SIZE = 300 // PRD: 300x300 正方形
const AVATAR_QUALITY = 85 // PRD: WebP 质量 85

export async function POST(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const fd = await req.formData()
  const file = fd.get('avatar') as File
  if (!file) return errResponse('SYS_PARAM')
  if (file.size > MAX_SIZE) return errResponse('SYS_PARAM')
  if (!ALLOWED.includes(file.type)) return errResponse('SYS_PARAM')

  const buffer = Buffer.from(await file.arrayBuffer())

  // PRD: 统一处理为 300x300 WebP
  const processed = await sharp(buffer)
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'center' })
    .webp({ quality: AVATAR_QUALITY })
    .toBuffer()

  let avatarUrl: string
  let ossKey: string | null = null

  if (isOSSConfigured()) {
    ossKey = generateAvatarKey(u.id, 'webp')
    await uploadToOSS(processed, ossKey, 'image/webp')
    avatarUrl = getSignedURL(ossKey, 86400)
  } else {
    const fn = 'avatar_' + u.id + '_' + randomUUID() + '.webp'
    const dir = join(process.cwd(), 'public', 'uploads', 'avatars')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, fn), processed)
    avatarUrl = '/uploads/avatars/' + fn
  }

  const storedPath = ossKey || avatarUrl
  await execute('UPDATE users SET avatar_url=? WHERE id=?', [storedPath, u.id])

  const fresh = await queryOne<User>('SELECT * FROM users WHERE id=?', [u.id])
  if (!fresh) return errResponse('USER_NOT_FOUND')

  const jti = genJti()
  const at = signAccessToken(fresh, jti)
  await track(u.id, jti)

  return okResponse({ avatar_url: avatarUrl, access_token: at })
}
