export const contentStyles = `
  .block {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }

  .block + .block {
    margin-top: 10px;
  }

  .block.text,
  .block.markdown {
    font-family: inherit;
    font-size: 15px;
    color: var(--ink);
  }

  .block.text {
    line-height: 1.72;
  }

  .block.markdown {
    line-height: 1.68;
    white-space: normal;
    overflow-wrap: break-word;
  }

  .bubble-user .block.text,
  .bubble-user .block.markdown {
    font-size: 14px;
    line-height: 1.2;
    white-space: normal;
    word-break: normal;
    overflow-wrap: break-word;
  }

  .bubble-user .block.markdown p {
    line-height: inherit;
  }

  .bubble-assistant > .block.text:first-child,
  .bubble-assistant > .block.markdown:first-child {
    margin-top: 0;
  }

  .block.markdown > :first-child {
    margin-top: 0;
  }

  .block.markdown > :last-child {
    margin-bottom: 0;
  }

  .block.markdown p,
  .block.markdown ul,
  .block.markdown ol,
  .block.markdown blockquote,
  .block.markdown pre,
  .block.markdown table,
  .block.markdown hr {
    margin: 0 0 0.9em;
  }

  .block.markdown h1,
  .block.markdown h2,
  .block.markdown h3,
  .block.markdown h4 {
    margin: 1.35em 0 0.62em;
    line-height: 1.2;
    letter-spacing: -0.02em;
  }

  .block.markdown h1 {
    font-size: 1.5em;
  }

  .block.markdown h2 {
    font-size: 1.3em;
  }

  .block.markdown h3,
  .block.markdown h4 {
    font-size: 1.1em;
  }

  .block.markdown ul,
  .block.markdown ol {
    padding-left: 1.35em;
  }

  .block.markdown li + li {
    margin-top: 0.2em;
  }

  .block.markdown li > p {
    margin-bottom: 0;
  }

  .block.markdown a {
    color: var(--accent);
    text-decoration: none;
  }

  .block.markdown a:hover {
    text-decoration: underline;
  }

  .block.markdown strong {
    font-weight: 650;
  }

  .block.markdown blockquote {
    padding-left: 14px;
    border-left: 2px solid var(--line-strong);
    color: var(--muted);
  }

  .block.markdown hr {
    border: 0;
    border-top: 1px solid var(--line);
  }

  .block.markdown code {
    font-family: var(--font-mono);
    font-size: 0.92em;
    padding: 0.15em 0.42em;
    border-radius: 4px;
    background: var(--surface-2);
    color: var(--ink);
  }

  .block.markdown pre {
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-1);
    overflow: auto;
    max-width: 100%;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .block.markdown pre code {
    display: block;
    padding: 0;
    border-radius: 0;
    background: transparent;
    color: inherit;
    white-space: pre;
  }

  .block.markdown table {
    width: 100%;
    border-collapse: collapse;
    display: block;
    overflow: auto;
  }

  .block.markdown th,
  .block.markdown td {
    padding: 8px 10px;
    border: 1px solid var(--line);
    text-align: left;
  }

  .block.markdown th {
    color: var(--ink);
    background: var(--surface-1);
  }

  .tool-card {
    display: grid;
    gap: 10px;
  }

  .tool-result-disclosure {
    display: block;
    min-width: 0;
    max-width: 100%;
    width: fit-content;
  }

  .tool-result-disclosure[open] {
    width: 100%;
  }

  .tool-result-disclosure summary {
    list-style: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    margin: 0;
    padding: 0;
    width: fit-content;
  }

  .tool-result-disclosure summary::-webkit-details-marker {
    display: none;
  }

  .tool-result-disclosure summary::marker {
    content: "";
  }

  .tool-result-summary-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0;
    border: 0;
    background: transparent;
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

  .tool-result-disclosure[open] .tool-result-arrow {
    transform: rotate(90deg);
  }

  .tool-result-summary-label {
    color: var(--ink);
  }

  .tool-result-summary-copy {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .tool-result-summary-count {
    color: var(--muted);
  }

  .tool-result-disclosure[open] > summary {
    margin-bottom: 4px;
  }

  .tool-result-panel {
    display: grid;
    gap: 6px;
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-1);
  }

  .tool-result-shell {
    gap: 10px;
  }

  .tool-result-entry {
    min-width: 0;
  }

  .tool-result-entry + .tool-result-entry {
    padding-top: 6px;
    border-top: 1px solid var(--line);
  }

  .tool-result-panel .block.markdown,
  .tool-result-panel .block.text {
    color: var(--ink);
  }

  .attachment-card {
    display: grid;
    gap: 8px;
    width: fit-content;
    max-width: min(28rem, 100%);
    margin: 0;
  }

  .attachment-image-content {
    display: block;
    max-width: 100%;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-1);
  }

  .attachment-meta {
    margin: 0;
    font-size: 12px;
    line-height: 1.4;
    color: var(--muted);
  }

  .tool-call-disclosure {
    display: block;
    min-width: 0;
    max-width: 100%;
    width: fit-content;
  }

  .tool-call-disclosure[open] {
    display: block;
    width: 100%;
  }

  .tool-call-disclosure summary {
    list-style: none;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    margin: 0;
    padding: 0;
    line-height: 1;
    width: fit-content;
    text-align: left;
  }

  .tool-call-disclosure summary::-webkit-details-marker {
    display: none;
  }

  .tool-call-disclosure summary::marker {
    content: "";
  }

  .tool-call-disclosure > summary .tool-pill-row {
    width: fit-content;
  }

  .tool-call-disclosure[open] > summary {
    margin-bottom: 6px;
  }

  .tool-call-panel {
    display: grid;
    gap: 8px;
  }

  .tool-inline-call {
    display: grid;
    gap: 10px;
    width: 100%;
  }

  .tool-file-preview {
    display: grid;
    gap: 0;
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface-1);
  }

  .tool-file-header {
    display: flex;
    align-items: center;
    min-height: 38px;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
    background: var(--surface-2);
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
    border-top: 1px solid var(--line);
  }

  .tool-file-expand summary {
    list-style: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    background: var(--surface-2);
    color: var(--muted);
    transition: background 120ms ease, color 120ms ease;
  }

  .tool-file-expand summary::-webkit-details-marker {
    display: none;
  }

  .tool-file-expand summary::marker {
    content: "";
  }

  .tool-file-expand summary:hover {
    background: var(--surface-3);
    color: var(--ink);
  }

  .tool-file-expand-label {
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1;
  }

  .tool-file-expand[open] summary {
    border-bottom: 1px solid var(--line);
  }

  .tool-file-more {
    padding: 7px 14px;
    border-top: 1px solid var(--line);
    background: var(--surface-1);
    font-family: var(--font-mono);
    font-size: 11px;
    color: var(--muted);
  }

  .tool-pill-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    align-content: center;
  }

  .tool-pill-row-primary {
    display: inline-flex;
    gap: 6px;
    flex-wrap: nowrap;
    width: fit-content;
  }

  .tool-pill {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    line-height: 1.4;
    white-space: nowrap;
  }

  .tool-pill-call {
    color: var(--muted);
  }

  .tool-call-disclosure > summary .tool-pill {
    font-size: 11px;
  }

  .tool-inline-call .tool-pill {
    font-size: 11px;
  }

  .tool-pill-result {
    color: var(--muted);
    opacity: 0.7;
  }

  .tool-pill-raw {
    color: var(--muted);
  }

  details.block {
    min-width: 0;
  }

  details.block:not(.tool-call-disclosure):not(.tool-result-disclosure) summary {
    cursor: pointer;
    color: var(--accent);
    margin-bottom: 8px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .bubble-user details.block:not(.tool-call-disclosure):not(.tool-result-disclosure) summary {
    color: var(--user-ink);
  }

  pre {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.56;
    max-width: 100%;
  }

  .tool-shell {
    display: grid;
    gap: 14px;
    min-width: 0;
  }

  .tool-payload {
    margin: 0;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-1);
    overflow: auto;
    max-height: 420px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    word-break: break-word;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .tool-file-preview .tool-payload {
    margin: 0;
    max-height: 420px;
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .bubble-assistant .tool-payload,
  .bubble-assistant .diff-view {
    background: var(--surface-1);
  }

  .tool-result-panel .tool-payload,
  .tool-result-panel .diff-view {
    background: var(--surface-1);
  }

  .bubble-user .tool-payload {
    background: var(--surface-2);
    border-color: var(--line);
    color: inherit;
  }

  .bubble-user .tool-pill {
    border-color: var(--line-strong);
    color: inherit;
    background: var(--surface-3);
  }

  .diff-view {
    min-width: 0;
    max-width: 100%;
    overflow: auto;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface-1);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .diff-view pre,
  .diff-view code {
    white-space: pre-wrap;
  }

  .empty-note {
    margin: 0;
    color: var(--muted);
    font-size: 13px;
  }

  img,
  svg {
    max-width: 100%;
    height: auto;
  }

  /* Fenced code blocks — plain dark pre, no header strip */
  .block.markdown pre.code-block-plain {
    margin: 0 0 0.9em;
    padding: 12px 14px;
    border-radius: 6px;
    background: var(--surface-1);
    overflow: auto;
    max-width: 100%;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .block.markdown pre.code-block-plain:last-child {
    margin-bottom: 0;
  }

  .block.markdown pre.code-block-plain code {
    display: block;
    padding: 0;
    background: transparent;
    color: inherit;
    white-space: pre;
    font-size: inherit;
  }

  .code-collapser {
    position: relative;
  }

  .code-expand-btn {
    position: absolute;
    bottom: 8px;
    right: 10px;
    z-index: 2;
    padding: 3px 9px;
    border: 1px solid var(--line-strong);
    border-radius: 6px;
    background: var(--panel-elevated);
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 10px;
    line-height: 1.4;
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
  }

  .code-expand-btn:hover {
    color: var(--ink);
    border-color: var(--accent);
    background: var(--surface-3);
  }

  .code-expand-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* ensure the block-wrapper is a positioning context when JS collapses it */
  .code-block-wrapper {
    position: relative;
  }

  @media (max-width: 880px) {
    .thread-rail {
      position: static;
    }
  }

  @media (max-width: 640px) {
    pre {
      font-size: 11px;
      line-height: 1.5;
    }

    .block.text,
    .block.markdown {
      font-size: 14px;
    }

    .tool-pill {
      font-size: 10px;
      padding: 4px 7px;
    }

    .tool-call-disclosure > summary .tool-pill {
      font-size: 10px;
      padding-block: 4px;
      padding-inline: 6px;
    }

    .tool-result-summary-chip {
      gap: 4px;
      min-height: 26px;
      padding: 4px 8px;
      font-size: 11px;
    }

    .tool-result-summary-copy {
      gap: 3px;
    }

    .tool-result-panel {
      padding: 12px;
      border-radius: 8px;
    }

    .tool-call-disclosure > summary .tool-pill-row {
      max-width: 100%;
    }

    .tool-pill-row-primary {
      flex-wrap: wrap;
    }

    .tool-payload,
    .diff-view {
      max-height: min(320px, 46vh);
      border-radius: 8px;
    }

    .attachment-card {
      max-width: 100%;
    }

    .tool-result-entry + .tool-result-entry {
      padding-top: 8px;
    }
  }
`;
