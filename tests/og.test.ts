import { describe, expect, test } from "bun:test";

import {
  buildPublicAssetUrl,
  buildThreadOgImageUrl,
  buildThreadUrl,
  getDisplayServerHost,
  getOgTitleFontSize,
  OG_IMAGE_CACHE_CONTROL,
  resolvePublicBaseUrl,
  truncateOgTitle,
} from "../lib/og";
import { getSourceInfo } from "../lib/thread-source";

describe("OG image helpers", () => {
  test("builds thread and OG image URLs from the public base URL", () => {
    expect(buildThreadUrl("https://agent-thread.com/", "abc123")).toBe("https://agent-thread.com/t/abc123");
    expect(buildThreadOgImageUrl("https://agent-thread.com/", "abc123")).toBe(
      "https://agent-thread.com/t/abc123/opengraph-image",
    );
    expect(buildPublicAssetUrl("https://agent-thread.com/", "/codex-color.svg")).toBe(
      "https://agent-thread.com/codex-color.svg",
    );
  });

  test("normalizes the env server URL for metadata and display", () => {
    expect(resolvePublicBaseUrl("https://agent-thread.com/path", "https://fallback.example")).toBe(
      "https://agent-thread.com",
    );
    expect(resolvePublicBaseUrl("agent-thread.com", "https://fallback.example")).toBe("https://agent-thread.com");
    expect(resolvePublicBaseUrl(undefined, "https://agent-thread.com")).toBe("https://agent-thread.com");
    expect(getDisplayServerHost("https://agent-thread.com")).toBe("agent-thread.com");
  });

  test("truncates long titles to fit the OG image", () => {
    const title = "Implement dynamic Open Graph images for every shared agent thread URL with source branding".repeat(2);
    const truncated = truncateOgTitle(title, 60);

    expect(truncated.length).toBeLessThanOrEqual(60);
    expect(truncated).toEndWith("...");
    expect(truncated).not.toContain("\n");
  });

  test("keeps short titles unchanged and lowers font size for longer titles", () => {
    expect(truncateOgTitle("Short title")).toBe("Short title");
    expect(getOgTitleFontSize("Short title")).toBe(64);
    expect(getOgTitleFontSize("a".repeat(70))).toBe(60);
    expect(getOgTitleFontSize("a".repeat(82))).toBe(54);
  });

  test("selects the source app logo", () => {
    expect(getSourceInfo({ source: "codex" }).logoSrc).toBe("/codex-color.svg");
    expect(getSourceInfo({ source: "claude-code" }).logoSrc).toBe("/claudecode-color.svg");
  });

  test("sets cache policy for generated OG images", () => {
    expect(OG_IMAGE_CACHE_CONTROL).toContain("public");
    expect(OG_IMAGE_CACHE_CONTROL).toContain("s-maxage=604800");
    expect(OG_IMAGE_CACHE_CONTROL).toContain("stale-while-revalidate=2592000");
  });
});
