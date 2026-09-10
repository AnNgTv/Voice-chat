'use strict';

const statsRepo = require('../database/statsRepository');
const logger = require('../utils/logger');

// Map dùng chung lưu mốc thời gian (userId-guildId -> timestamp)
const voiceSessions = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  voiceSessions,
  async execute(oldState, newState) {
    try {
      const userId = newState.id || oldState.id;
      const guildId = newState.guild?.id || oldState.guild?.id;
      if (!guildId || !userId) return;

      const sessionKey = `${userId}-${guildId}`;

      // 1. Tham gia kênh voice mới
      if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(sessionKey, Date.now());
        statsRepo.incrementVoiceJoinCount(userId, guildId);
        return;
      }

      // 2. Rời khỏi voice
      if (oldState.channelId && !newState.channelId) {
        const joinTime = voiceSessions.get(sessionKey);
        if (joinTime) {
          const durationSeconds = Math.floor((Date.now() - joinTime) / 1000);
          if (durationSeconds > 0) {
            statsRepo.updateStats(userId, guildId, { messages: 0, voiceTime: durationSeconds });
          }
          voiceSessions.delete(sessionKey);
        }
      }
    } catch (err) {
      logger.error('Lỗi sự kiện voiceStateUpdate:', err.message);
    }
  },
};
