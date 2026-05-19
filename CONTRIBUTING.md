# Contributing

Thanks for helping improve agent-thread.

## Development

This project uses Bun for dependency management, scripts, tests, and builds.

```bash
bun install
bun test
bun run check
```

Use `bun run dev` for local UI work. Use `bun run preview` when testing routes that need Cloudflare D1/R2 bindings.

## Pull Requests

- Keep changes focused and explain the user-facing behavior.
- Add or update tests for behavior changes.
- Use `bun test` for test coverage and `bun run check` for TypeScript validation.
- Run `bun run build` when touching Next.js, OpenNext, deployment config, or the CLI bundle.

## Privacy

Do not attach real Claude Code or Codex transcripts to issues or pull requests unless they have been reviewed and sanitized. Transcript files can contain secrets, local paths, prompts, source code, and tool outputs.
