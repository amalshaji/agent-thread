import { getCloudflareContext } from "@opennextjs/cloudflare";

export type AgentThreadEnv = {
  DB: D1Database;
  SESSIONS_BUCKET: R2Bucket;
  PUBLIC_BASE_URL?: string;
  AGENT_THREAD_SERVER_URL?: string;
};

export function getAgentThreadEnv(): AgentThreadEnv {
  return getCloudflareContext().env as CloudflareEnv as AgentThreadEnv;
}
