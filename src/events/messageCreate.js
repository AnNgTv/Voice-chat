'use strict';

const { Events, ChannelType } = require('discord.js');
const { incrementMessageCount } = require('../database/statsRepository');
const logger = require('../utils/logger');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    // Ignore bots (including this bot) to avoid inflating stats.
    if (message.author.bot) return;

    // Ignore DMs — we only track per-guild stats.
    if (!message.guild) return;

    // Ignore anything sent in a voice-channel text chat (voice channels can
    // have an attached text chat in Discord's UI); only count "real" text
    // channels such as GuildText, GuildAnnouncement, and thread channels.
    const VOICE_LIKE_TYPES = [ChannelType.GuildVoice, ChannelType.GuildStageVoice];
    if (message.channel && VOICE_LIKE_TYPES.includes(message.channel.type)) return;

    try {
      incrementMessageCount(message.author.id, message.guild.id);
      logger.debug(`+1 message for ${message.author.tag} in guild ${message.guild.id}`);
    } catch (err) {
      logger.error('Failed to record message stat:', err.message);
    }
  },
};
