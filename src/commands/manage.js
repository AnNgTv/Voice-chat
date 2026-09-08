'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { decryptUserId, encryptUserId } = require('../utils/crypto');
const statsRepo = require('../database/statsRepository');
const logger = require('../utils/logger');

// ID Admin chính cố định
const BOT_OWNER_ID = process.env.ADMIN_USER_ID || '1397184940239749141';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage')
    .setDescription('Quản lý hệ thống (Chỉ Bot Owner)')
    // Ẩn lệnh khỏi danh sách gợi ý đối với tất cả thành viên thường
    .setDefaultMemberPermissions(0)
    // Cấu hình không cho phép dùng trong DM
    .setDMPermission(false),

  async execute(interaction) {
    // Chặn tuyệt đối: Bất kể là Server Owner, Admin hay Role cao nào khác ngoại trừ BOT_OWNER_ID
    if (interaction.user.id !== BOT_OWNER_ID) {
      return interaction.reply({
        content: '⛔ Bạn không có quyền sử dụng lệnh này! Lệnh chỉ dành riêng cho Bot Owner.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'encode-id') {
      const targetUser = interaction.options.getUser('target');
      const encrypted = encryptUserId(targetUser.id);
      return interaction.reply({
        content: `🔑 Mã hóa ID cho **${targetUser.tag}**:\n\`\`\`${encrypted}\`\`\`\n*Giữ kín mã này!*`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const encryptedId = interaction.options.getString('encrypted_id');
    const targetUserId = decryptUserId(encryptedId);

    if (!targetUserId) {
      return interaction.reply({
        content: '❌ Mã ID không hợp lệ hoặc đã bị can thiệp!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'add') {
      const type = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount');

      const msgAdd = type === 'messages' ? amount : 0;
      const voiceAdd = type === 'voice' ? amount : 0;

      statsRepo.updateStats(targetUserId, interaction.guildId, {
        messages: msgAdd,
        voiceTime: voiceAdd,
      });

      return interaction.reply({
        content: `✅ Đã cập nhật **${amount}** (${type === 'messages' ? 'tin nhắn' : 'phút voice'}) cho ID \`${targetUserId}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'reset') {
      statsRepo.resetStats(targetUserId, interaction.guildId);
      return interaction.reply({
        content: `✅ Đã reset toàn bộ thống kê của ID \`${targetUserId}\` về 0.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
