'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'stats.db');
let db = null;

function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    
    // Khởi tạo bảng nếu chưa có
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id TEXT,
        guild_id TEXT,
        total_messages INTEGER DEFAULT 0,
        total_voice_join INTEGER DEFAULT 0,
        last_updated TEXT,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS server_stats (
        guild_id TEXT PRIMARY KEY,
        total_messages INTEGER DEFAULT 0,
        total_voice_sessions INTEGER DEFAULT 0,
        last_updated TEXT
      );
    `);
  }
  return db;
}

module.exports = { getDb };
