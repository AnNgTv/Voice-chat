'use strict';

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        '❌ CHƯA CÓ DATABASE_URL! Hãy kiểm tra lại file .env hoặc thiết lập Variables trên Railway.'
      );
    }

    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function initDb() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id TEXT,
      guild_id TEXT,
      total_messages INT DEFAULT 0,
      total_voice_join INT DEFAULT 0,
      voice_joins INT DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, guild_id)
    );

    CREATE TABLE IF NOT EXISTS server_stats (
      guild_id TEXT PRIMARY KEY,
      total_messages INT DEFAULT 0,
      total_voice_sessions INT DEFAULT 0,
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function upsertServerStats(guildId) {
  const p = getPool();
  await p.query(
    `INSERT INTO server_stats (guild_id)
     VALUES ($1)
     ON CONFLICT (guild_id) DO NOTHING;`,
    [guildId]
  );
}

// Hàm ghi nhận tin nhắn (Cộng dồn +1 mỗi tin nhắn)
async function recordMessage(userId, guildId) {
  const p = getPool();
  await p.query(
    `INSERT INTO user_stats (user_id, guild_id, total_messages, last_updated)
     VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, guild_id)
     DO UPDATE SET 
       total_messages = user_stats.total_messages + 1,
       last_updated = CURRENT_TIMESTAMP;`,
    [userId, guildId]
  );
}

// Hàm ghi nhận lượt vào Voice (Cộng dồn +1 mỗi lần join)
async function recordVoiceJoin(userId, guildId) {
  const p = getPool();
  await p.query(
    `INSERT INTO user_stats (user_id, guild_id, voice_joins, last_updated)
     VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, guild_id)
     DO UPDATE SET 
       voice_joins = user_stats.voice_joins + 1,
       last_updated = CURRENT_TIMESTAMP;`,
    [userId, guildId]
  );
}

module.exports = { 
  getPool, 
  getDb: getPool, 
  initDb,
  upsertServerStats,
  recordMessage,
  recordVoiceJoin
};
