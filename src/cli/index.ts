#!/usr/bin/env bun

import { cancel, intro, outro, spinner } from "@clack/prompts";

import { parseArgs } from "./args";
import { formatSessionLabel } from "./display";
import { chooseSession } from "./prompt";
import { uploadSelection } from "./upload";
import { discoverClaudeSessions } from "../shared/claude";

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  if (!options.json) {
    intro("agent-thread");
  }

  const scanSpinner = spinner();
  scanSpinner.start("Scanning local Claude sessions");
  const sessions = await discoverClaudeSessions({
    cwd: options.cwd,
    claudeHome: options.claudeHome,
  });
  scanSpinner.stop(`Found ${sessions.length} matching session${sessions.length === 1 ? "" : "s"}`);

  if (sessions.length === 0) {
    if (!options.json) {
      cancel("No Claude sessions found for this directory.");
    } else {
      console.log(JSON.stringify({ error: "No Claude sessions found." }));
    }
    process.exit(1);
  }

  const selected = await chooseSession(sessions, options.latest);

  if (!selected) {
    if (!options.json) {
      cancel("No session selected.");
    }
    process.exit(1);
  }

  const uploadSpinner = spinner();
  uploadSpinner.start(`Uploading ${formatSessionLabel(selected)}`);
  const result = await uploadSelection(options.serverUrl, selected, options.claudeHome);
  uploadSpinner.stop(`Uploaded ${formatSessionLabel(selected)}`);

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
