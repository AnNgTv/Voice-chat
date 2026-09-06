'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getServerStats, upsertServerStats } = require('../database/statsRepository');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('Show an overview of this server'),

  async execute(interaction) {
    const guild = interaction.guild;

    if (!guild) {
      await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
      return;
    }

    try {
      // Refresh cached server_stats row with the latest live values before displaying.
      upsertServerStats(guild.id, guild.createdAt.toISOString(), guild.memberCount);
      const stored = getServerStats(guild.id);

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`📊 ${guild.name}`)
        .setThumbnail(guild.iconURL() || null)
        .addFields(
          { name: 'Total members', value: `${guild.memberCount}`, inline: true },
          { name: 'Created on', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
          {
            name: 'Stats last synced',
            value: stored ? `${stored.updated_at} UTC` : 'Never',
            inline: false,
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Error executing /serverinfo:', err);
      await interaction.reply({ content: 'Something went wrong while fetching server info.', ephemeral: true });
    }
  },
};
