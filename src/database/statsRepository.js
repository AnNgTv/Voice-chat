'use strict';

const { getPool } = require('./index');

async function incrementMessageCount(userId, guildId) {
  const pool = getPool();
  const query = `
    INSERT INTO user_stats (user_id, guild_id, total_messages, last_updated)
    VALUES ($1, $2, 1, NOW())
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      total_messages = user_stats.total_messages + 1,
      last_updated = NOW();
  `;
  return pool.query(query, [userId, guildId]);
}

async function incrementVoiceJoinCount(userId, guildId) {
  const pool = getPool();
  const query = `
    INSERT INTO user_stats (user_id, guild_id, voice_joins, last_updated)
    VALUES ($1, $2, 1, NOW())
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      voice_joins = COALESCE(user_stats.voice_joins, 0) + 1,
      last_updated = NOW();
  `;
  return pool.query(query, [userId, guildId]);
}

async function getLeaderboard(guildId, type = 'messages', limit = 10) {
  const pool = getPool();
  let orderBy = 'total_messages';

  if (type === 'voice') {
    orderBy = 'total_voice_join';
  } else if (type === 'voice_joins') {
    orderBy = 'voice_joins';
  }

  const query = `
    SELECT user_id, total_messages, total_voice_join, COALESCE(voice_joins, 0) AS voice_joins
    FROM user_stats
    WHERE guild_id = $1
    ORDER BY ${orderBy} DESC
    LIMIT $2;
  `;
  const res = await pool.query(query, [guildId, limit]);
  return res.rows;
}

async function updateStats(userId, guildId, { messages = 0, voiceTime = 0 }) {
  const pool = getPool();
  const query = `
    INSERT INTO user_stats (user_id, guild_id, total_messages, total_voice_join, last_updated)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT(user_id, guild_id) DO UPDATE SET
      total_messages = GREATEST(0, user_stats.total_messages + EXCLUDED.total_messages),
      total_voice_join = GREATEST(0, user_stats.total_voice_join + EXCLUDED.total_voice_join),
      last_updated = NOW();
  `;
  return pool.query(query, [userId, guildId, messages, voiceTime]);
}

async function resetStats(userId, guildId) {
  const pool = getPool();
  const query = `
    UPDATE user_stats
    SET total_messages = 0, total_voice_join = 0, voice_joins = 0, last_updated = NOW()
    WHERE user_id = $1 AND guild_id = $2;
  `;
  return pool.query(query, [userId, guildId]);
}

async function resetAllStats(guildId) {
  const pool = getPool();
  const query = `
    UPDATE user_stats
    SET total_messages = 0, total_voice_join = 0, voice_joins = 0, last_updated = NOW()
    WHERE guild_id = $1;
  `;
  const res = await pool.query(query, [guildId]);
  return { changes: res.rowCount };
}

module.exports = {
  incrementMessageCount,
  incrementVoiceJoinCount,
  getLeaderboard,
  updateStats,
  resetStats,
  resetAllStats,
};
