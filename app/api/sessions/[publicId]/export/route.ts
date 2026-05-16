import { NextResponse } from "next/server";

import { getAgentThreadEnv } from "@/lib/cloudflare";
import { createSessionExportResponse } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const result = await createSessionExportResponse(getAgentThreadEnv(), publicId);

  if (!result) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return result;
}
