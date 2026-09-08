'use strict';

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { decryptUserId, encryptUserId } = require('../utils/crypto');
const statsRepo = require('../database/statsRepository');
const logger = require('../utils/logger');

const BOT_OWNER_ID = process.env.ADMIN_USER_ID || '1397184940239749141';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage')
    .setDescription('Quản lý hệ thống (Chỉ Bot Owner)')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('encode-id')
        .setDescription('Mã hóa User ID để quản lý')
        .addUserOption((opt) =>
          opt.setName('target').setDescription('Người dùng cần lấy mã ID').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Thêm/bớt điểm dữ liệu')
        .addStringOption((opt) =>
          opt.setName('type')
            .setDescription('Loại thống kê')
            .setRequired(true)
            .addChoices(
              { name: 'Tin nhắn (Messages)', value: 'messages' },
              { name: 'Voice (Phút)', value: 'voice' }
            )
        )
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Số lượng (nhập số âm để trừ)').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('encrypted_id').setDescription('Mã ID đã mã hóa').setRequired(false)
        )
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Chọn trực tiếp người dùng').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Cập nhật cho tất cả thành viên trong Role').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset điểm dữ liệu về 0')
        .addStringOption((opt) =>
          opt.setName('encrypted_id').setDescription('Mã ID đã mã hóa').setRequired(false)
        )
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Chọn trực tiếp người dùng').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Reset tất cả thành viên trong Role').setRequired(false)
        )
    ),

  async execute(interaction) {
    const user = interaction.user;
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    // 1. Kiểm tra quyền Bot Owner
    if (user.id !== BOT_OWNER_ID) {
      try {
        const owner = await interaction.client.users.fetch(BOT_OWNER_ID);
        if (owner) {
          await owner.send(
            `🚨 **CẢNH BÁO TRUY CẬP TRÁI PHÉP** 🚨\n` +
            `• **Người dùng:** ${user.tag} (\`${user.id}\`)\n` +
            `• **Server:** ${guild ? guild.name : 'Unknown Guild'} (\`${guild ? guild.id : 'N/A'}\`)\n` +
            `• **Lệnh cố tình dùng:** \`/manage ${subcommand}\`\n` +
            `• **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`
          );
        }
      } catch (err) {
        logger.error(`Không thể gửi DM thông báo: ${err.message}`);
      }

      return interaction.reply({
        content: '⛔ Bạn không có quyền sử dụng lệnh này!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // 2. Xử lý subcommand: encode-id
    if (subcommand === 'encode-id') {
      const targetUser = interaction.options.getUser('target');
      const encrypted = encryptUserId(targetUser.id);
      return interaction.reply({
        content: `🔑 Mã hóa ID cho **${targetUser.tag}**:\n\`\`\`${encrypted}\`\`\`\n*Giữ kín mã này!*`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Helper: Xác định danh sách Target User ID từ các lựa chọn
    const getTargetUserIds = async () => {
      const encryptedId = interaction.options.getString('encrypted_id');
      const targetUser = interaction.options.getUser('user');
      const targetRole = interaction.options.getRole('role');

      if (targetUser) {
        return [targetUser.id];
      }

      if (encryptedId) {
        const decrypted = decryptUserId(encryptedId);
        return decrypted ? [decrypted] : null;
      }

      if (targetRole && guild) {
        await guild.members.fetch();
        return guild.members.cache
          .filter((m) => m.roles.cache.has(targetRole.id) && !m.user.bot)
          .map((m) => m.id);
      }

      return [];
    };

    const targetUserIds = await getTargetUserIds();

    if (targetUserIds === null) {
      return interaction.reply({
        content: '❌ Mã ID không hợp lệ hoặc đã bị can thiệp!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (targetUserIds.length === 0) {
      return interaction.reply({
        content: '❌ Bạn phải cung cấp ít nhất một tham số: `encrypted_id`, `user` hoặc `role`!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // 3. Xử lý subcommand: add
    if (subcommand === 'add') {
      const type = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount');
      const msgAdd = type === 'messages' ? amount : 0;
      const voiceAdd = type === 'voice' ? amount : 0;

      for (const id of targetUserIds) {
        statsRepo.updateStats(id, interaction.guildId, {
          messages: msgAdd,
          voiceTime: voiceAdd,
        });
      }

      return interaction.reply({
        content: `✅ Đã cập nhật **${amount}** (${type === 'messages' ? 'tin nhắn' : 'phút voice'}) cho **${targetUserIds.length}** người dùng.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // 4. Xử lý subcommand: reset
    if (subcommand === 'reset') {
      for (const id of targetUserIds) {
        statsRepo.resetStats(id, interaction.guildId);
      }

      return interaction.reply({
        content: `✅ Đã reset toàn bộ thống kê của **${targetUserIds.length}** người dùng về 0.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
