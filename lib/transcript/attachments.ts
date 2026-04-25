import { escapeHtml } from "./utils";

type RecordValue = Record<string, unknown>;

export type RenderableImage = {
  mediaType: string;
  src: string;
};

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : null;
}

export function getRenderableImage(value: unknown): RenderableImage | null {
  const record = asRecord(value);

  if (!record || record.type !== "image") {
    return null;
  }

  const source = asRecord(record.source);
  if (!source) {
    return null;
  }

  if (source.type === "base64" && typeof source.media_type === "string" && typeof source.data === "string") {
    return {
      mediaType: source.media_type,
      src: `data:${source.media_type};base64,${source.data}`,
    };
  }

  if (typeof source.url === "string" && typeof source.media_type === "string") {
    return {
      mediaType: source.media_type,
      src: source.url,
    };
  }

  return null;
}

export function renderImageAttachment(value: unknown, alt: string): string | null {
  const image = getRenderableImage(value);

  if (!image) {
    return null;
  }

  return `
    <figure class="block attachment-card attachment-image">
      <button
        class="attachment-image-button"
        type="button"
        data-lightbox-src="${escapeHtml(image.src)}"
        data-lightbox-alt="${escapeHtml(alt)}"
        aria-label="Open image in fullscreen"
      >
        <img class="attachment-image-content" src="${escapeHtml(image.src)}" alt="${escapeHtml(alt)}" loading="lazy" />
      </button>
      <figcaption class="attachment-meta">${escapeHtml(image.mediaType)}</figcaption>
    </figure>
  `;
}
