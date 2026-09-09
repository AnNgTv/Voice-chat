'use strict';

require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    const clientId = process.env.CLIENT_ID;

    // 1. Lấy danh sách tất cả các Guild mà Bot đang tham gia
    console.log('🔍 Đang kiểm tra các máy chủ bot đang tham gia...');
    const guilds = await rest.get(Routes.userGuilds());

    // 2. Xóa sạch Guild Commands trên từng máy chủ để loại bỏ lệnh trùng
    for (const guild of guilds) {
      console.log(`🧹 Đang dọn dẹp lệnh cũ tại server: ${guild.name} (${guild.id})...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guild.id), { body: [] });
    }
    console.log('✅ Đã xóa sạch Guild Commands trên tất cả máy chủ!');

    // 3. Đăng ký duy nhất Global Commands cho tất cả các nơi
    console.log(`🚀 Đang đăng ký ${commands.length} Global Slash Commands...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('✅ Đã cập nhật Global Commands thành công!');
  } catch (error) {
    console.error('❌ Lỗi khi dọn dẹp và cập nhật commands:', error);
  }
})();
    
