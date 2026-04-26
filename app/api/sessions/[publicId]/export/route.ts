import { NextResponse } from "next/server";

import { getAgentThreadEnv } from "@/lib/cloudflare";
import { loadSessionExportByPublicId } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const result = await loadSessionExportByPublicId(getAgentThreadEnv(), publicId);

  if (!result) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json(result);
}
