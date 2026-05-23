import mysql from 'mysql2/promise'
export async function migrate() {
  const db = process.env.DB_NAME||'rt_translate'
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST||'127.0.0.1', port: parseInt(process.env.DB_PORT||'3306'),
    user: process.env.DB_USER||'root', password: process.env.DB_PASSWORD||'', database: db, multipleStatements: true, charset: 'utf8mb4',
  })
  await conn.query('CREATE DATABASE IF NOT EXISTS \`'+db+'\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci')
  await conn.query('USE \`'+db+'\`')
  console.log('Database "'+db+'" ready')

  await conn.execute(`CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, username VARCHAR(64) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL,
    nickname VARCHAR(64) NOT NULL, avatar_url VARCHAR(512) NULL, department VARCHAR(64) NULL,
    lang_pref VARCHAR(10) DEFAULT 'zh', role ENUM('admin','leader','member') DEFAULT 'member',
    status ENUM('active','frozen_temp','frozen_perm') DEFAULT 'active', must_change_pw BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role(role), INDEX idx_status(status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ users')

  await conn.execute(`CREATE TABLE IF NOT EXISTS rooms (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(128) NOT NULL, description TEXT NULL,
    creator_id BIGINT NOT NULL, invite_code VARCHAR(32) UNIQUE NOT NULL,
    status ENUM('active','closed') DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, closed_at DATETIME NULL,
    INDEX idx_creator(creator_id), INDEX idx_status(status), INDEX idx_invite(invite_code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ rooms')

  await conn.execute(`CREATE TABLE IF NOT EXISTS room_members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, room_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
    role ENUM('leader','member') DEFAULT 'member', joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_room_user(room_id, user_id), INDEX idx_user(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ room_members')

  await conn.execute(`CREATE TABLE IF NOT EXISTS messages (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, room_id BIGINT NOT NULL, sender_id BIGINT NOT NULL,
    msg_type ENUM('text','image','voice_transcript','system') NOT NULL, content TEXT NOT NULL,
    original_lang VARCHAR(10) NULL, call_session_id BIGINT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room_time(room_id, created_at), INDEX idx_sender(sender_id), INDEX idx_call(call_session_id),
    FULLTEXT INDEX ft_content(content)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ messages')

  await conn.execute(`CREATE TABLE IF NOT EXISTS translations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, message_id BIGINT NOT NULL, target_lang VARCHAR(10) NOT NULL,
    translated TEXT NOT NULL, model VARCHAR(64) NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_msg_lang(message_id, target_lang), INDEX idx_msg(message_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ translations')

  await conn.execute(`CREATE TABLE IF NOT EXISTS call_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, room_id BIGINT NOT NULL, started_by BIGINT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP, ended_at DATETIME NULL,
    status ENUM('active','ended') DEFAULT 'active', participant_count INT DEFAULT 0,
    INDEX idx_room(room_id), INDEX idx_status(status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ call_sessions')

  await conn.execute(`CREATE TABLE IF NOT EXISTS call_participants (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, call_session_id BIGINT NOT NULL, user_id BIGINT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, left_at DATETIME NULL,
    INDEX idx_call(call_session_id), INDEX idx_user(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ call_participants')

  await conn.execute(`CREATE TABLE IF NOT EXISTS meeting_summaries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, room_id BIGINT NOT NULL, triggered_by BIGINT NOT NULL,
    lang VARCHAR(10) NOT NULL, time_range_start DATETIME NULL, time_range_end DATETIME NULL,
    last_msg_id BIGINT NOT NULL, content LONGTEXT NOT NULL, model VARCHAR(64) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, INDEX idx_room_time(room_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ meeting_summaries')

  await conn.execute(`CREATE TABLE IF NOT EXISTS glossaries (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, scope ENUM('global','room') NOT NULL, room_id BIGINT NULL,
    term_zh VARCHAR(255) NULL, term_en VARCHAR(255) NULL, term_ja VARCHAR(255) NULL,
    note TEXT NULL, created_by BIGINT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_scope(scope), INDEX idx_room(room_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ glossaries')

  await conn.execute(`CREATE TABLE IF NOT EXISTS live_translations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT, room_id BIGINT NOT NULL, call_session_id BIGINT NULL,
    user_id BIGINT NOT NULL, source_lang VARCHAR(10) NULL,
    text_zh TEXT NULL, text_en TEXT NULL, text_ja TEXT NULL,
    audio_chunk_id VARCHAR(64) NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_room_time(room_id, created_at), INDEX idx_call(call_session_id), INDEX idx_user(user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
  console.log('✓ live_translations')

  console.log('\n✅ All tables created!')
  await conn.end()
}
if (require.main === module) {
  migrate().catch(e=>{console.error(e);process.exit(1)})
}
