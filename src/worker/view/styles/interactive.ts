export const interactiveStyles = `
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 7px 10px;
    background: transparent;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
  }

  .theme-toggle:hover {
    background: var(--surface-2);
    border-color: var(--accent);
    color: var(--ink);
  }

  .theme-toggle-icon {
    color: currentColor;
  }

  .attachment-image-button {
    display: block;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: zoom-in;
  }

  .attachment-image-button:focus-visible,
  .theme-toggle:focus-visible,
  .image-lightbox-close:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .image-lightbox[hidden] {
    display: none;
  }

  .image-lightbox {
    position: fixed;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: 24px;
    background: var(--lightbox-backdrop);
  }

  .image-lightbox-backdrop {
    position: absolute;
    inset: 0;
    border: 0;
    background: transparent;
    cursor: zoom-out;
  }

  .image-lightbox-dialog {
    position: relative;
    z-index: 1;
    display: grid;
    gap: 12px;
    width: min(96vw, 1120px);
    max-height: calc(100vh - 48px);
    justify-items: end;
  }

  .image-lightbox-close {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 12px;
    background: var(--panel-elevated);
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 12px;
    cursor: pointer;
  }

  .image-lightbox-frame {
    width: 100%;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--panel-elevated);
    box-shadow: 0 10px 28px var(--shadow-elevated);
  }

  .image-lightbox-content {
    display: block;
    max-width: 100%;
    max-height: calc(100vh - 180px);
    margin: 0 auto;
    border-radius: 16px;
  }

  .image-lightbox-caption {
    margin: 0;
    width: 100%;
    color: var(--ink);
    text-align: center;
    font-size: 13px;
  }

  body.lightbox-open {
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .theme-toggle {
      padding: 8px 10px;
      font-size: 11px;
    }

    .image-lightbox {
      padding: 12px;
    }

    .image-lightbox-dialog {
      width: 100%;
      max-height: calc(100vh - 24px);
    }

    .image-lightbox-frame {
      padding: 10px;
      border-radius: 8px;
    }

    .image-lightbox-content {
      max-height: calc(100vh - 132px);
    }
  }
`;
