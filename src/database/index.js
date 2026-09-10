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

module.exports = { 
  getPool, 
  getDb: getPool, 
  initDb 
};
