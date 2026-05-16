import { getAgentThreadEnv } from "@/lib/cloudflare";
import { buildSessionEventsResponse } from "@/lib/transcript/events-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const cursor = new URL(request.url).searchParams.get("cursor");
  return buildSessionEventsResponse(getAgentThreadEnv(), publicId, cursor);
}
