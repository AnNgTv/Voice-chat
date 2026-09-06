'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserStats } = require('../database/statsRepository');
const logger = require('../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show activity stats for yourself or another member')
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to look up (defaults to you)').setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
      return;
    }

    try {
      const stats = getUserStats(targetUser.id, guildId);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
        .setTitle('Activity Stats')
        .addFields(
          { name: '💬 Messages sent', value: `${stats.total_messages}`, inline: true },
          { name: '🔊 Voice joins', value: `${stats.total_voice_join}`, inline: true }
        )
        .setFooter({
          text: stats.last_updated ? `Last updated: ${stats.last_updated} UTC` : 'No activity recorded yet',
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Error executing /stats:', err);
      await interaction.reply({ content: 'Something went wrong while fetching stats.', ephemeral: true });
    }
  },
};
