'use strict';

// Standalone migration entry point: `npm run migrate`.
// Useful for provisioning the database schema before the bot's first boot
// (e.g. as a Railway pre-deploy/release step).
require('dotenv').config();
const logger = require('../utils/logger');
const { initDb } = require('./index');

(async () => {
  try {
    await initDb(); // creates the PostgreSQL pool and ensures schema exists
    logger.info('Migration complete. PostgreSQL schema is up to date.');
    process.exit(0);
  } catch (err) {
    logger.error('Migration failed:', err);
    process.exit(1);
  }
})();
