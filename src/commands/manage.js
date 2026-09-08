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
        .setDescription('Thêm hoặc bớt điểm dữ liệu của người dùng')
        .addStringOption((opt) =>
          opt.setName('encrypted_id').setDescription('Mã ID đã mã hóa').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('Loại thống kê')
            .setRequired(true)
            .addChoices(
              { name: 'Tin nhắn (Messages)', value: 'messages' },
              { name: 'Voice (Phút)', value: 'voice' }
            )
        )
        .addIntegerOption((opt) =>
          opt.setName('amount').setDescription('Số lượng (có thể nhập số âm)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset')
        .setDescription('Reset điểm dữ liệu của người dùng về 0')
        .addStringOption((opt) =>
          opt.setName('encrypted_id').setDescription('Mã ID đã mã hóa').setRequired(true)
        )
    ),

  async execute(interaction) {
    const user = interaction.user;
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    // BƯỚC 1: CHẶN TUYỆT ĐỐI NGAY TỪ ĐẦU (Trước khi đọc/xử lý bất kỳ option nào)
    if (user.id !== BOT_OWNER_ID) {
      // Gửi DM cảnh báo cho bạn
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

      // Ngắt hoàn toàn luồng xử lý
      return interaction.reply({
        content: '⛔ Bạn không có quyền sử dụng lệnh này!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // BƯỚC 2: CHỈ XỬ LÝ KHI DỮ LIỆU ĐẾN TỪ BOT OWNER

    if (subcommand === 'encode-id') {
      const targetUser = interaction.options.getUser('target');
      const encrypted = encryptUserId(targetUser.id);
      return interaction.reply({
        content: `🔑 Mã hóa ID cho **${targetUser.tag}**:\n\`\`\`${encrypted}\`\`\`\n*Giữ kín mã này!*`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Chỉ lấy và giải mã encrypted_id đối với lệnh 'add' và 'reset' sau khi đã xác minh ID
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
