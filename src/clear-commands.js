'use strict';

require('dotenv').config();
const { REST, Routes } = require('discord.js');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

(async () => {
  try {
    if (guildId) {
      console.log(`🧹 Đang xóa toàn bộ Guild Commands tại Server: ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
      console.log('✅ Đã xóa sạch Guild Commands!');
    } else {
      console.log('⚠️ Không tìm thấy GUILD_ID trong .env, bỏ qua bước xóa Guild Commands.');
    }
  } catch (error) {
    console.error('❌ Lỗi khi xóa commands:', error);
  }
})();
