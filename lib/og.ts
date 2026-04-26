import type { NormalizedSession } from "@/src/shared/contracts";

export const OG_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const;

export const OG_TITLE_MAX_LENGTH = 88;
export const OG_IMAGE_CACHE_CONTROL = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";

function parseBaseUrl(baseUrl: string): URL | null {
  const trimmed = baseUrl.trim();

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

export function resolvePublicBaseUrl(publicBaseUrl: string | undefined, fallbackBaseUrl: string): string {
  const parsed = parseBaseUrl(publicBaseUrl ?? "") ?? parseBaseUrl(fallbackBaseUrl);

  if (!parsed) {
    return fallbackBaseUrl.replace(/\/+$/, "");
  }

  return parsed.origin;
}

export function getDisplayServerHost(publicBaseUrl: string): string {
  return parseBaseUrl(publicBaseUrl)?.hostname ?? publicBaseUrl.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function buildThreadUrl(publicBaseUrl: string, publicId: string): string {
  return `${resolvePublicBaseUrl(publicBaseUrl, publicBaseUrl)}/t/${encodeURIComponent(publicId)}`;
}

export function buildThreadOgImageUrl(publicBaseUrl: string, publicId: string): string {
  return `${buildThreadUrl(publicBaseUrl, publicId)}/opengraph-image`;
}

export function buildPublicAssetUrl(publicBaseUrl: string, assetPath: string): string {
  const normalizedPath = assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
  return `${resolvePublicBaseUrl(publicBaseUrl, publicBaseUrl)}${normalizedPath}`;
}

export function getSessionTitle(session: NormalizedSession): string {
  return session.root.title?.trim() || session.root.sessionId;
}

export function truncateOgTitle(title: string, maxLength = OG_TITLE_MAX_LENGTH): string {
  const normalized = title.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const suffix = "...";
  const sliceLength = Math.max(0, maxLength - suffix.length);
  const clipped = normalized.slice(0, sliceLength);
  const lastSpace = clipped.lastIndexOf(" ");
  const safeClip = lastSpace >= Math.floor(sliceLength * 0.65) ? clipped.slice(0, lastSpace) : clipped;

  return `${safeClip.replace(/[.,:;!?-]+$/, "").trimEnd()}${suffix}`;
}

export function getOgTitleFontSize(title: string): number {
  if (title.length > 76) {
    return 54;
  }

  if (title.length > 56) {
    return 60;
  }

  return 64;
}
