'use strict';

const { Events, ChannelType } = require('discord.js');
const { incrementMessageCount } = require('../database/statsRepository');
const logger = require('../utils/logger');
const { recordMessage } = require('../database/index');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    // Bỏ qua tin nhắn từ bot hoặc ngoài server
    if (message.author.bot || !message.guild) return;

    logger.info(`[MESSAGE] User ${message.author.id} (${message.author.username}) sent message in guild ${message.guild.id}`);

    try {
      await recordMessage(message.author.id, message.guild.id);
      logger.debug(`[MESSAGE] Successfully recorded message for user ${message.author.id}`);
    } catch (error) {
      logger.error(`[MESSAGE ERROR] Lỗi khi ghi nhận tin nhắn cho user ${message.author.id}:`, error);
    }
  },
};
