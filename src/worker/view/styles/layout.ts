export const layoutStyles = `
  /* ————————————————————————————
     Chat shell — two-column layout
  ———————————————————————————— */
  .chat-shell {
    display: grid;
    grid-template-columns: 256px minmax(0, 1fr);
    max-width: 1360px;
    margin: 0 auto;
    min-height: calc(100vh - 49px);
    align-items: start;
  }

  /* ————————————————————————————
     Left sidebar — outline + footer
  ———————————————————————————— */
  .chat-side {
    border-right: 1px solid var(--border);
    padding: 24px 16px 20px 20px;
    position: sticky;
    top: 49px;
    height: calc(100vh - 49px);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    scrollbar-width: none;
  }

  .chat-side::-webkit-scrollbar { display: none; }

  /* Outline nav */
  .chat-outline { flex: 1; min-height: 0; }

  .outline-head {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    color: var(--faint);
    margin-bottom: 10px;
  }

  .outline-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .outline-item a {
    display: grid;
    grid-template-columns: 22px 44px 1fr;
    gap: 6px;
    align-items: baseline;
    padding: 5px 8px;
    border-radius: 5px;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.35;
    transition: background 100ms;
  }

  .outline-item a:hover {
    background: var(--bg-soft);
    color: var(--ink);
  }

  .outline-idx {
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--faint);
    text-align: right;
  }

  .outline-role {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    white-space: nowrap;
  }

  .outline-user .outline-role { color: var(--accent-ink); }
  .outline-assistant .outline-role { color: var(--ink-soft); }

  .outline-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-soft);
    font-size: 11.5px;
  }

  /* Sidebar footer — mini info cards */
  .chat-side-footer {
    margin-top: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
  }

  .mini-card {
    padding: 8px 10px;
    background: var(--bg-soft);
    border-radius: 6px;
    border: 1px solid var(--border);
  }

  .mini-card-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--faint);
    font-weight: 700;
    margin-bottom: 2px;
  }

  .mini-card-value {
    font-size: 12px;
    color: var(--ink-soft);
    word-break: break-all;
  }

  .mini-card-value.mono {
    font-family: var(--font-mono);
    font-size: 11px;
  }

  /* ————————————————————————————
     Main content area
  ———————————————————————————— */
  .chat-main {
    padding: 28px 40px 100px;
    min-width: 0;
  }

  /* Chat header */
  .chat-header {
    padding-bottom: 20px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 28px;
  }

  .chat-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .chat-crumbs {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
  }

  .crumb { font-family: var(--font-mono); font-size: 11.5px; }
  .crumb-sep { color: var(--faint); }
  .crumb-active { color: var(--ink); }

  .chat-header-actions { display: flex; gap: 8px; }

  .chat-title {
    font-size: 26px;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
    color: var(--ink);
    line-height: 1.2;
  }

  .chat-meta {
    display: flex;
    align-items: center;
    gap: 0;
    font-size: 12.5px;
    color: var(--muted);
    flex-wrap: wrap;
  }

  .chat-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .chat-meta-sep {
    display: inline-block;
    width: 1px;
    height: 10px;
    background: var(--border-strong);
    margin: 0 10px;
    flex-shrink: 0;
  }

  /* Chat stream */
  .chat-stream {
    display: flex;
    flex-direction: column;
    max-width: var(--transcript-width);
  }

  /* End of conversation marker */
  .chat-end {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 32px;
    padding: 12px 0;
    color: var(--faint);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .chat-end-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .chat-shell {
      grid-template-columns: 1fr;
    }

    .chat-side {
      display: none;
    }

    .chat-main {
      padding: 20px 16px 80px;
    }

    .chat-title {
      font-size: 22px;
    }
  }

  @media (max-width: 640px) {
    .chat-main {
      padding: 16px 14px 60px;
    }

    .chat-title {
      font-size: 20px;
    }
  }
`;
