'use strict';

const { Events } = require('discord.js');
const { incrementVoiceJoinCount } = require('../database/statsRepository');
const logger = require('../utils/logger');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const member = newState.member || oldState.member;
    if (!member || member.user.bot) return;

    // A "connection" is counted when the user goes from NOT being in any
    // voice channel to being in one (i.e. oldState.channelId is null and
    // newState.channelId is set). Switching between channels while already
    // connected, muting, deafening, etc. do NOT count as a new join.
    const wasDisconnected = oldState.channelId === null;
    const isNowConnected = newState.channelId !== null;

    if (wasDisconnected && isNowConnected) {
      try {
        incrementVoiceJoinCount(member.id, newState.guild.id);
        logger.debug(`+1 voice join for ${member.user.tag} in guild ${newState.guild.id}`);
      } catch (err) {
        logger.error('Failed to record voice join stat:', err.message);
      }
    }
  },
};
