#!/usr/bin/env node

import { cancel, intro, outro, spinner } from "@clack/prompts";

import { parseArgs, type CliOptions } from "./args";
import { formatSessionLabel } from "./display";
import { importSharedSession, formatImportSummary } from "./import";
import { chooseImportTarget, chooseSession } from "./prompt";
import { uploadSelection } from "./upload";
import { discoverClaudeSessions } from "../shared/claude";
import { discoverCodexSessions } from "../shared/codex";

function providerLabel(provider: "claude" | "codex"): string {
  return provider === "codex" ? "Codex" : "Claude";
}

async function runClaudeUpload(options: CliOptions, label: string) {
  const scanSpinner = spinner();
  scanSpinner.start(`Scanning local ${label} sessions`);
  const sessions = await discoverClaudeSessions({
    cwd: options.cwd,
    claudeHome: options.claudeHome,
  });
  scanSpinner.stop(`Found ${sessions.length} matching session${sessions.length === 1 ? "" : "s"}`);

  if (sessions.length === 0) {
    if (!options.json) {
      cancel(`No ${label} sessions found for this directory.`);
    } else {
      console.log(JSON.stringify({ error: `No ${label} sessions found.` }));
    }
    process.exit(1);
  }

  const selected = await chooseSession(sessions, options.latest, undefined, label);

  if (!selected) {
    if (!options.json) {
      cancel("No session selected.");
    }
    process.exit(1);
  }

  const uploadSpinner = spinner();
  uploadSpinner.start(`Uploading ${formatSessionLabel(selected)}`);
  const result = await uploadSelection(options.serverUrl, {
    provider: "claude",
    session: selected,
    claudeHome: options.claudeHome,
  });
  uploadSpinner.stop(`Uploaded ${formatSessionLabel(selected)}`);

  return result;
}

async function runCodexUpload(options: CliOptions, label: string) {
  const scanSpinner = spinner();
  scanSpinner.start(`Scanning local ${label} sessions`);
  const sessions = await discoverCodexSessions({
    cwd: options.cwd,
    codexHome: options.codexHome,
  });
  scanSpinner.stop(`Found ${sessions.length} matching session${sessions.length === 1 ? "" : "s"}`);

  if (sessions.length === 0) {
    if (!options.json) {
      cancel(`No ${label} sessions found for this directory.`);
    } else {
      console.log(JSON.stringify({ error: `No ${label} sessions found.` }));
    }
    process.exit(1);
  }

  const selected = await chooseSession(sessions, options.latest, undefined, label);

  if (!selected) {
    if (!options.json) {
      cancel("No session selected.");
    }
    process.exit(1);
  }

  const uploadSpinner = spinner();
  uploadSpinner.start(`Uploading ${formatSessionLabel(selected)}`);
  const result = await uploadSelection(options.serverUrl, {
    provider: "codex",
    session: selected,
    codexHome: options.codexHome,
  });
  uploadSpinner.stop(`Uploaded ${formatSessionLabel(selected)}`);

  return result;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const label = providerLabel(options.provider);

  if (!options.json) {
    intro("agent-thread");
  }

  if (options.importRef) {
    const target = options.importTarget ?? (await chooseImportTarget());
    if (!target) {
      if (!options.json) {
        cancel("No import target selected. Pass --to claude or --to codex.");
      }
      process.exit(1);
    }

    const importSpinner = spinner();
    if (!options.json) {
      importSpinner.start(`Fetching shared thread`);
    }
    const result = await importSharedSession({
      serverUrl: options.serverUrl,
      importRef: options.importRef,
      target,
      workspace: options.workspace,
      claudeHome: options.claudeHome,
      codexHome: options.codexHome,
      dryRun: options.dryRun,
      force: options.force,
    });
    if (!options.json) {
      importSpinner.stop(options.dryRun ? "Import plan ready" : "Import complete");
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    outro(formatImportSummary(result));
    return;
  }

  const result =
    options.provider === "codex"
      ? await runCodexUpload(options, label)
      : await runClaudeUpload(options, label);

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  outro(result.url);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  if (process.stdout.isTTY) {
    cancel(message);
  } else {
    console.error(message);
  }

  process.exit(1);
});
