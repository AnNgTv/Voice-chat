'use strict';

const statsRepo = require('../database/statsRepository');
const logger = require('../utils/logger');

// Lưu mốc thời gian bắt đầu vào voice của từng user
const voiceSessions = new Map();

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState) {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild.id || oldState.guild.id;
    const sessionKey = `${userId}-${guildId}`;

    // 1. Tham gia kênh voice mới (Tăng số lần vào + Lưu mốc thời gian)
    if (!oldState.channelId && newState.channelId) {
      voiceSessions.set(sessionKey, Date.now());
      try {
        statsRepo.incrementVoiceJoinCount(userId, guildId);
      } catch (err) {
        logger.error(`Lỗi tăng số lần vào voice cho ${userId}:`, err.message);
      }
      return;
    }

    // 2. Rời kênh voice (Tính thời gian trôi qua theo giây và cộng dồn)
    if (oldState.channelId && !newState.channelId) {
      const joinTime = voiceSessions.get(sessionKey);
      if (joinTime) {
        const durationSeconds = Math.floor((Date.now() - joinTime) / 1000);

        if (durationSeconds > 0) {
          try {
            statsRepo.updateStats(userId, guildId, { messages: 0, voiceTime: durationSeconds });
          } catch (err) {
            logger.error(`Lỗi cập nhật thời gian voice cho ${userId}:`, err.message);
          }
        }
        voiceSessions.delete(sessionKey);
      }
    }
  },
};
