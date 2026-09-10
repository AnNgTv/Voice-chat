'use strict';

const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'Thieu biến môi trường DATABASE_URL! Hãy thêm biến DATABASE_URL vào Railway hoặc file .env.'
      );
    }

    pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
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

module.exports = { getPool, initDb };
