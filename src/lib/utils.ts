export function generateInviteCode(): string {
  const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''; for (let i = 0; i < 12; i++) s += c[Math.floor(Math.random() * c.length)]; return s
}
export function validatePassword(pw: string): string | null {
  if (pw.length < 8) return '密码长度至少8位'
  if (/^\d+$/.test(pw)) return '密码不能是纯数字'
  if (/^[a-z]+$/.test(pw)) return '密码不能是纯小写字母'
  if (/^[A-Z]+$/.test(pw)) return '密码不能是纯大写字母'
  if ([/[A-Z]/,/[a-z]/,/\d/,/[!@#$%^&*]/].filter(r=>r.test(pw)).length < 2) return '密码必须包含至少两种字符类型'
  return null
}
