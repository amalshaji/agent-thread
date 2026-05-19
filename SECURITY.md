# Security Policy

## Reporting Vulnerabilities

Please report security issues privately instead of opening a public GitHub issue.

Email the maintainer or use GitHub private vulnerability reporting if it is enabled for this repository. Include:

- affected version or commit
- reproduction steps
- expected impact
- any relevant logs or payload examples with secrets removed

## Handling Transcript Data

agent-thread handles Claude Code and Codex transcript files. Treat exported sessions as sensitive because they may contain prompts, tool output, local paths, source code, credentials, tokens, or other private project data.

Do not include private transcript links or raw export bundles in public issues unless you have reviewed and sanitized them.
