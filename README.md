# Discord Stats Bot

A Discord.js v14 bot that tracks per-user message counts and voice-channel
joins per server, with `/stats`, `/leaderboard`, and `/serverinfo` slash
commands. Data is stored in SQLite (`better-sqlite3`).

## Features

- `/stats [@user]` — view message/voice stats for yourself or another member
- `/leaderboard [type:messages|voice] [limit:10]` — top members in the server
- `/serverinfo` — member count, creation date, owner, last sync time
- Auto-creates its database tables on first boot
- Retries the database connection on startup if it's briefly unavailable
- Structured logging for every important action

## Project structure

```
discord-stats-bot/
├── Dockerfile
├── .dockerignore
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── src/
    ├── index.js                 # Bot entry point
    ├── deploy-commands.js       # Registers slash commands with Discord
    ├── commands/
    │   ├── stats.js
    │   ├── leaderboard.js
    │   └── serverinfo.js
    ├── events/
    │   ├── ready.js
    │   ├── messageCreate.js
    │   └── voiceStateUpdate.js
    ├── database/
    │   ├── db.js                # Connection + schema init + retry logic
    │   ├── migrate.js           # `npm run migrate` entry point
    │   └── statsRepository.js   # All SQL queries live here
    └── utils/
        └── logger.js
```

## Database schema

**`user_stats`**

| column            | type    | notes                          |
|-------------------|---------|---------------------------------|
| user_id           | TEXT    | Discord user ID                |
| guild_id          | TEXT    | Discord guild ID                |
| total_messages    | INTEGER | default 0                       |
| total_voice_join  | INTEGER | default 0                       |
| last_updated      | TEXT    | ISO timestamp, auto-updated     |

Primary key: `(user_id, guild_id)`

**`server_stats`**

| column             | type    | notes                     |
|--------------------|---------|---------------------------|
| guild_id           | TEXT    | primary key                |
| server_created_at  | TEXT    | ISO timestamp              |
| total_members      | INTEGER |                             |
| updated_at         | TEXT    | ISO timestamp, auto-updated |

Tables (and indexes) are created automatically the first time the bot
connects to the database — no manual setup required, though `npm run
migrate` is also available if you want to provision the schema separately
from starting the bot (e.g. as a CI/deploy step).

### Counting rules

- **Messages**: every non-bot message sent in a real text channel/thread
  increments `total_messages` by 1. Messages sent in a voice channel's
  attached text chat are ignored, as requested.
- **Voice joins**: `total_voice_join` increments by 1 only when a member
  goes from *not being in any voice channel* to *being in one* — i.e. a
  fresh connection. Switching between voice channels while already
  connected, muting, or deafening does **not** count as a new join.

## Prerequisites

