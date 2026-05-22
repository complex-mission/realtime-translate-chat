import { NextResponse } from 'next/server'
export const ERR = {
  AUTH_INVALID_CREDENTIALS: { code: 'AUTH_INVALID_CREDENTIALS_1001', http: 401, i18n: { zh: '用户名或密码错误', en: 'Invalid credentials', ja: '認証情報が無効です' } },
  AUTH_FROZEN_TEMP: { code: 'AUTH_FROZEN_TEMP_1002', http: 403, i18n: { zh: '账号已临时冻结', en: 'Temporarily frozen', ja: '一時凍結' } },
  AUTH_FROZEN_PERM: { code: 'AUTH_FROZEN_PERM_1003', http: 403, i18n: { zh: '账号已永久冻结', en: 'Permanently frozen', ja: '永久凍結' } },
  AUTH_TOKEN_EXPIRED: { code: 'AUTH_TOKEN_EXPIRED_1004', http: 401, i18n: { zh: 'Token已过期', en: 'Token expired', ja: 'トークン期限切れ' } },
  AUTH_TOKEN_INVALID: { code: 'AUTH_TOKEN_INVALID_1005', http: 401, i18n: { zh: 'Token无效', en: 'Invalid token', ja: '無効トークン' } },
  AUTH_TOKEN_REVOKED: { code: 'AUTH_TOKEN_REVOKED_1006', http: 401, i18n: { zh: 'Token已被吊销', en: 'Token revoked', ja: 'トークン取消済' } },
  AUTH_MUST_CHANGE_PW: { code: 'AUTH_MUST_CHANGE_PW_1009', http: 403, i18n: { zh: '请先修改密码', en: 'Change password first', ja: 'PW変更要' } },
  AUTH_PASSWORD_WEAK: { code: 'AUTH_PASSWORD_WEAK_1010', http: 400, i18n: { zh: '密码强度不足', en: 'Weak password', ja: 'PW弱い' } },
  AUTH_PASSWORD_SAME: { code: 'AUTH_PASSWORD_SAME_1011', http: 400, i18n: { zh: '新旧密码相同', en: 'Same password', ja: '同一PW' } },
  AUTH_IP_RATE: { code: 'AUTH_IP_RATE_1012', http: 429, i18n: { zh: '请求过于频繁', en: 'Too many requests', ja: 'リクエスト多すぎ' } },
  AUTH_REFRESH_INVALID: { code: 'AUTH_REFRESH_INVALID_1014', http: 401, i18n: { zh: 'Refresh Token无效', en: 'Invalid refresh', ja: '無効Refresh' } },
  USER_NOT_FOUND: { code: 'USER_NOT_FOUND_2001', http: 404, i18n: { zh: '用户不存在', en: 'User not found', ja: 'ユーザー未発見' } },
  USER_DUPLICATE: { code: 'USER_DUPLICATE_2002', http: 409, i18n: { zh: '用户名已存在', en: 'Username exists', ja: 'ユーザー名既存' } },
  USER_NO_PERM: { code: 'USER_NO_PERM_2003', http: 403, i18n: { zh: '无权限', en: 'No permission', ja: '権限なし' } },
  ROOM_NOT_FOUND: { code: 'ROOM_NOT_FOUND_3001', http: 404, i18n: { zh: '聊天室不存在', en: 'Room not found', ja: 'ルーム未発見' } },
  ROOM_NOT_INVITED: { code: 'ROOM_NOT_INVITED_3002', http: 403, i18n: { zh: '未被邀请', en: 'Not invited', ja: '未招待' } },
  ROOM_NOT_LEADER: { code: 'ROOM_NOT_LEADER_3003', http: 403, i18n: { zh: '非室长', en: 'Not leader', ja: '非リーダー' } },
  ROOM_CLOSED: { code: 'ROOM_CLOSED_3004', http: 400, i18n: { zh: '聊天室已关闭', en: 'Room closed', ja: 'ルーム閉鎖' } },
  ROOM_INVITE_INVALID: { code: 'ROOM_INVITE_INVALID_3005', http: 404, i18n: { zh: '邀请码无效', en: 'Invalid invite', ja: '無効招待コード' } },
  ROOM_NAME_REQUIRED: { code: 'ROOM_NAME_REQUIRED_3008', http: 400, i18n: { zh: '名称不能为空', en: 'Name required', ja: '名前必須' } },
  ROOM_NO_INVITEES: { code: 'ROOM_NO_INVITEES_3009', http: 400, i18n: { zh: '至少邀请1人', en: 'Invite >= 1', ja: '最低1人招待' } },
  MSG_NOT_FOUND: { code: 'MSG_NOT_FOUND_4001', http: 404, i18n: { zh: '消息不存在', en: 'Not found', ja: '未発見' } },
  MSG_EMPTY: { code: 'MSG_EMPTY_4002', http: 400, i18n: { zh: '消息为空', en: 'Empty', ja: '空' } },
  MSG_TOO_LONG: { code: 'MSG_TOO_LONG_4003', http: 400, i18n: { zh: '超出5000字符', en: 'Too long', ja: '長すぎ' } },
  MSG_IMAGE_TOO_LARGE: { code: 'MSG_IMAGE_TOO_LARGE_4004', http: 413, i18n: { zh: '图片超10MB', en: 'Image too large', ja: '画像大' } },
  MSG_ROOM_CLOSED: { code: 'MSG_ROOM_CLOSED_4006', http: 400, i18n: { zh: '聊天室已关闭', en: 'Room closed', ja: '閉鎖済' } },
  MSG_SEARCH_EMPTY: { code: 'MSG_SEARCH_EMPTY_4007', http: 400, i18n: { zh: '检索词为空', en: 'Empty query', ja: '空検索' } },
  TRANS_LANG_INVALID: { code: 'TRANS_LANG_INVALID_5001', http: 400, i18n: { zh: '目标语言非法', en: 'Invalid lang', ja: '無効言語' } },
  TRANS_TIMEOUT: { code: 'TRANS_TIMEOUT_5002', http: 502, i18n: { zh: '翻译超时', en: 'Timeout', ja: 'タイムアウト' } },
  TRANS_RATE: { code: 'TRANS_RATE_5004', http: 429, i18n: { zh: '翻译过频', en: 'Rate limit', ja: 'レート制限' } },
  CALL_NOT_FOUND: { code: 'CALL_NOT_FOUND_6003', http: 404, i18n: { zh: '通话不存在', en: 'Call not found', ja: '通話未発見' } },
  SUMMARY_NO_MSG: { code: 'SUMMARY_NO_MSG_7001', http: 400, i18n: { zh: '无消息', en: 'No messages', ja: 'メッセージなし' } },
  SUMMARY_FAILED: { code: 'SUMMARY_FAILED_7002', http: 502, i18n: { zh: '纪要生成失败', en: 'Failed', ja: '失敗' } },
  SUMMARY_NOT_FOUND: { code: 'SUMMARY_NOT_FOUND_7003', http: 404, i18n: { zh: '纪要不存在', en: 'Not found', ja: '未発見' } },
  GLOSSARY_EMPTY: { code: 'GLOSSARY_EMPTY_8001', http: 400, i18n: { zh: '至少填一个语种', en: 'Need 1 lang', ja: '1言語必要' } },
  GLOSSARY_NOT_FOUND: { code: 'GLOSSARY_NOT_FOUND_8003', http: 404, i18n: { zh: '术语不存在', en: 'Not found', ja: '未発見' } },
  SYS_INTERNAL: { code: 'SYS_INTERNAL_9001', http: 500, i18n: { zh: '服务器错误', en: 'Internal error', ja: '内部エラー' } },
  SYS_PARAM: { code: 'SYS_PARAM_9005', http: 400, i18n: { zh: '参数错误', en: 'Invalid params', ja: 'パラメータエラー' } },
} as const
export type ErrorCodeKey = keyof typeof ERR
export function errResponse(key: ErrorCodeKey) {
  const e = ERR[key]
  return NextResponse.json({ success: false, error: { code: e.code, message_i18n: e.i18n }, request_id: 'req_'+Date.now() }, { status: e.http })
}
export function okResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data, request_id: 'req_'+Date.now() }, { status })
}
