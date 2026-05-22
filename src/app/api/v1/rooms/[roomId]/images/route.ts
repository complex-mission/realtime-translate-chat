import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { queryOne, execute } from '@/lib/db'
import { errResponse, okResponse } from '@/lib/errors'
import { emitToRoom } from '@/socket'
import { uploadToOSS, generateImageKey, getSignedURL, isOSSConfigured } from '@/lib/oss'
import { signURL } from '@/lib/url-sign'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'
import sharp from 'sharp'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 20 * 1024 * 1024 // 单张最大20MB
const THUMB_MAX_WIDTH = 400
const THUMB_QUALITY = 85

// 获取文件扩展名（小写）
const getExt = (filename: string, mimeType: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext
  }
  // 根据 MIME 类型推断
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  }
  return mimeMap[mimeType] || 'jpg'
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const rid = parseInt((await params).roomId)
  const room = await queryOne<any>('SELECT * FROM rooms WHERE id=?', [rid])
  if (!room) return errResponse('ROOM_NOT_FOUND')
  if (room.status === 'closed') return errResponse('MSG_ROOM_CLOSED')

  if (u.role !== 'admin' && !await queryOne('SELECT 1 FROM room_members WHERE room_id=? AND user_id=?', [rid, u.id]))
    return errResponse('ROOM_NOT_INVITED')

  const fd = await req.formData()
  const file = fd.get('image') as File
  if (!file) return errResponse('SYS_PARAM')
  if (file.size > MAX_SIZE) return errResponse('MSG_IMAGE_TOO_LARGE')
  if (!ALLOWED_TYPES.includes(file.type)) return errResponse('SYS_PARAM')

  const rawBuffer = Buffer.from(await file.arrayBuffer())
  const ext = getExt(file.name, file.type)

  // 原图：保持原始格式，不做转换
  const originalBuffer = rawBuffer

  // 缩略图：最大宽度 400px，等比缩放，转换为 WebP
  const thumbBuffer = await sharp(rawBuffer)
    .resize(THUMB_MAX_WIDTH, null, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer()

  let originalUrl: string
  let thumbUrl: string
  let ossKey: string | null = null

  if (isOSSConfigured()) {
    // 生产环境: 上传到阿里云 OSS
    ossKey = generateImageKey(rid, ext)
    const thumbKey = ossKey.replace(`.${ext}`, '_thumb.webp')
    
    await Promise.all([
      uploadToOSS(originalBuffer, ossKey, file.type),
      uploadToOSS(thumbBuffer, thumbKey, 'image/webp'),
    ])
    
    originalUrl = getSignedURL(ossKey, 86400)
    thumbUrl = getSignedURL(thumbKey, 86400)
  } else {
    // 开发环境: 存本地
    const uuid = randomUUID()
    const fn = uuid + '.' + ext
    const thumbFn = uuid + '_thumb.webp'
    const dir = join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    
    await Promise.all([
      writeFile(join(dir, fn), originalBuffer),
      writeFile(join(dir, thumbFn), thumbBuffer),
    ])
    
    originalUrl = '/uploads/' + fn
    thumbUrl = '/uploads/' + thumbFn
  }

  // 数据库存原图 key（有OSS时）或本地路径
  const storedPath = ossKey || originalUrl

  const r = await execute(
    'INSERT INTO messages (room_id,sender_id,msg_type,content) VALUES (?,?,?,?)',
    [rid, u.id, 'image', storedPath]
  )

  const msg = {
    id: r.insertId, room_id: rid, sender_id: u.id, msg_type: 'image',
    content: originalUrl,      // 原图 URL
    thumb_url: thumbUrl,       // 缩略图 URL
    original_lang: null, call_session_id: null,
    created_at: new Date().toISOString(),
    sender_nickname: u.nickname, sender_avatar: signURL(u.avatar_url),
  }
  emitToRoom(rid, 'message:new', msg)
  return okResponse(msg, 201)
}
