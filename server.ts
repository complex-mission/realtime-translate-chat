import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initSocket } from './src/socket'
import { migrate } from './scripts/migrate'
import { seed } from './scripts/seed'
import { stopDbKeepAlive } from './src/lib/db'
import pool from './src/lib/db'
const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || '19716')
const app = next({ dev })
const handle = app.getRequestHandler()
migrate().then(() => seed()).then(() => app.prepare()).then(() => {
  const server = createServer((req, res) => { handle(req, res, parse(req.url!, true)) })
  initSocket(server)
  server.listen(port, '127.0.0.1', () => { console.log('> Ready on http://127.0.0.1:'+port) })

  const shutdown = async () => {
    console.log('\n[Server] 正在关闭...')
    stopDbKeepAlive()
    server.close()
    await pool.end().catch(() => {})
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}).catch((err) => {
  console.error('[Server] 启动失败:', err)
  process.exit(1)
})
