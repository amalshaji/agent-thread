import { defineCloudflareConfig, type OpenNextConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  buildCommand: "bun --bun ./node_modules/next/dist/bin/next build",
} satisfies OpenNextConfig;
