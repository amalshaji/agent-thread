# agent-thread

Claude Code and Codex session uploader and share viewer built with Bun, Next.js, shadcn/ui, OpenNext, and Cloudflare Workers.

## What works now

- `bunx agent-thread` style CLI entrypoint via the `agent-thread` binary
- Claude session discovery from `~/.claude/projects`
- Codex thread discovery from `~/.codex/sessions`
- Interactive selection of sessions for the current directory
- Shared thread imports back into Claude Code or Codex
- Upload endpoint as a Next route handler
- Server-rendered share page backed by D1 metadata and R2 session storage

## Install

```bash
bun install
```

## Run the CLI locally

Start the Next app first:

```bash
bun run dev
```

Then run the CLI against that local app:

```bash
AGENT_THREAD_SERVER_URL=http://127.0.0.1:3000 bun run cli
```

Or upload the latest session without a prompt:

```bash
AGENT_THREAD_SERVER_URL=http://127.0.0.1:3000 bun run cli --latest
```

Upload Codex threads instead of the default Claude provider:

```bash
AGENT_THREAD_SERVER_URL=http://127.0.0.1:3000 bun run cli --codex
```

Import a shared thread into Claude Code or Codex:

```bash
AGENT_THREAD_SERVER_URL=http://127.0.0.1:3000 bun run cli --import 0c5a0y4a406r
AGENT_THREAD_SERVER_URL=http://127.0.0.1:3000 bun run cli --import http://127.0.0.1:3000/t/0c5a0y4a406r --to codex
```

If `--workspace` is omitted, imports are attached to the current directory. Use `--dry-run` to inspect target paths without writing files and `--force` to overwrite an existing local import.

Without `AGENT_THREAD_SERVER_URL`, the CLI defaults to the deployed Worker:

```bash
bunx agent-thread
npx agent-thread --codex
npx agent-thread --import 0c5a0y4a406r --to codex
```

Current default: `https://agent-thread.com`

## Cloudflare setup

Create an R2 bucket and a D1 database, then update `wrangler.toml` with the real binding values.

Apply the D1 migration:

```bash
bunx wrangler d1 migrations apply agent-thread
```

## Test

```bash
bun test
```

## Deploy

Next.js is deployed to Cloudflare Workers through OpenNext:

```bash
bun run preview
bun run deploy
```
