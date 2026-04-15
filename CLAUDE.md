# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # install dependencies
npm run build        # compile TypeScript to build/
npm run client       # build + run (development)
npm run watch        # run with hot reload via tsx (no build step)
npm run tests        # run test suite
npm run coverage     # run tests with coverage report
npm run start        # docker compose build + start
```

Run a single test file:
```bash
npx vitest run tests/queue.test.ts
```

Requires Node >= 22.12.0, npm >= 10.9.0.

## Environment

Copy `.env.sample` to `.env` before running. Key variables:

| Variable | Default | Description |
|---|---|---|
| `CLIENT_TOKEN` | required | Discord bot token |
| `OLLAMA_IP` | `127.0.0.1` | Ollama host IP |
| `OLLAMA_PORT` | `11434` | Ollama port |
| `MODEL` | `llama3.2` | Default LLM model |
| `SYSTEM_PROMPT` | (built-in) | Global system prompt |
| `MAX_CONTEXT_TOKENS` | `4096` | Token budget for channel history |

## Architecture

**Entry point:** `src/index.ts` → `src/client.ts`, which initializes the Discord.js client, connects to Ollama, and calls `registerEvents()`.

### Event system (`src/events/`, `src/utils/events.ts`)

Events are defined with the `event(key, callback)` helper and collected in `src/events/index.ts`. `registerEvents()` in `client.ts` wires them to the Discord client. Each event callback receives `{ client, log, ollama }` props.

- **`messageCreate`** — core LLM flow: cleans the mention, loads channel history from disk, trims to token budget, summarizes history if > 5 messages, calls `normalMessage()` to dispatch to Ollama, persists the result
- **`interactionCreate`** — routes slash commands, checks Discord permissions and optional role-based guards from server config
- **`ready`** — registers slash commands on startup via `registerCommands()`
- **`threadDelete`** — cleans up persisted history when a thread is deleted

### Slash commands (`src/commands/`)

Each command is a `SlashCommand` object (extends `ChatInputApplicationCommandData`) with a `run()` method. All commands are collected in `src/commands/index.ts` and registered at startup. Role-based access control is stored per-command in the server config (`commandRoles`).

### Request dispatcher (`src/queues/requestDispatcher.ts`)

Singleton `RequestDispatcher` serializes all Ollama calls through a concurrency-limited queue (default: 2 concurrent). All LLM calls must go through `requestDispatcher.blockResponse()` or `requestDispatcher.streamResponse()` — never call Ollama directly. Requests that wait too long in queue are rejected with a rate limit error.

### Storage layer (`src/storage/`)

All persistence is flat JSON files under the `data/` directory (gitignored). `ChannelStorage` reads/writes per-channel message history (`{channelId}-channel-context.json`). `Config` reads/writes per-guild (`{guildId}-config.json`) and per-channel (`{channelId}-config.json`) configuration. All file I/O goes through `withLock()` (spin-lock via `.lock` files) to prevent concurrent write corruption.

### Config resolution (`src/config.ts`)

`Config.getChannelConfig(guildId, channelId)` merges env defaults → server config → channel config (channel wins). New guilds/channels are auto-initialized with defaults on first access.

### Response flow

`normalMessage()` in `src/utils/messageNormal.ts` handles Discord's 2000-character limit by chunking long responses. Streaming mode (`messageStream` option) edits a placeholder message in-place as tokens arrive, creating new message blocks when chunks exceed 2000 chars.

## Style

- 4-space tabs, no semicolons (see `.github/style.md`)
- ESM project (`"type": "module"`) — all internal imports use `.js` extensions even for `.ts` source files
- Branch naming: `feature/**`, `bug/**`, `docs/**`, `releases/**`
