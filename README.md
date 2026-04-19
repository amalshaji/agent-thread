# agent-thread

Claude session uploader and share viewer built with Bun, Hono, and Cloudflare Workers.

## What works now

- `bunx agent-thread` style CLI entrypoint via the `agent-thread` binary
- Claude session discovery from `~/.claude/projects`
- Interactive selection of sessions for the current directory
- Upload endpoint on a Hono Worker
- Share page route backed by D1 metadata and R2 session storage

## Install

```bash
bun install
```

## Run the CLI locally

Start the Worker first:

```bash
bun run dev
```

Then run the CLI against that Worker:

```bash
AGENT_THREAD_SERVER_URL=http://127.0.0.1:8787 bun run cli
```

Or upload the latest session without a prompt:

```bash
AGENT_THREAD_SERVER_URL=http://127.0.0.1:8787 bun run cli --latest
```

Without `AGENT_THREAD_SERVER_URL`, the CLI defaults to the deployed Worker:

```bash
bunx agent-thread
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
