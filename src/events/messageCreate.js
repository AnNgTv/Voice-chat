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

    try {
      await recordMessage(message.author.id, message.guild.id);
    } catch (error) {
      console.error('Lỗi khi ghi nhận tin nhắn:', error);
    }
  },
};
