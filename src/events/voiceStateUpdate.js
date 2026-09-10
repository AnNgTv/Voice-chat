'use strict';

const statsRepo = require('../database/statsRepository');
const logger = require('../utils/logger');

const voiceSessions = new Map();

// Tự động lưu tất cả phiên voice đang treo vào Database khi Bot bị restart/redeploy
function flushAllVoiceSessions() {
  const now = Date.now();
  for (const [sessionKey, joinTime] of voiceSessions.entries()) {
    const [userId, guildId] = sessionKey.split('-');
    const durationSeconds = Math.floor((now - joinTime) / 1000);
    if (durationSeconds > 0 && userId && guildId) {
      try {
        statsRepo.updateStats(userId, guildId, { messages: 0, voiceTime: durationSeconds });
      } catch (err) {
        logger.error(`Lỗi lưu khẩn cấp voice session cho ${userId}:`, err.message);
      }
    }
  }
  voiceSessions.clear();
}

// Bắt sự kiện ngắt kết nối hệ thống trên Railway để ghi nhận dữ liệu
process.on('SIGTERM', flushAllVoiceSessions);
process.on('SIGINT', flushAllVoiceSessions);

module.exports = {
  name: 'voiceStateUpdate',
  voiceSessions,
  async execute(oldState, newState) {
    try {
      const userId = newState.id || oldState.id;
      const guildId = newState.guild?.id || oldState.guild?.id;
      if (!guildId || !userId) return;

      const sessionKey = `${userId}-${guildId}`;

      // 1. Vào Voice
      if (!oldState.channelId && newState.channelId) {
        voiceSessions.set(sessionKey, Date.now());
        statsRepo.incrementVoiceJoinCount(userId, guildId);
        return;
      }

      // 2. Thoát Voice
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
      logger.error('Lỗi voiceStateUpdate:', err.message);
    }
  },
};