- Node.js 18+ (Node 20 recommended)
- A Discord application + bot token — create one at the
  [Discord Developer Portal](https://discord.com/developers/applications)
- The bot invited to your server with the `applications.commands` and `bot`
  scopes, and (at minimum) the following bot permissions: `View Channels`,
  `Send Messages`, `Embed Links`, `Read Message History`
- The **Message Content** intent enabled for your bot in the Developer
  Portal (Bot → Privileged Gateway Intents), since it's required to receive
  `messageCreate` events reliably
- The **Server Members** intent enabled as well (used for accurate member
  counts in `/serverinfo`)

## Local setup

1. **Clone and install dependencies**

   ```bash
   git clone <your-repo-url>
   cd discord-stats-bot
   npm install
   ```

2. **Configure environment variables**

   ```bash
   cp .env.example .env
   ```

   Then edit `.env`:

   ```
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_client_id_here
   GUILD_ID=your_test_server_id_here   # optional, for instant command registration
   DATABASE_PATH=./data/stats.db
   LOG_LEVEL=info
   ```

   - `DISCORD_TOKEN` and `CLIENT_ID` are required.
   - `GUILD_ID` is optional. Set it during development so slash commands
     register instantly to one server; leave it blank in production to
     register commands globally (propagation can take up to ~1 hour).

3. **Register slash commands**

   ```bash
   npm run deploy-commands
   ```

   Re-run this any time you add, remove, or edit a command's definition.

4. **(Optional) Run the migration step on its own**

   ```bash
   npm run migrate
   ```

   This just opens the database and creates any missing tables — the bot
   also does this automatically on boot, so this is only needed if you want
   to provision the DB ahead of time.

5. **Start the bot**

   ```bash
   npm start
   ```

   For local development with auto-restart on file changes:

   ```bash
   npm run dev
   ```

You should see log lines confirming the database connected and the bot
logged in, e.g.:

```
[...] [INFO] Connected to SQLite database at ./data/stats.db (attempt 1)
[...] [INFO] Database schema verified/initialized.
[...] [INFO] Bot ready — logged in as YourBot#1234
[...] [INFO] Serving 1 guild(s).
```

## Deploying to Railway

This project ships with a `Dockerfile`, so Railway will detect and build it
automatically — no Nixpacks configuration needed.

1. **Push your code to a GitHub repository** (make sure `.env` is **not**
   committed — it's already in `.gitignore`).

2. **Create a new Railway project** → *Deploy from GitHub repo* → select
   your repository.

3. **Set environment variables** in the Railway project settings
   (Variables tab):

   | Variable        | Value                                             |
   |-----------------|----------------------------------------------------|
   | `DISCORD_TOKEN` | your bot token                                      |
   | `CLIENT_ID`     | your application client ID                          |
   | `GUILD_ID`      | *(optional — omit for global commands)*             |
   | `DATABASE_PATH` | `/app/data/stats.db`                                |
   | `LOG_LEVEL`     | `info`                                              |

4. **Add a persistent Volume** (Railway → your service → *Volumes* tab):

   - Mount path: `/app/data`

   This is important: without a volume, the SQLite file lives in the
   container's ephemeral filesystem and **all stats are lost on every
   redeploy**. The `DATABASE_PATH` above (`/app/data/stats.db`) is set to
   live inside that mounted volume.

5. **Deploy.** Railway will build the image from the included `Dockerfile`
   and start the bot with `node src/index.js` (the container's `CMD`).

6. **Register slash commands against your bot.** You only need to do this
   once (and again whenever you change a command's definition). Easiest
   options:
   - Run `npm run deploy-commands` locally with the same `DISCORD_TOKEN` /
     `CLIENT_ID` from a machine with your `.env` configured, or
   - Use Railway's *Shell* / one-off command feature to run
     `npm run deploy-commands` inside the deployed environment.

7. Once commands are registered and the service is running, invite the bot
   to your server (if you haven't already) using an OAuth2 URL generated
   from the Developer Portal with the `bot` and `applications.commands`
   scopes.

### Switching to PostgreSQL (optional)

The schema and queries here are written against SQLite (`better-sqlite3`).
If you'd rather use Railway's managed PostgreSQL plugin instead of a
Volume-backed SQLite file:

- Swap `better-sqlite3` for `pg` (or an async-friendly wrapper like
  `postgres`/`pg-promise`).
- Rework `src/database/db.js` and `src/database/statsRepository.js` to use
  `async/await` queries against `process.env.DATABASE_URL` (Railway injects
  this automatically when you attach a Postgres plugin) instead of
  synchronous `better-sqlite3` calls.
- The table definitions in `initSchema()` are close to standard SQL already
  — the main changes needed are `datetime('now')` → `NOW()` and the
  SQLite-specific `ON CONFLICT (...) DO UPDATE` upsert syntax, which
  PostgreSQL also supports natively with the same syntax, so that part
  needs little to no change.

This is left as an extension point rather than built in, since SQLite +
a Railway Volume is simpler to operate for a single-instance bot like this
one.

## Troubleshooting

- **Slash commands don't show up** — make sure you ran
  `npm run deploy-commands`, and if you registered them guild-scoped
  (`GUILD_ID` set), confirm the bot is actually in that guild. Global
  commands can take up to an hour to appear.
- **`messageCreate` never fires** — confirm the **Message Content** intent
  is enabled for your bot in the Developer Portal, and that the bot has
  `View Channels` / `Read Message History` permission in the channel.
- **Stats reset after every deploy on Railway** — you're missing the
  Volume mount described in step 4 above, or `DATABASE_PATH` doesn't point
  inside it.
- **`better-sqlite3` fails to install/build** — it compiles native code at
  install time; the included Dockerfile already installs `python3 make g++`
  for this. If installing locally on Windows/macOS, make sure you have the
  usual native build toolchain for your OS.

## License

MIT
# Voice-chat
# Voice-chat
# Voice-chat
