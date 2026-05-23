import mysql from 'mysql2/promise'

let _pool: mysql.Pool | null = null
function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1', port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rt_translate',
      waitForConnections: true, connectionLimit: 20, charset: 'utf8mb4', timezone: '+08:00',
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 30000,
    })
  }
  return _pool
}

const pool = new Proxy({} as mysql.Pool, {
  get(_, prop, receiver) {
    const target = getPool()
    const val = Reflect.get(target, prop, receiver)
    return typeof val === 'function' ? val.bind(target) : val
  },
})

export default pool
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const [rows] = await getPool().query(sql, params); return rows as T[]
}
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params); return rows[0] || null
}
export async function execute(sql: string, params?: any[]): Promise<any> {
  const [result] = await getPool().execute(sql, params); return result
}

// 应用层 Keep-Alive：定期 ping 重置 MySQL wait_timeout（默认 8h）
const DB_KEEPALIVE_MS = 45_000
let keepAliveFailCount = 0
const dbKeepAlive = setInterval(async () => {
  try {
    await getPool().query('SELECT 1')
    keepAliveFailCount = 0
  } catch (e: any) {
    keepAliveFailCount++
    if (keepAliveFailCount >= 3) {
      console.warn(`[DB] keepalive 连续失败 ${keepAliveFailCount} 次: ${e.code || e.message}`)
    }
  }
}, DB_KEEPALIVE_MS)

export function stopDbKeepAlive() {
  clearInterval(dbKeepAlive)
}
