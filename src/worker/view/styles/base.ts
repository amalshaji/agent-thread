export const baseStyles = `
  :root {
    /* Warm gray light theme — default */
    --bg: #fbfaf8;
    --bg-soft: #f4f2ee;
    --bg-sunk: #efece7;
    --surface: #ffffff;
    --border: #e8e4dc;
    --border-strong: #d9d4c9;
    --ink: #1a1916;
    --ink-soft: #3c3a34;
    --muted: #76716a;
    --faint: #a19c92;

    /* Accent — green */
    --accent: #4a9d60;
    --accent-soft: #e6f1e9;
    --accent-ink: #2d6b3e;

    /* Tool colors */
    --c-blue: #3c6fb0;       --c-blue-soft: #e5edf6;
    --c-purple: #6b4fad;     --c-purple-soft: #ece6f5;
    --c-amber: #a77320;      --c-amber-soft: #f4ecd9;
    --c-green: #3b7a48;      --c-green-soft: #e4eee6;
    --c-cyan: #2f7a88;       --c-cyan-soft: #dbecef;
    --c-gray: #5a554d;       --c-gray-soft: #ecebe6;
    --c-pink: #9c4a7a;       --c-pink-soft: #f2e3ec;
    --c-red: #b0443a;        --c-red-soft: #f5dedb;

    /* Fonts */
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "SF Pro Text", system-ui, sans-serif;
    --font-mono: "JetBrains Mono", "SF Mono", "Menlo", ui-monospace, monospace;
    --font-serif: "Georgia", "Times New Roman", serif;

    /* Aliases for legacy styles */
    --page: var(--bg);
    --panel: var(--surface);
    --panel-elevated: var(--surface);
    --line: var(--border);
    --line-strong: var(--border-strong);
    --surface-1: var(--bg-soft);
    --surface-2: var(--bg-sunk);
    --surface-3: rgba(26, 25, 22, 0.07);
    --user-ink: var(--ink);
    --tool-call-bg: var(--bg-soft);
    --tool-call-border: var(--border);
    --tool-call-ink: var(--ink-soft);
    --shadow-sm: 0 1px 2px rgba(26, 25, 22, 0.04), 0 0 0 1px rgba(26, 25, 22, 0.04);
    --shadow-md: 0 2px 8px rgba(26, 25, 22, 0.06), 0 0 0 1px rgba(26, 25, 22, 0.04);
    --shadow-elevated: rgba(26, 25, 22, 0.12);
    --lightbox-backdrop: rgba(0, 0, 0, 0.72);
    --transcript-width: 820px;
    --bubble-width: 52rem;

    color-scheme: light;
  }

  html[data-theme="dark"] {
    color-scheme: dark;
    --bg: #0f0e0c;
    --bg-soft: #1a1916;
    --bg-sunk: #222018;
    --surface: #141311;
    --border: rgba(255, 255, 255, 0.09);
    --border-strong: rgba(255, 255, 255, 0.15);
    --ink: #e8e4dc;
    --ink-soft: #c8c3b8;
    --muted: #7a7469;
    --faint: #55504a;
    --accent: #4a9d60;
    --accent-soft: rgba(74, 157, 96, 0.15);
    --accent-ink: #8bcca0;
    --surface-1: rgba(255, 255, 255, 0.04);
    --surface-2: rgba(255, 255, 255, 0.06);
    --surface-3: rgba(255, 255, 255, 0.09);
    --panel-elevated: #1e1c19;
    --lightbox-backdrop: rgba(0, 0, 0, 0.88);
    --shadow-elevated: rgba(0, 0, 0, 0.3);
    --user-ink: var(--ink);
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
  }

  body {
    min-height: 100vh;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--font-sans);
    font-size: 14px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  a { color: inherit; text-decoration: none; }
  a:hover { color: var(--accent); }
  button { font-family: inherit; }

  h1, h2 { margin: 0; font-weight: 600; }

  code, pre {
    font-family: var(--font-mono);
    font-size: 12.5px;
  }

  /* ————————————————————————————
     App switcher bar
  ———————————————————————————— */
  .app-switcher {
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 49px;
    padding: 0 20px;
    background: rgba(251, 250, 248, 0.9);
    backdrop-filter: saturate(180%) blur(12px);
    -webkit-backdrop-filter: saturate(180%) blur(12px);
    border-bottom: 1px solid var(--border);
  }

  html[data-theme="dark"] .app-switcher {
    background: rgba(15, 14, 12, 0.9);
  }

  .switcher-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: var(--ink-soft);
  }

  .switcher-mark {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--bg);
    flex-shrink: 0;
  }

  .switcher-brand b {
    color: var(--ink);
    font-weight: 600;
  }

  .switcher-dim { color: var(--muted); }

  .switcher-right {
    display: flex;
    gap: 10px;
    align-items: center;
    font-size: 12px;
    color: var(--muted);
  }

  .switcher-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
  }

  /* ————————————————————————————
     Theme toggle — sits in switcher-right
  ———————————————————————————— */
  .theme-toggle {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: pointer;
  }

  .theme-toggle:hover {
    background: var(--bg-soft);
    color: var(--ink);
  }

  .theme-toggle-icon { color: currentColor; }

  /* Share / copy link button */
  .btn-share {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink-soft);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-share:hover { background: var(--bg-soft); }
`;
