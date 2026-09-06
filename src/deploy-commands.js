'use strict';

// Registers slash commands with Discord's API.
// - If GUILD_ID is set, commands are registered to that guild only
//   (near-instant propagation — ideal for development).
// - If GUILD_ID is empty, commands are registered globally
//   (can take up to ~1 hour to propagate — use for production).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');
const logger = require('./utils/logger');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  logger.error('DISCORD_TOKEN and CLIENT_ID must be set in your environment/.env file.');
  process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    logger.warn(`Command file ${file} is missing "data" or "execute" — skipped.`);
  }
}

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    logger.info(`Registering ${commands.length} slash command(s)...`);

    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);

    const data = await rest.put(route, { body: commands });

    logger.info(
      `Successfully registered ${data.length} command(s) ${
        GUILD_ID ? `to guild ${GUILD_ID}` : 'globally'
      }.`
    );
  } catch (err) {
    logger.error('Failed to register slash commands:', err);
    process.exit(1);
  }
})();
