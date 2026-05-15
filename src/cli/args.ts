export interface CliOptions {
  cwd: string;
  provider: "claude" | "codex";
  importRef?: string;
  workspace: string;
  claudeHome?: string;
  codexHome?: string;
  serverUrl: string;
  latest: boolean;
  json: boolean;
  dryRun: boolean;
  force: boolean;
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
    "  --import <url|id>     Import a shared thread back into its source app",
    "  --workspace <path>    Workspace path to attach imported history to",
    "  --cwd <path>          Inspect sessions for a different directory",
    "  --claude-home <path>  Override the Claude home directory",
    "  --codex-home <path>   Override the Codex home directory",
    "  --server <url>        Server base URL",
    "  --latest              Export the latest session without prompting",
    "  --dry-run             Show import target paths without writing files",
    "  --force               Overwrite existing local import files",
    "  --json                Print the result as JSON",
    "  --help                Show this help message",
  ].join("\n");
}

function flagValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    provider: "claude",
    workspace: process.cwd(),
    serverUrl: resolveServerUrl(),
    latest: false,
    json: false,
    dryRun: false,
    force: false,
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
      case "--import":
        options.importRef = flagValue(argv, index, "--import");
        index += 1;
        break;
      case "--workspace":
        options.workspace = flagValue(argv, index, "--workspace");
        index += 1;
        break;
      case "--cwd":
        options.cwd = flagValue(argv, index, "--cwd");
        index += 1;
        break;
      case "--claude-home":
        options.claudeHome = flagValue(argv, index, "--claude-home");
        index += 1;
        break;
      case "--codex-home":
        options.codexHome = flagValue(argv, index, "--codex-home");
        index += 1;
        break;
      case "--server":
        options.serverUrl = flagValue(argv, index, "--server");
        index += 1;
        break;
      case "--latest":
        options.latest = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--force":
        options.force = true;
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
