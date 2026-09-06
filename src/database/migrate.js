'use strict';

// Standalone migration entry point: `npm run migrate`.
// Useful for provisioning the database schema before the bot's first boot
// (e.g. as a Railway pre-deploy/release step).
require('dotenv').config();
const logger = require('../utils/logger');
const { getDb, DB_PATH } = require('./db');

try {
  getDb(); // getDb() creates the connection AND runs initSchema()
  logger.info(`Migration complete. Database ready at ${DB_PATH}`);
  process.exit(0);
} catch (err) {
  logger.error('Migration failed:', err);
  process.exit(1);
}
