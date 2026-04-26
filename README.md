# agent-thread

Share, inspect, import, and locally convert Claude Code and Codex chat sessions.

agent-thread is a TypeScript CLI and Next.js share viewer for publishing local agent chats as public links. It uses Bun for development, tests, and builds, while the published CLI is Node-compatible. It can also import shared threads back into Claude Code or Codex, and convert local Claude/Codex histories without uploading them.

## Features

- Claude Code session discovery from `~/.claude/projects`
- Codex thread discovery from `~/.codex/sessions`
- Interactive session picker scoped to the current project
- Public share pages backed by Cloudflare D1 and R2
- Shared thread imports back into Claude Code or Codex
- Local Claude Code <-> Codex chat conversion without uploading
- `bunx agent-thread` CLI entrypoint through the `agent-thread` binary

## CLI Usage

Upload the latest Claude Code session to the default hosted service:

```bash
bunx agent-thread --latest
```

Upload Codex threads instead:

```bash
bunx agent-thread --codex
```

Point the CLI at a local Cloudflare preview or self-hosted server:

```bash
AGENT_THREAD_SERVER_URL=http://127.0.0.1:<preview-port> bunx agent-thread
AGENT_THREAD_SERVER_URL=https://your-domain.example bunx agent-thread --codex
```

Import a shared thread into Claude Code or Codex:

```bash
bunx agent-thread --import 0c5a0y4a406r
bunx agent-thread --import https://agent-thread.com/t/0c5a0y4a406r --to codex
```

If `--workspace` is omitted, imports are attached to the current directory. Use `--dry-run` to inspect target paths without writing files and `--force` to overwrite an existing local import.

Convert a local chat into the opposite app without uploading:

```bash
bunx agent-thread --local
bunx agent-thread --codex --local
bunx agent-thread --local --latest --dry-run
bunx agent-thread --codex --local --workspace /path/to/project
```

Local conversion always targets the opposite app. `--to` is optional and must match that opposite target when provided.
It does not require a web server or Cloudflare resources.

## Requirements

- Bun
- A local Claude Code or Codex history if you want to upload or convert chats
- Cloudflare account, D1 database, and R2 bucket if you want to self-host the web app

## Local Setup

Install dependencies:

```bash
bun install
```

Run type checks and tests:

```bash
bun run check
bun test
```

Start the Next.js dev server:

```bash
bun run dev
```

The dev server is useful for UI work. Upload, export, and share APIs require Cloudflare bindings for D1 and R2, so use `bun run preview` or a deployed Worker when you need the full hosted flow.

## Self-Hosting

agent-thread deploys to Cloudflare Workers through OpenNext. The hosted app needs:

- D1 binding named `DB`
- R2 binding named `SESSIONS_BUCKET`
- `PUBLIC_BASE_URL` set to your public app URL
- `AGENT_THREAD_SERVER_URL` set to the same URL for CLI defaults in the deployed app

Create Cloudflare resources:

```bash
bunx wrangler d1 create agent-thread
bunx wrangler r2 bucket create agent-thread-sessions
```

Update `wrangler.toml` with your own values:

- `database_id` from the D1 create output
- `bucket_name` for your R2 bucket
- `routes` for your domain, or remove the `[[routes]]` block if you deploy to a workers.dev subdomain
- `PUBLIC_BASE_URL` and `AGENT_THREAD_SERVER_URL`

Apply the D1 migration:

```bash
bunx wrangler d1 migrations apply agent-thread
```

Build and test the Worker locally with Cloudflare bindings:

```bash
bun run preview
```

Deploy:

```bash
bun run deploy
```

After deployment, point the CLI at your instance:

```bash
AGENT_THREAD_SERVER_URL=https://your-domain.example bunx agent-thread --latest
```

## Project Scripts

```bash
bun run cli        # run the TypeScript CLI locally
bun run dev        # run Next.js dev server
bun run preview    # build and preview the Cloudflare Worker
bun run deploy     # build and deploy to Cloudflare
bun run build      # production build plus CLI bundle
bun run check      # TypeScript check
bun test           # test suite
```

## Data Model

Uploads store metadata in D1 and session JSONL payloads in R2. The first migration creates the `uploads` table and indexes public IDs and source session IDs.

The app stores raw source files alongside a normalized transcript representation so shared threads can be rendered in the browser and imported back into either supported local app.
