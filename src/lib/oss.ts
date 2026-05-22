import OSS from 'ali-oss'

// PRD 12.4: 阿里云 OSS 文件存储
// 图片存储路径: images/{roomId}/{date}/{uuid}.webp
// 头像存储路径: avatars/{userId}/{uuid}.webp

let uploadClient: OSS | null = null
let signClient: OSS | null = null

/**
 * 上传用 client — 生产环境同地域走内网 endpoint 免流量费，开发环境走外网
 */
function getUploadClient(): OSS {
  if (uploadClient) return uploadClient
  const useInternal = process.env.OSS_USE_INTERNAL === 'true'
  uploadClient = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    endpoint: (useInternal && process.env.OSS_INTERNAL_ENDPOINT) || process.env.OSS_ENDPOINT || undefined,
  })
  return uploadClient
}

/**
 * 签名用 client — 始终用外网 endpoint，浏览器需要公网访问
 */
function getSignClient(): OSS {
  if (signClient) return signClient
  signClient = new OSS({
    region: process.env.OSS_REGION || 'oss-cn-hangzhou',
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
    bucket: process.env.OSS_BUCKET || '',
    endpoint: process.env.OSS_ENDPOINT || undefined,
  })
  return signClient
}

export interface UploadResult {
  ossKey: string      // OSS 对象 key，存入数据库
  url: string         // 签名访问 URL
  size: number
}

/**
 * 上传文件到 OSS
 * @param buffer 文件内容
 * @param ossKey OSS 对象 key
 * @param contentType MIME 类型
 */
export async function uploadToOSS(
  buffer: Buffer,
  ossKey: string,
  contentType: string
): Promise<UploadResult> {
  const oss = getUploadClient()
  const result = await oss.put(ossKey, buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'max-age=31536000', // 1年缓存
    },
  })

  return {
    ossKey,
    url: result.url,
    size: buffer.length,
  }
}

/**
 * 生成签名访问 URL（临时授权）
 * @param ossKey OSS 对象 key
 * @param expires 过期时间（秒），默认 24 小时
 */
export function getSignedURL(ossKey: string, expires: number = 86400): string {
  // 开发环境或本地文件直接返回
  if (!ossKey || ossKey.startsWith('/uploads/')) {
    return ossKey
  }

  const oss = getSignClient()
  // ali-oss 的 signatureUrl 方法生成带签名的 URL
  const url = oss.signatureUrl(ossKey, {
    expires, // 秒
    method: 'GET',
  })
  return url
}

/**
 * 批量生成签名 URL
 * @param ossKeys OSS 对象 key 数组
 * @param expires 过期时间（秒）
 */
export function getBatchSignedURLs(ossKeys: string[], expires: number = 86400): Map<string, string> {
  const result = new Map<string, string>()
  for (const key of ossKeys) {
    result.set(key, getSignedURL(key, expires))
  }
  return result
}

/**
 * 生成图片上传路径
 * @param roomId 聊天室 ID
 * @param ext 文件扩展名
 */
export function generateImageKey(roomId: number, ext: string): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const uuid = crypto.randomUUID()
  return `images/${roomId}/${date}/${uuid}.${ext}`
}

/**
 * 生成头像上传路径
 * @param userId 用户 ID
 * @param ext 文件扩展名
 */
export function generateAvatarKey(userId: number, ext: string): string {
  const uuid = crypto.randomUUID()
  return `avatars/${userId}/${uuid}.${ext}`
}

/**
 * 检查是否配置了 OSS
 */
export function isOSSConfigured(): boolean {
  return !!(process.env.OSS_ACCESS_KEY_ID && process.env.OSS_ACCESS_KEY_SECRET && process.env.OSS_BUCKET)
}

/**
 * 删除 OSS 文件
 * @param ossKey OSS 对象 key
 */
export async function deleteFromOSS(ossKey: string): Promise<void> {
  if (!ossKey || ossKey.startsWith('/uploads/')) return
  const oss = getUploadClient()
  await oss.delete(ossKey)
}

/**
 * 批量删除 OSS 文件
 * @param ossKeys OSS 对象 key 数组
 */
export async function batchDeleteFromOSS(ossKeys: string[]): Promise<void> {
  if (!ossKeys.length) return
  const validKeys = ossKeys.filter(k => k && !k.startsWith('/uploads/'))
  if (!validKeys.length) return
  const oss = getUploadClient()
  await oss.deleteMulti(validKeys)
}
