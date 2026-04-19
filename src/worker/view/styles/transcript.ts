export const transcriptStyles = `
  /* ————————————————————————————
     Message row — avatar gutter + body
  ———————————————————————————— */
  .msg {
    display: grid;
    grid-template-columns: 44px 1fr;
    padding: 16px 0 6px;
    scroll-margin-top: 65px;
    min-width: 0;
  }

  /* ————————————————————————————
     Avatar gutter
  ———————————————————————————— */
  .msg-gutter {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .avatar {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--ink-soft);
  }

  .avatar-user {
    background: var(--accent-soft);
    color: var(--accent-ink);
    border-color: transparent;
  }

  .avatar-assistant {
    background: var(--ink);
    color: var(--bg);
    border-color: var(--ink);
  }

  .msg-rail {
    width: 2px;
    flex: 1;
    margin-top: 6px;
    background: linear-gradient(to bottom, var(--border) 0%, transparent 100%);
    border-radius: 1px;
  }

  /* ————————————————————————————
     Message body
  ———————————————————————————— */
  .msg-body {
    min-width: 0;
    padding-right: 16px;
    padding-top: 2px;
  }

  .msg-head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }

  .msg-role {
    color: var(--ink);
    font-weight: 600;
    font-size: 13px;
  }

  .msg-time {
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--faint);
    white-space: nowrap;
  }

  /* ————————————————————————————
     Blocks container
  ———————————————————————————— */
  .msg-blocks {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* User message gets a bordered bubble */
  .msg-user .msg-blocks {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: var(--shadow-sm);
  }

  /* User text content */
  .msg-user .block.text,
  .msg-user .block.markdown {
    font-size: 14px;
    line-height: 1.6;
  }

  /* Assistant text — normal flow */
  .msg-assistant .block.text,
  .msg-assistant .block.markdown {
    font-size: 14px;
    line-height: 1.68;
  }

  /* ————————————————————————————
     Thinking block
  ———————————————————————————— */
  details.block.thinking {
    border-left: 2px solid var(--border-strong);
    padding-left: 12px;
    color: var(--muted);
  }

  details.block.thinking > summary {
    list-style: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 0;
    font-size: 12px;
    color: var(--muted);
    font-style: normal;
    font-weight: 500;
  }

  details.block.thinking > summary::-webkit-details-marker { display: none; }
  details.block.thinking > summary::marker { content: ""; }

  details.block.thinking > summary:hover { color: var(--ink); }

  details.block.thinking[open] > summary {
    margin-bottom: 6px;
    color: var(--ink-soft);
  }

  details.block.thinking .thinking-chevron {
    display: inline-block;
    color: var(--muted);
    font-size: 10px;
  }

  details.block.thinking[open] .thinking-chevron {
    transform: rotate(90deg);
  }

  details.block.thinking .tool-payload {
    font-size: 12.5px;
    color: var(--ink-soft);
    font-style: italic;
    line-height: 1.6;
    background: transparent;
    border: none;
    padding: 0;
    max-height: 340px;
    overflow: auto;
  }

  /* ————————————————————————————
     Tool call disclosure — styled like toolcall card
  ———————————————————————————— */
  .tool-call-disclosure {
    display: block;
    min-width: 0;
    width: fit-content;
    max-width: min(44rem, 100%);
    border: 1px solid var(--border);
    border-radius: 7px;
    background: var(--surface);
    overflow: hidden;
  }

  .tool-call-disclosure[open] {
    width: 100%;
    border-color: var(--border-strong);
  }

  .tool-call-disclosure > summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 10px;
    background: var(--bg-soft);
    font-size: 12.5px;
    color: var(--ink-soft);
    line-height: 1;
    width: 100%;
  }

  .tool-call-disclosure > summary::-webkit-details-marker { display: none; }
  .tool-call-disclosure > summary::marker { content: ""; }

  .tool-call-disclosure > summary:hover { background: var(--bg-sunk); }

  .tool-call-disclosure[open] > summary {
    border-bottom: 1px solid var(--border);
  }

  .tool-pill-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .tool-pill-row-primary { display: inline-flex; gap: 5px; flex-wrap: nowrap; width: fit-content; }

  .tool-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
  }

  .tool-pill-call { color: var(--ink-soft); font-weight: 600; }
  .tool-pill-result { color: var(--muted); opacity: 0.7; }
  .tool-pill-raw { color: var(--muted); }

  /* Tool call panel inside disclosure */
  .tool-call-panel {
    display: grid;
    gap: 8px;
    padding: 12px;
    background: var(--surface);
  }

  /* Tool result disclosure */
  .tool-result-disclosure {
    display: block;
    min-width: 0;
    max-width: 100%;
    width: fit-content;
  }

  .tool-result-disclosure[open] { width: 100%; }

  .tool-result-disclosure > summary {
    list-style: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    padding: 0;
    width: fit-content;
  }

  .tool-result-disclosure > summary::-webkit-details-marker { display: none; }
  .tool-result-disclosure > summary::marker { content: ""; }

  .tool-result-disclosure[open] > summary { margin-bottom: 8px; }

  .tool-result-summary-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
  }

  .tool-result-arrow {
    display: inline-block;
    flex: 0 0 auto;
    color: var(--accent);
    transition: transform 140ms ease;
    transform-origin: 50% 55%;
  }

  .tool-result-disclosure[open] .tool-result-arrow { transform: rotate(90deg); }

  .tool-result-summary-label { color: var(--ink); }
  .tool-result-summary-copy { display: inline-flex; align-items: center; gap: 4px; }
  .tool-result-summary-count { color: var(--muted); }

  .tool-result-panel {
    display: grid;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
  }

  .tool-result-shell { gap: 10px; }
  .tool-result-entry { min-width: 0; }
  .tool-result-entry + .tool-result-entry {
    padding-top: 10px;
    border-top: 1px solid var(--border);
  }

  /* ————————————————————————————
     Activity / system rows (no avatar)
  ———————————————————————————— */
  .message-row.lane-activity,
  .message-row.lane-system {
    padding: 3px 0;
    opacity: 0.65;
    transition: opacity 160ms ease;
  }

  .message-row.lane-activity:hover,
  .message-row.lane-system:hover { opacity: 1; }

  .activity-card {
    width: 100%;
    padding: 2px 0;
  }

  .activity-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 3px;
    font-size: 10.5px;
    color: var(--muted);
    font-family: var(--font-mono);
  }

  .activity-badge {
    color: var(--faint);
    font-weight: 600;
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .activity-body { min-width: 0; }

  /* Inline tool (file preview) */
  .message-row.event-tool-inline .message-stack,
  .message-row.event-tool-inline .message-bubble {
    width: 100%;
    max-width: min(50rem, 100%);
  }

  /* File preview */
  .tool-file-preview {
    display: grid;
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface);
  }

  .tool-file-header {
    display: flex;
    align-items: center;
    min-height: 36px;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-soft);
  }

  .tool-file-name {
    color: var(--ink);
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tool-file-expand {
    border-top: 1px solid var(--border);
  }

  .tool-file-expand summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    background: var(--bg-soft);
    color: var(--muted);
    transition: background 120ms ease, color 120ms ease;
  }

  .tool-file-expand summary::-webkit-details-marker { display: none; }
  .tool-file-expand summary::marker { content: ""; }
  .tool-file-expand summary:hover { background: var(--bg-sunk); color: var(--ink); }

  .tool-file-expand-label {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1;
  }

  .tool-file-expand[open] summary { border-bottom: 1px solid var(--border); }

  .tool-file-more {
    padding: 6px 14px;
    border-top: 1px solid var(--border);
    background: var(--bg-soft);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
  }

  /* ————————————————————————————
     Thread header (multi-thread view)
  ———————————————————————————— */
  .thread-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin: 0 0 16px;
  }

  .thread-badge {
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .thread-header h2 {
    font-family: var(--font-mono);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .thread-extras {
    margin-top: 16px;
    display: grid;
    gap: 10px;
    justify-items: start;
  }

  .thread-extras summary {
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 10px;
    color: var(--muted);
    list-style: none;
    padding: 0;
  }

  .thread-extras summary::-webkit-details-marker { display: none; }

  .thread-extras-feed {
    width: 100%;
    margin-top: 4px;
  }

  @media (max-width: 640px) {
    .msg { padding: 12px 0 4px; }

    .msg-body { padding-right: 8px; }

    .tool-call-disclosure {
      max-width: 100%;
    }
  }
`;
