'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../database/statsRepository');
const logger = require('../utils/logger');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the server leaderboard')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Which stat to rank by')
        .setRequired(false)
        .addChoices({ name: 'Messages', value: 'messages' }, { name: 'Voice', value: 'voice' })
    )
    .addIntegerOption((option) =>
      option
        .setName('limit')
        .setDescription('How many entries to show (default 10, max 25)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type') || 'messages';
    const limit = interaction.options.getInteger('limit') || 10;
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({ content: 'This command can only be used inside a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    try {
      const rows = getLeaderboard(guildId, type, limit);

      if (rows.length === 0) {
        await interaction.editReply('No activity has been recorded for this server yet.');
        return;
      }

      const lines = rows.map((row, index) => {
        const rank = MEDALS[index] || `#${index + 1}`;
        const value = type === 'voice' ? row.total_voice_join : row.total_messages;
        const unit = type === 'voice' ? 'voice joins' : 'messages';
        return `${rank} <@${row.user_id}> — **${value}** ${unit}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`🏆 Leaderboard — ${type === 'voice' ? 'Voice Joins' : 'Messages'}`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${interaction.guild.name} • Top ${rows.length}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Error executing /leaderboard:', err);
      await interaction.editReply('Something went wrong while building the leaderboard.');
    }
  },
};
