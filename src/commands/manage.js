'use strict';

const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { decryptUserId, encryptUserId } = require('../utils/crypto');
const statsRepo = require('../database/statsRepository');
const logger = require('../utils/logger');

const BOT_OWNER_ID = process.env.ADMIN_USER_ID || '1397184940239749141';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('manage')
    .setDescription('Quản lý hệ thống (Chỉ Bot Owner)')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
          opt
            .setName('type')
            .setDescription('Loại thống kê')
            .setRequired(true)
            .addChoices(
              { name: 'Tin nhắn (Messages)', value: 'messages' },
              { name: 'Thời gian Voice (Giây)', value: 'voice' },
              { name: 'Số lần vào Voice (Joins)', value: 'voice_joins' }
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
        .setDescription('Reset điểm dữ liệu của cá nhân/role về 0')
        .addStringOption((opt) =>
          opt.setName('encrypted_id').setDescription('Mã ID đã mã hóa').setRequired(false)
        )
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Chọn trực tiếp người dùng').setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('role').setDescription('Reset tất cả thành viên trong Role').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('reset-all')
        .setDescription('Reset TOÀN BỘ thống kê của tất cả mọi người trong server về 0')
    ),

  async execute(interaction) {
    const user = interaction.user;
    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    // 1. KIỂM TRA QUYỀN VÀ BÁO ĐỘNG
    if (user.id !== BOT_OWNER_ID) {
      try {
        const owner = await interaction.client.users.fetch(BOT_OWNER_ID);
        if (owner) {
          await owner.send(
            `🚨 **CẢNH BÁO TRUY CẬP TRÁI PHÉP** 🚨\n` +
            `• **Người thực hiện:** ${user.tag} (\`${user.id}\`)\n` +
            `• **Tại Server:** ${guild ? guild.name : 'Chát riêng'} (\`${guild ? guild.id : 'N/A'}\`)\n` +
            `• **Lệnh cố tình bấm:** \`/manage ${subcommand}\`\n` +
            `• **Thời gian:** <t:${Math.floor(Date.now() / 1000)}:F>`
          );
        }
      } catch (err) {
        logger.error(`Không thể gửi DM cảnh báo đến Owner (${BOT_OWNER_ID}):`, err.message);
      }

      return interaction.reply({
        content: '⛔ Bạn không có quyền sử dụng lệnh này!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // 2. XỬ LÝ SUBCOMMANDS
    if (subcommand === 'encode-id') {
      const targetUser = interaction.options.getUser('target');
      const encrypted = encryptUserId(targetUser.id);
      return interaction.reply({
        content: `🔑 Mã hóa ID cho **${targetUser.tag}**:\n\`\`\`${encrypted}\`\`\`\n*Giữ kín mã này!*`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (subcommand === 'reset-all') {
      const result = statsRepo.resetAllStats(interaction.guildId);
      return interaction.reply({
        content: `⚠️ **Đã reset toàn bộ dữ liệu thống kê** (Tin nhắn & Voice) của **${result.changes}** người dùng trong server này về 0.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const getTargetUserIds = async () => {
      const encryptedId = interaction.options.getString('encrypted_id');
      const targetUser = interaction.options.getUser('user');
      const targetRole = interaction.options.getRole('role');

      if (targetUser) return [targetUser.id];
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
        content: '❌ Bạn phải cung cấp ít nhất 1 trong các tùy chọn: `encrypted_id`, `user` hoặc `role`!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Subcommand: add
    if (subcommand === 'add') {
      const type = interaction.options.getString('type');
      const amount = interaction.options.getInteger('amount');

      for (const id of targetUserIds) {
        if (type === 'messages') {
          statsRepo.updateStats(id, interaction.guildId, { messages: amount, voiceTime: 0 });
        } else if (type === 'voice') {
          statsRepo.updateStats(id, interaction.guildId, { messages: 0, voiceTime: amount });
        } else if (type === 'voice_joins') {
          // Thêm/bớt số lần vào voice
          const db = require('../database').getDb();
          db.prepare(`
            INSERT INTO user_stats (user_id, guild_id, voice_joins, last_updated)
            VALUES (?, ?, MAX(0, ?), datetime('now'))
            ON CONFLICT(user_id, guild_id) DO UPDATE SET
              voice_joins = MAX(0, COALESCE(voice_joins, 0) + excluded.voice_joins),
              last_updated = datetime('now')
          `).run(id, interaction.guildId, amount);
        }
      }

      let typeLabel = 'tin nhắn';
      if (type === 'voice') typeLabel = 'giây voice';
      if (type === 'voice_joins') typeLabel = 'lần vào voice';

      return interaction.reply({
        content: `✅ Đã cập nhật **${amount > 0 ? '+' : ''}${amount}** (${typeLabel}) cho **${targetUserIds.length}** người dùng.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Subcommand: reset
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
          
