'use strict';

const statsRepo = require('../database/statsRepository');
const logger = require('../utils/logger');

// Lưu thời gian tham gia voice của user: Map<"userId-guildId", timestamp>
const voiceSessions = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild.id || oldState.guild.id;
    const sessionKey = `${userId}-${guildId}`;

    // 1. Người dùng tham gia kênh voice
    if (!oldState.channelId && newState.channelId) {
      voiceSessions.set(sessionKey, Date.now());
      return;
    }

    // 2. Người dùng rời kênh voice
    if (oldState.channelId && !newState.channelId) {
      const joinTime = voiceSessions.get(sessionKey);
      if (joinTime) {
        const durationMs = Date.now() - joinTime;
        const minutes = Math.floor(durationMs / (1000 * 60)); // Quy đổi ra phút

        if (minutes > 0) {
          try {
            statsRepo.updateStats(userId, guildId, { messages: 0, voiceTime: minutes });
          } catch (err) {
            logger.error(`Lỗi khi cập nhật thời gian voice cho ${userId}:`, err.message);
          }
        }
        voiceSessions.delete(sessionKey);
      }
    }
  },
};
