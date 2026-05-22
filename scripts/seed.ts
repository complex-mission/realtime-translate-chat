import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'
export async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST||'127.0.0.1', port: parseInt(process.env.DB_PORT||'3306'),
    user: process.env.DB_USER||'root', password: process.env.DB_PASSWORD||'', database: process.env.DB_NAME||'rt_translate', charset: 'utf8mb4',
  })
  const au = process.env.ADMIN_USERNAME||'admin', ap = process.env.ADMIN_PASSWORD||'Admin@12345', an = process.env.ADMIN_NICKNAME||'管理员'
  const [ex] = await conn.execute('SELECT id FROM users WHERE username=?',[au])
  if((ex as any[]).length){console.log('Admin "'+au+'" already exists');await conn.end();return}
  const h = await bcrypt.hash(ap, 12)
  await conn.execute('INSERT INTO users (username,password_hash,nickname,role,must_change_pw) VALUES (?,?,?,?,FALSE)',[au,h,an,'admin'])
  console.log('✅ Admin "'+au+'" created with password "'+ap+'"')
  console.log('⚠️  Change the password after first login!')
  await conn.end()
}
if (require.main === module) {
  seed().catch(e=>{console.error(e);process.exit(1)})
}
