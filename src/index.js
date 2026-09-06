'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection, Events } = require('discord.js');
const logger = require('./utils/logger');

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  logger.error('DISCORD_TOKEN is not set. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // required to reliably react to messageCreate content-independent counting
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers, // needed for accurate memberCount / member tagging
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();

// ---- Load slash commands ----
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    logger.debug(`Loaded command: ${command.data.name}`);
  } else {
    logger.warn(`Command file ${file} is missing "data" or "execute" — skipped.`);
  }
}

// ---- Load event handlers ----
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
  logger.debug(`Loaded event: ${event.name}`);
}

// ---- Slash command interaction dispatcher ----
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn(`Received unknown command: ${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (err) {
    logger.error(`Error executing command "${interaction.commandName}":`, err);
    const errorPayload = { content: 'There was an error while executing this command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorPayload).catch(() => {});
    } else {
      await interaction.reply(errorPayload).catch(() => {});
    }
  }
});

// ---- Global error safety nets ----
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
});

client.login(DISCORD_TOKEN).catch((err) => {
  logger.error('Failed to log in to Discord. Check your DISCORD_TOKEN.', err.message);
  process.exit(1);
});
