const textEncoder = new TextEncoder();

export const MAX_TEXT_PREVIEW_BYTES = 1024;

function byteLength(value: string): number {
  return textEncoder.encode(value).byteLength;
}

export function boundedTextPreview(value: string | null): string | null {
  if (value === null || byteLength(value) <= MAX_TEXT_PREVIEW_BYTES) {
    return value;
  }

  const suffix = "...";
  const suffixBytes = byteLength(suffix);
  const maxContentBytes = Math.max(0, MAX_TEXT_PREVIEW_BYTES - suffixBytes);
  let preview = "";
  let previewBytes = 0;

  for (const char of value) {
    const charBytes = byteLength(char);
    if (previewBytes + charBytes > maxContentBytes) {
      break;
    }

    preview += char;
    previewBytes += charBytes;
  }

  return `${preview}${suffix}`;
}
