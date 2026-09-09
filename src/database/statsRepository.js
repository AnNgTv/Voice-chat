'use strict';

const { getDb } = require('./index');

function incrementMessageCount(userId, guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, guild_id, total_messages, last_updated)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      total_messages = total_messages + 1,
      last_updated = datetime('now')
  `);
  return stmt.run(userId, guildId);
}

function incrementVoiceJoinCount(userId, guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, guild_id, voice_joins, last_updated)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      voice_joins = COALESCE(voice_joins, 0) + 1,
      last_updated = datetime('now')
  `);
  return stmt.run(userId, guildId);
}

function getUserStats(userId, guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM user_stats WHERE user_id = ? AND guild_id = ?
  `);
  return stmt.get(userId, guildId);
}

function getLeaderboard(guildId, type = 'messages', limit = 10) {
  const db = getDb();
  let orderBy = 'total_messages';
  
  if (type === 'voice') {
    orderBy = 'total_voice_join';
  } else if (type === 'voice_joins') {
    orderBy = 'voice_joins';
  }

  const stmt = db.prepare(`
    SELECT user_id, total_messages, total_voice_join, COALESCE(voice_joins, 0) AS voice_joins
    FROM user_stats
    WHERE guild_id = ?
    ORDER BY ${orderBy} DESC
    LIMIT ?
  `);
  return stmt.all(guildId, limit);
}

function upsertServerStats(guildId, data) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO server_stats (guild_id, total_messages, total_voice_sessions, last_updated)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(guild_id) DO UPDATE SET
      total_messages = total_messages + excluded.total_messages,
      total_voice_sessions = total_voice_sessions + excluded.total_voice_sessions,
      last_updated = datetime('now')
  `);
  return stmt.run(guildId, data.messages || 0, data.voiceSessions || 0);
}

function getServerStats(guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM server_stats WHERE guild_id = ?
  `);
  return stmt.get(guildId);
}

function updateStats(userId, guildId, { messages = 0, voiceTime = 0 }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO user_stats (user_id, guild_id, total_messages, total_voice_join, last_updated)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
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
    SET total_messages = 0, total_voice_join = 0, voice_joins = 0, last_updated = datetime('now')
    WHERE user_id = ? AND guild_id = ?
  `);
  return stmt.run(userId, guildId);
}

function resetAllStats(guildId) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE user_stats
    SET total_messages = 0, total_voice_join = 0, voice_joins = 0, last_updated = datetime('now')
    WHERE guild_id = ?
  `);
  return stmt.run(guildId);
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
  resetAllStats,
};
