import { getRenderableImage } from "@/src/worker/view/attachments";

export function ImageAttachment({ value, alt }: { value: unknown; alt: string }) {
  const image = getRenderableImage(value);
  if (!image) return null;

  return (
    <figure className="block attachment-card attachment-image">
      <button
        className="attachment-image-button"
        type="button"
        data-lightbox-src={image.src}
        data-lightbox-alt={alt}
        aria-label="Open image in fullscreen"
      >
        <img className="attachment-image-content" src={image.src} alt={alt} loading="lazy" />
      </button>
      <figcaption className="attachment-meta">{image.mediaType}</figcaption>
    </figure>
  );
}
