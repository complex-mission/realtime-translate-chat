import { NextRequest } from 'next/server'
import { getUser } from '@/lib/auth'
import { getSignedURL, isOSSConfigured } from '@/lib/oss'
import { errResponse, okResponse } from '@/lib/errors'

// PRD: OSS 图片签名 URL 刷新接口
// 前端在图片 URL 过期时调用此接口获取新的签名 URL
// 支持批量请求

export async function POST(req: NextRequest) {
  const u = await getUser(req)
  if (!u) return errResponse('AUTH_TOKEN_INVALID')

  const { keys } = await req.json()
  if (!Array.isArray(keys) || keys.length === 0) return errResponse('SYS_PARAM')
  if (keys.length > 50) return errResponse('SYS_PARAM') // 最多50个

  // 如果没配 OSS，直接返回原始 key（本地文件）
  if (!isOSSConfigured()) {
    const urls: Record<string, string> = {}
    for (const key of keys) {
      urls[key] = key // 本地路径直接返回
    }
    return okResponse({ urls })
  }

  // 批量生成签名 URL（24小时有效）
  const urls: Record<string, string> = {}
  for (const key of keys) {
    urls[key] = getSignedURL(key, 86400)
  }

  return okResponse({ urls })
}
