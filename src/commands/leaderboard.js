'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const statsRepo = require('../database/statsRepository');
const { formatMinecraftTime } = require('../utils/formatTime');

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
          { name: 'Thời gian treo Voice (Playtime)', value: 'voice' },
          { name: 'Số lần vào Voice (Joins)', value: 'voice_joins' }
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

    let title = '🏆 Bảng Xếp Hạng - Tin Nhắn';
    let color = 0x3498db;

    if (type === 'voice') {
      title = '⏱️ Bảng Xếp Hạng - Thời Gian Online Voice';
      color = 0x2ecc71;
    } else if (type === 'voice_joins') {
      title = '🎙️ Bảng Xếp Hạng - Số Lần Vào Voice';
      color = 0xe67e22;
    }

    const formattedList = leaderboardData
      .map((row, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
        
        let value = `${row.total_messages} tin nhắn`;
        if (type === 'voice') {
          value = formatMinecraftTime(row.total_voice_join);
        } else if (type === 'voice_joins') {
          value = `${row.voice_joins} lần vào`;
        }

        return `${medal} <@${row.user_id}> — **${value}**`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription(formattedList)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
