'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const statsRepo = require('../database/statsRepository');
const { formatMinecraftTime } = require('../utils/formatTime');
const voiceEvent = require('../events/voiceStateUpdate');

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
      title = '⏱️ Bảng Xếp Hạng - Thời Gian Online Voice (Realtime)';
      color = 0x2ecc71;
    } else if (type === 'voice_joins') {
      title = '🎙️ Bảng Xếp Hạng - Số Lần Vào Voice';
      color = 0xe67e22;
    }

    const voiceSessions = voiceEvent.voiceSessions || new Map();

    const formattedList = leaderboardData.map((row) => {
      let totalVoiceTime = row.total_voice_join || 0;

      if (type === 'voice') {
        const sessionKey = `${row.user_id}-${guildId}`;
        if (voiceSessions.has(sessionKey)) {
          const joinTime = voiceSessions.get(sessionKey);
          const liveSeconds = Math.floor((Date.now() - joinTime) / 1000);
          totalVoiceTime += liveSeconds;
        }
      }

      return {
        userId: row.user_id,
        messages: row.total_messages,
        voiceJoins: row.voice_joins,
        voiceTime: totalVoiceTime,
      };
    });

    if (type === 'voice') {
      formattedList.sort((a, b) => b.voiceTime - a.voiceTime);
    }

    const outputString = formattedList
      .map((item, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `**#${index + 1}**`;
        let value = `${item.messages} tin nhắn`;

        if (type === 'voice') {
          value = formatMinecraftTime(item.voiceTime);
        } else if (type === 'voice_joins') {
          value = `${item.voiceJoins || 0} lần vào`;
        }

        return `${medal} <@${item.userId}> — **${value}**`;
      })
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setDescription(outputString)
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
