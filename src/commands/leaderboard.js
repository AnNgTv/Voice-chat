const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPool } = require('../database/index');
const { formatDuration } = require('../utils/formatTime');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Xem bảng xếp hạng tương tác của server')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Loại bảng xếp hạng')
        .setRequired(false)
        .addChoices(
          { name: 'Tin nhắn', value: 'messages' },
          { name: 'Lượt join voice', value: 'voice_joins' },
          { name: 'Thời gian voice (phút)', value: 'voice_time' }
        )
    )
    .addIntegerOption((opt) =>
      opt
        .setName('limit')
        .setDescription('Số lượng top (mặc định 10)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(50)
    ),

  async execute(interaction) {
    try {
      const pool = getPool();
      const type = interaction.options.getString('type') || 'messages';
      const limit = interaction.options.getInteger('limit') || 10;

      let orderBy = 'total_messages';
      let displayType = 'Tin nhắn';
      let queryColumns = 'user_id, total_messages, COALESCE(voice_joins, 0) AS voice_joins, COALESCE(total_voice_join, 0) AS total_voice_join';

      if (type === 'voice_joins') {
        orderBy = 'voice_joins';
        displayType = 'Lượt join voice';
      } else if (type === 'voice_time') {
        orderBy = 'total_voice_join';
        displayType = 'Thời gian voice (phút)';
      }

      const result = await pool.query(
        `SELECT ${queryColumns}
         FROM user_stats
         WHERE guild_id = $1
         ORDER BY ${orderBy} DESC
         LIMIT $2`,
        [interaction.guildId, limit]
      );

      const leaderboardData = result.rows || [];

      if (leaderboardData.length === 0) {
        return interaction.reply({
          content: '📊 Chưa có dữ liệu thống kê cho server này!',
          ephemeral: true,
        });
      }

      const leaderboardList = leaderboardData
        .map((user, index) => {
          let stat = '';
          if (type === 'messages') {
            stat = `**${user.total_messages || 0}** tin nhắn`;
          } else if (type === 'voice_joins') {
            stat = `**${user.voice_joins || 0}** lượt join`;
          } else if (type === 'voice_time') {
            stat = `**${user.total_voice_join || 0}** phút`;
          }
          return `**#${index + 1}** <@${user.user_id}> - ${stat}`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle(`🏆 BẢNG XẾP HẠNG - ${displayType.toUpperCase()}`)
        .setColor('#0099ff')
        .setDescription(leaderboardList)
        .setFooter({ text: `Top ${limit} thành viên` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Lỗi khi thực thi lệnh /leaderboard:', error);
      await interaction.reply({
        content: '❌ Đã xảy ra lỗi khi lấy dữ liệu bảng xếp hạng!',
        ephemeral: true,
      });
    }
  },
};
