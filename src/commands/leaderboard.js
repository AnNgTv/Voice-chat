'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const statsRepo = require('../database/statsRepository');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Xem bảng xếp hạng hoạt động')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Loại bảng xếp hạng')
        .setRequired(true)
        .addChoices(
          { name: 'Tin nhắn (Messages)', value: 'messages' },
          { name: 'Thời gian Voice (Phút)', value: 'voice' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');
    const guildId = interaction.guildId;
    const leaderboardData = statsRepo.getLeaderboard(guildId, type, 10);

    if (!leaderboardData || leaderboardData.length === 0) {
      return interaction.reply({
        content: '📊 Chưa có dữ liệu thống kê cho máy chủ này.',
        ephemeral: true,
      });
    }

    const isVoice = type === 'voice';
    const title = isVoice ? '🏆 Bảng Xếp Hạng - Thời Gian Voice' : '🏆 Bảng Xếp Hạng - Tin Nhắn';

    const formattedList = leaderboardData
      .map((row, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
        const value = isVoice ? `${row.total_voice_join} phút` : `${row.total_messages} tin nhắn`;
        return `${medal} <@${row.user_id}> — **${value}**`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(isVoice ? 0x2ecc71 : 0x3498db)
      .setDescription(formattedList)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
