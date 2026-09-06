'use strict';

const { getDb } = require('./db');
const logger = require('../utils/logger');

function incrementMessageCount(userId, guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, guild_id, total_messages, total_voice_join, last_updated)
    VALUES (?, ?, 1, 0, datetime('now'))
    ON CONFLICT (user_id, guild_id)
    DO UPDATE SET
      total_messages = total_messages + 1,
      last_updated = datetime('now')
  `);
  try {
    stmt.run(userId, guildId);
  } catch (err) {
    logger.error('Failed to increment message count:', err.message);
  }
}

function incrementVoiceJoinCount(userId, guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, guild_id, total_messages, total_voice_join, last_updated)
    VALUES (?, ?, 0, 1, datetime('now'))
    ON CONFLICT (user_id, guild_id)
    DO UPDATE SET
      total_voice_join = total_voice_join + 1,
      last_updated = datetime('now')
  `);
  try {
    stmt.run(userId, guildId);
  } catch (err) {
    logger.error('Failed to increment voice join count:', err.message);
  }
}

function getUserStats(userId, guildId) {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM user_stats WHERE user_id = ? AND guild_id = ?`)
    .get(userId, guildId);

  return (
    row || {
      user_id: userId,
      guild_id: guildId,
      total_messages: 0,
      total_voice_join: 0,
      last_updated: null,
    }
  );
}

function getLeaderboard(guildId, type, limit = 10) {
  const db = getDb();
  const column = type === 'voice' ? 'total_voice_join' : 'total_messages';
  const stmt = db.prepare(`
    SELECT user_id, total_messages, total_voice_join
    FROM user_stats
    WHERE guild_id = ? AND ${column} > 0
    ORDER BY ${column} DESC
    LIMIT ?
  `);
  return stmt.all(guildId, limit);
}

function upsertServerStats(guildId, serverCreatedAt, totalMembers) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO server_stats (guild_id, server_created_at, total_members, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT (guild_id)
    DO UPDATE SET
      server_created_at = excluded.server_created_at,
      total_members = excluded.total_members,
      updated_at = datetime('now')
  `);
  try {
    stmt.run(guildId, serverCreatedAt, totalMembers);
  } catch (err) {
    logger.error('Failed to upsert server stats:', err.message);
  }
}

function getServerStats(guildId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM server_stats WHERE guild_id = ?`).get(guildId) || null;
}

function updateStats(userId, guildId, { messages = 0, voiceTime = 0 }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, guild_id, total_messages, total_voice_join, last_updated)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT (user_id, guild_id)
    DO UPDATE SET
      total_messages = MAX(0, total_messages + excluded.total_messages),
      total_voice_join = MAX(0, total_voice_join + excluded.total_voice_join),
      last_updated = datetime('now')
  `);
  return stmt.run(userId, guildId, messages, voiceTime);
}

function resetStats(userId, guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE user_stats
    SET total_messages = 0, total_voice_join = 0, last_updated = datetime('now')
    WHERE user_id = ? AND guild_id = ?
  `);
  return stmt.run(userId, guildId);
}

module.exports = {
  incrementMessageCount,
  incrementVoiceJoinCount,
  getUserStats,
  getLeaderboard,
  upsertServerStats,
  getServerStats,
  updateStats,
  resetStats,
};
