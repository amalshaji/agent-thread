export interface CliOptions {
  cwd: string;
  provider: "claude" | "codex";
  claudeHome?: string;
  codexHome?: string;
  serverUrl: string;
  latest: boolean;
  json: boolean;
}

export const DEFAULT_SERVER_URL = "https://agent-thread.com";

export function resolveServerUrl(env: Record<string, string | undefined> = process.env): string {
  return env.AGENT_THREAD_SERVER_URL ?? DEFAULT_SERVER_URL;
}

export function usage(): string {
  return [
    "Usage: bunx agent-thread [options]",
    "",
    "Options:",
    "  --codex               Inspect Codex threads instead of Claude sessions",
    "  --claude              Inspect Claude sessions (default)",
    "  --cwd <path>          Inspect sessions for a different directory",
    "  --claude-home <path>  Override the Claude home directory",
    "  --codex-home <path>   Override the Codex home directory",
    "  --server <url>        Server base URL",
    "  --latest              Upload the latest session without prompting",
    "  --json                Print the result as JSON",
    "  --help                Show this help message",
  ].join("\n");
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    provider: "claude",
    serverUrl: resolveServerUrl(),
    latest: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    switch (arg) {
      case "--codex":
        options.provider = "codex";
        break;
      case "--claude":
        options.provider = "claude";
        break;
      case "--cwd":
        options.cwd = argv[index + 1] ?? options.cwd;
        index += 1;
        break;
      case "--claude-home":
        options.claudeHome = argv[index + 1];
        index += 1;
        break;
      case "--codex-home":
        options.codexHome = argv[index + 1];
        index += 1;
        break;
      case "--server":
        options.serverUrl = argv[index + 1] ?? options.serverUrl;
        index += 1;
        break;
      case "--latest":
        options.latest = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        console.log(usage());
        process.exit(0);
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        break;
    }
  }

  return options;
}
