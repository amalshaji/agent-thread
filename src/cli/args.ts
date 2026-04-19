export interface CliOptions {
  cwd: string;
  claudeHome?: string;
  serverUrl: string;
  latest: boolean;
  json: boolean;
}

export function usage(): string {
  return [
    "Usage: bunx agent-thread [options]",
    "",
    "Options:",
    "  --cwd <path>          Inspect Claude sessions for a different directory",
    "  --claude-home <path>  Override the Claude home directory",
    "  --server <url>        Worker base URL",
    "  --latest              Upload the latest session without prompting",
    "  --json                Print the result as JSON",
    "  --help                Show this help message",
  ].join("\n");
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    serverUrl: process.env.AGENT_THREAD_SERVER_URL ?? "https://agent-thread.amalshaji.workers.dev",
    latest: false,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg) {
      continue;
    }

    switch (arg) {
      case "--cwd":
        options.cwd = argv[index + 1] ?? options.cwd;
        index += 1;
        break;
      case "--claude-home":
        options.claudeHome = argv[index + 1];
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
