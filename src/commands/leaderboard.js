const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPool } = require('../database/index');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Xem bảng xếp hạng tương tác của server'),

  async execute(interaction) {
    try {
      const pool = getPool();
      
      // Lấy danh sách tách biệt từng user_id trong server
      const result = await pool.query(
        `SELECT user_id, total_messages, voice_joins 
         FROM user_stats 
         WHERE guild_id = $1 
         ORDER BY total_messages DESC, voice_joins DESC 
         LIMIT 10`,
        [interaction.guildId]
      );

      const leaderboardData = result.rows || [];

      if (leaderboardData.length === 0) {
        return interaction.reply({
          content: '📊 Chưa có dữ liệu thống kê cho server này!',
          ephemeral: true
        });
      }

      const leaderboardList = leaderboardData
        .map((user, index) => {
          return `**#${index + 1}** <@${user.user_id}> - **${user.total_messages || 0}** tin nhắn | **${user.voice_joins || 0}** lượt voice`;
        })
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🏆 BẢNG XẾP HẠNG TƯƠNG TÁC')
        .setColor('#0099ff')
        .setDescription(leaderboardList)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Lỗi khi thực thi lệnh /leaderboard:', error);
      await interaction.reply({
        content: '❌ Đã xảy ra lỗi khi lấy dữ liệu bảng xếp hạng!',
        ephemeral: true
      });
    }
  },
};
