export function renderImageLightbox(): string {
  return `
    <div class="image-lightbox" data-image-lightbox hidden>
      <button class="image-lightbox-backdrop" type="button" data-lightbox-dismiss aria-label="Dismiss image viewer"></button>
      <div class="image-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Expanded image">
        <button class="image-lightbox-close" type="button" data-lightbox-dismiss aria-label="Dismiss image viewer">Close</button>
        <div class="image-lightbox-frame">
          <img class="image-lightbox-content" data-lightbox-image alt="" />
        </div>
        <p class="image-lightbox-caption" data-lightbox-caption hidden></p>
      </div>
    </div>
  `;
}
