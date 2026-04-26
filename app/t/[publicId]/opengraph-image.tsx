import { ImageResponse } from "next/og";
import { headers } from "next/headers";

import { getAgentThreadEnv } from "@/lib/cloudflare";
import {
  buildPublicAssetUrl,
  getDisplayServerHost,
  getOgTitleFontSize,
  getSessionTitle,
  OG_IMAGE_CACHE_CONTROL,
  OG_IMAGE_SIZE,
  resolvePublicBaseUrl,
  truncateOgTitle,
} from "@/lib/og";
import { loadSessionByPublicId } from "@/lib/storage";
import { getSourceInfo } from "@/lib/thread-source";
import { DEFAULT_SERVER_URL } from "@/src/cli/args";

export const alt = "agent thread preview";
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export const size = OG_IMAGE_SIZE;

type OgImageProps = {
  params: Promise<{ publicId: string }>;
};

async function loadFont(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load OG font: ${url}`);
  }

  return response.arrayBuffer();
}

async function getOgFonts(publicBaseUrl: string) {
  const [notoSans, jetBrainsMono] = await Promise.all([
    loadFont(buildPublicAssetUrl(publicBaseUrl, "/noto-sans-v27-latin-regular.ttf")),
    loadFont(buildPublicAssetUrl(publicBaseUrl, "/jetbrains-mono-regular.ttf")),
  ]);

  return [
    { name: "Noto Sans", data: notoSans, weight: 500 as const, style: "normal" as const },
    { name: "JetBrains Mono", data: jetBrainsMono, weight: 500 as const, style: "normal" as const },
  ];
}

async function getRequestAssetBaseUrl(fallbackBaseUrl: string): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (!host) {
    return fallbackBaseUrl;
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

function renderImage({
  title,
  logoUrl,
  serverHost,
}: {
  title: string;
  logoUrl: string;
  serverHost: string;
}) {
  const titleFontSize = getOgTitleFontSize(title);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#f3efe6",
        color: "#1a1815",
        padding: "56px 64px",
        fontFamily: "Noto Sans, ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={logoUrl}
              alt=""
              width={64}
              height={64}
              style={{
                objectFit: "contain",
              }}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            border: "1px solid #d9d2c0",
            borderRadius: 999,
            color: "#1a1815",
            background: "rgba(255,255,255,0.55)",
            padding: "12px 20px",
            fontSize: 15,
            fontWeight: 500,
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
          }}
        >
          {serverHost}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          width: 1040,
          maxWidth: 1040,
          maxHeight: 310,
          marginTop: 28,
          overflow: "hidden",
          color: "#1a1815",
          fontSize: titleFontSize,
          fontWeight: 500,
          lineHeight: 1.12,
          letterSpacing: "-0.025em",
          textOverflow: "ellipsis",
          wordBreak: "break-word",
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: "flex",
          width: "100%",
          height: 3,
          marginTop: 18,
          borderRadius: 2,
          background: "#9caf80",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            right: 0,
            top: -3,
            width: 9,
            height: 9,
            borderRadius: 999,
            background: "#6f8657",
          }}
        />
      </div>
    </div>
  );
}

export default async function OpenGraphImage({ params }: OgImageProps) {
  const { publicId } = await params;
  const env = getAgentThreadEnv();
  const publicBaseUrl = resolvePublicBaseUrl(env.PUBLIC_BASE_URL ?? env.AGENT_THREAD_SERVER_URL, DEFAULT_SERVER_URL);
  const assetBaseUrl = await getRequestAssetBaseUrl(publicBaseUrl);
  const result = await loadSessionByPublicId(env, publicId);

  if (!result) {
    return new Response("Not found", { status: 404 });
  }

  const title = truncateOgTitle(getSessionTitle(result.session));
  const sourceInfo = getSourceInfo(result.session);

  return new ImageResponse(
    renderImage({
      title,
      logoUrl: buildPublicAssetUrl(assetBaseUrl, sourceInfo.logoSrc),
      serverHost: getDisplayServerHost(publicBaseUrl),
    }),
    {
      ...OG_IMAGE_SIZE,
      fonts: await getOgFonts(assetBaseUrl),
      headers: {
        "Cache-Control": OG_IMAGE_CACHE_CONTROL,
      },
    },
  );
}
