'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const logger = require('../utils/logger');

const DB_PATH = process.env.DATABASE_PATH || './data/stats.db';

let db = null;

/**
 * Ensures the directory that will hold the SQLite file exists.
 */
function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (dir && dir !== '.' && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created data directory: ${dir}`);
  }
}

/**
 * Opens a connection to the SQLite database, retrying a few times in case
 * the underlying disk/volume is not immediately available (e.g. on Railway
 * right after a deploy while a volume is being attached).
 */
function connectWithRetry(retries = 5, delayMs = 1500) {
  ensureDataDir();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const connection = new Database(DB_PATH);
      connection.pragma('journal_mode = WAL'); // better concurrent read/write behavior
      connection.pragma('foreign_keys = ON');
      logger.info(`Connected to SQLite database at ${DB_PATH} (attempt ${attempt})`);
      return connection;
    } catch (err) {
      logger.error(`Database connection attempt ${attempt}/${retries} failed:`, err.message);
      if (attempt === retries) {
        throw new Error(`Could not connect to database after ${retries} attempts: ${err.message}`);
      }
      // Synchronous sleep (better-sqlite3 is sync-only, so we busy-wait a short backoff)
      const wakeAt = Date.now() + delayMs;
      while (Date.now() < wakeAt) {
        /* intentional blocking backoff — startup only, not on hot path */
      }
    }
  }
  return null;
}

/**
 * Creates all required tables if they do not already exist.
 */
function initSchema(connection) {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id           TEXT NOT NULL,
      guild_id          TEXT NOT NULL,
      total_messages    INTEGER NOT NULL DEFAULT 0,
      total_voice_join  INTEGER NOT NULL DEFAULT 0,
      last_updated      TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, guild_id)
    );

    CREATE TABLE IF NOT EXISTS server_stats (
      guild_id           TEXT PRIMARY KEY,
      server_created_at  TEXT,
      total_members      INTEGER NOT NULL DEFAULT 0,
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_user_stats_guild ON user_stats (guild_id);
    CREATE INDEX IF NOT EXISTS idx_user_stats_messages ON user_stats (guild_id, total_messages DESC);
    CREATE INDEX IF NOT EXISTS idx_user_stats_voice ON user_stats (guild_id, total_voice_join DESC);
  `);
  logger.info('Database schema verified/initialized.');
}

/**
 * Returns the singleton database connection, creating it (and the schema)
 * on first call.
 */
function getDb() {
  if (!db) {
    db = connectWithRetry();
    initSchema(db);
  }
  return db;
}

module.exports = { getDb, DB_PATH };
