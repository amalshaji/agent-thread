# Agent Instructions

This repository is a Bun-managed Next.js/OpenNext app. Use Bun for project
commands and dependency management, and keep changes aligned with the existing
Next.js App Router and Cloudflare Worker deployment path.

## Tooling

- Use `bun install` instead of `npm install`, `yarn install`, or `pnpm install`.
- Use `bun run <script>` instead of `npm run <script>`, `yarn run <script>`, or `pnpm run <script>`.
- Use `bun test` for tests.
- Use `bunx <package> <command>` instead of `npx <package> <command>`.
- Do not introduce Vite, Express, Jest, Vitest, npm, yarn, or pnpm.
- When a dependency exposes a Node-oriented CLI, invoke it through Bun, matching the existing scripts. For example: `bun --bun ./node_modules/next/dist/bin/next build`.
- Codex or editor host tooling may use its own configured Node runtime when that tool requires it, such as `js_repl` or browser automation. That exception does not justify adding Node setup, npm scripts, or a project-level Node workflow.

## Project Commands

- Install dependencies: `bun install`
- Run the Next.js dev server: `bun run dev`
- Build the app and CLI: `bun run build`
- Build only the CLI: `bun run build:cli`
- Preview the Cloudflare Worker: `bun run preview`
- Deploy through OpenNext/Cloudflare: `bun run deploy`
- Type-check: `bun run check`
- Run tests: `bun test`
- Run the local CLI entrypoint: `bun run cli`

## Release Workflow

- When updating the CLI version, title the pull request `Release cli {version}`, replacing `{version}` with the exact version being released.

## Architecture

- The frontend and API routes live in Next.js App Router.
- The Cloudflare Worker is produced by `@opennextjs/cloudflare`; `wrangler.toml` points at `.open-next/worker.js`.
- Keep `next.config.ts` compatible with the OpenNext build path, including `output: "standalone"`, unless the deployment strategy is intentionally changed.
- Keep server-side rendering and public transcript rendering in the Next app rather than reintroducing a separate Bun.serve frontend.
- Keep Cloudflare bindings and runtime-specific code isolated behind the existing helper modules.

## Code Style

- Prefer existing local patterns over introducing new abstractions.
- Use Bun APIs in Bun-only scripts when they fit, such as `Bun.file`, `Bun.write`, `Bun.$`, and `bun:sqlite`.
- Node built-in imports such as `node:path` and `node:fs/promises` are acceptable where the existing runtime target needs them, including Next.js, OpenNext, Cloudflare compatibility, and the published CLI bundle.
- The CLI bundle intentionally targets Node compatibility and may keep `#!/usr/bin/env node`.
- Bun loads `.env` automatically; do not add `dotenv`.

## Testing

Use the narrowest meaningful verification for the change:

- `bun test` for behavior covered by tests.
- `bun run check` for TypeScript and route typing.
- `bun run build` when touching Next/OpenNext build behavior, deployment config, or the CLI bundle.
