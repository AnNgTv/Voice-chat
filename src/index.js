'use strict';

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  Collection,
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const { initDb } = require('./database');
const statsRepo = require('./database/statsRepository');
const logger = require('./utils/logger');
const { voiceSessions } = require('./events/voiceStateUpdate');

// 1. Khởi tạo Discord Client với đầy đủ Intents cần thiết
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// 2. Hàm lưu khẩn cấp toàn bộ voice đang treo vào DB khi Bot tắt/Restart (Tránh mất điểm)
async function flushVoiceSessions() {
  if (!voiceSessions || voiceSessions.size === 0) return;
  logger.info('🔄 Đang đồng bộ dữ liệu Voice vào Database trước khi tắt/redeploy...');
  const now = Date.now();

  for (const [sessionKey, joinTime] of voiceSessions.entries()) {
    const [userId, guildId] = sessionKey.split('-');
    const durationSeconds = Math.floor((now - joinTime) / 1000);

    if (durationSeconds > 0 && userId && guildId) {
      try {
        await statsRepo.updateStats(userId, guildId, {
          messages: 0,
          voiceTime: durationSeconds,
        });
      } catch (err) {
        logger.error(`Lỗi lưu voice khẩn cấp cho user ${userId}:`, err.message);
      }
    }
  }
  voiceSessions.clear();
  logger.info('✅ Đã lưu xong dữ liệu Voice!');
}

// Bắt các sự kiện tắt process từ Railway
process.on('SIGTERM', async () => {
  await flushVoiceSessions();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await flushVoiceSessions();
  process.exit(0);
});

// 3. Hàm Load tất cả Slash Commands trong thư mục src/commands
function loadCommands() {
  const commandsPath = path.join(__dirname, 'commands');
  if (!fs.existsSync(commandsPath)) return [];

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));
  const commandsData = [];

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);

    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
      commandsData.push(command.data.toJSON());
    } else {
      logger.warn(`Cảnh báo: Lệnh tại ${filePath} thiếu thuộc tính "data" hoặc "execute".`);
    }
  }
  return commandsData;
}

// 4. Hàm Load tất cả Events trong thư mục src/events
function loadEvents() {
  const eventsPath = path.join(__dirname, 'events');
  if (!fs.existsSync(eventsPath)) return;

  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    if (event.once) {
      client.once(event.name, (...args) => event.execute(...args));
    } else {
      client.on(event.name, (...args) => event.execute(...args));
    }
  }
}

// 5. Sự kiện khi Bot đã sẵn sàng hoạt động (Ready)
client.once('ready', async () => {
  logger.info(`🤖 Bot đã đăng nhập thành công với tên: ${client.user.tag}`);

  // Đăng ký Slash Commands lên Discord API (Global Commands)
  const commandsData = loadCommands();
  if (commandsData.length > 0) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      logger.info('🚀 Đang đăng ký Slash Commands (Global)...');
      await rest.put(Routes.applicationCommands(client.user.id), {
        body: commandsData,
      });
      logger.info('✅ Đã đăng ký thành công các Slash Commands!');
    } catch (error) {
      logger.error('❌ Lỗi khi đăng ký Slash Commands:', error);
    }
  }
});

// 6. Xử lý khi người dùng tương tác với Slash Command
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Lỗi khi thực thi lệnh /${interaction.commandName}:`, error);
    const errorMessage = {
      content: '❌ Đã xảy ra lỗi khi thực hiện lệnh này!',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// 7. Lắng nghe tin nhắn để tính tổng số tin nhắn (Message Stats)
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  try {
    await statsRepo.incrementMessageCount(message.author.id, message.guild.id);
  } catch (err) {
    logger.error('Lỗi khi tăng đếm tin nhắn:', err.message);
  }
});

// 8. Khởi động hệ thống (Kết nối PostgreSQL -> Load Events -> Login Bot)
async function startBot() {
  try {
    // Kết nối và tạo bảng CSDL PostgreSQL
    logger.info('📦 Đang khởi tạo kết nối PostgreSQL Database...');
    await initDb();
    logger.info('✅ Khởi tạo PostgreSQL Database thành công!');

    // Load các sự kiện (Voice, Message, ...)
    loadEvents();

    // Đăng nhập vào Discord
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error('💥 Không thể khởi động Bot:', error);
    process.exit(1);
  }
}

startBot();
                                        
