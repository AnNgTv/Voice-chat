'use strict';

const { Events } = require('discord.js');
const { getDb } = require('../database/index');
const { upsertServerStats } = require('../database/statsRepository');
const logger = require('../utils/logger');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    // Touching getDb() here guarantees the schema is created before any
    // event handler tries to write to the database.
    getDb();

    logger.info(`Bot ready — logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s).`);

    // Seed/refresh server_stats for every guild the bot is currently in.
    for (const guild of client.guilds.cache.values()) {
      try {
        upsertServerStats(guild.id, guild.createdAt.toISOString(), guild.memberCount);
      } catch (err) {
        logger.error(`Failed to seed server_stats for guild ${guild.id}:`, err.message);
      }
    }
  },
};
