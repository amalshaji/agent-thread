import type { WorkerApp } from "../types";

const SPARKLE_SVG = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v5M8 9v5M2 8h5M9 8h5"/></svg>`;

const HOME_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>agent-thread — share Claude sessions</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <script>
      (() => {
        try {
          const stored = localStorage.getItem("agent-thread-theme");
          const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
          document.documentElement.dataset.theme = (stored === "light" || stored === "dark") ? stored : system;
        } catch { document.documentElement.dataset.theme = "light"; }
      })();
    </script>
    <style>
      :root {
        --bg: #fbfaf8; --bg-soft: #f4f2ee; --border: #e8e4dc;
        --ink: #1a1916; --ink-soft: #3c3a34; --muted: #76716a; --faint: #a19c92;
        --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI Variable", system-ui, sans-serif;
        --font-mono: "JetBrains Mono", "SF Mono", ui-monospace, monospace;
      }
      html[data-theme="dark"] {
        color-scheme: dark;
        --bg: #0f0e0c; --bg-soft: #1a1916; --border: rgba(255,255,255,0.09);
        --ink: #e8e4dc; --ink-soft: #c8c3b8; --muted: #7a7469; --faint: #55504a;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100vh; background: var(--bg); color: var(--ink);
        font-family: var(--font-sans); font-size: 14px; line-height: 1.55;
        -webkit-font-smoothing: antialiased; display: flex; flex-direction: column;
      }
      header {
        display: flex; align-items: center; justify-content: space-between;
        height: 49px; padding: 0 20px; border-bottom: 1px solid var(--border);
      }
      .brand { display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--ink-soft); }
      .brand-mark {
        width: 20px; height: 20px; border-radius: 5px; background: var(--ink);
        display: flex; align-items: center; justify-content: center; color: var(--bg); flex-shrink: 0;
      }
      .brand b { color: var(--ink); font-weight: 600; }
      .theme-toggle {
        display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
        border: 1px solid var(--border); border-radius: 6px; background: transparent;
        color: var(--muted); font-family: var(--font-mono); font-size: 11px; cursor: pointer;
      }
      .theme-toggle:hover { background: var(--bg-soft); color: var(--ink); }
      main {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 48px 20px; text-align: center;
      }
      h1 { margin: 0 0 10px; font-size: 22px; font-weight: 600; letter-spacing: -0.3px; }
      .tagline { margin: 0 0 40px; color: var(--muted); font-size: 14px; max-width: 360px; }
      .cmds { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 340px; }
      .cmd-row {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 10px 14px; background: var(--bg-soft); border: 1px solid var(--border);
        border-radius: 8px; font-family: var(--font-mono); font-size: 13px;
      }
      .cmd-row code { color: var(--ink-soft); font-family: inherit; }
      .copy-btn {
        background: none; border: none; cursor: pointer; color: var(--faint);
        font-size: 12px; padding: 0; font-family: var(--font-mono); flex-shrink: 0;
      }
      .copy-btn:hover { color: var(--ink); }
    </style>
  </head>
  <body>
    <header>
      <div class="brand">
        <div class="brand-mark">${SPARKLE_SVG}</div>
        <b>agent thread</b>
      </div>
      <button class="theme-toggle" type="button" aria-label="Switch theme" onclick="toggleTheme(this)">
        <span aria-hidden="true">◐</span>
        <span id="theme-label">Theme</span>
      </button>
    </header>

    <main>
      <h1>Share Claude sessions</h1>
      <p class="tagline">Upload any Claude Code session as a public link in one command.</p>
      <div class="cmds">
        <div class="cmd-row">
          <code>bunx agent-thread@latest</code>
          <button class="copy-btn" onclick="copyCmd(this, 'bunx agent-thread@latest')">copy</button>
        </div>
        <div class="cmd-row">
          <code>npx agent-thread@latest</code>
          <button class="copy-btn" onclick="copyCmd(this, 'npx agent-thread@latest')">copy</button>
        </div>
        <div class="cmd-row">
          <code>pnpx agent-thread@latest</code>
          <button class="copy-btn" onclick="copyCmd(this, 'pnpx agent-thread@latest')">copy</button>
        </div>
      </div>
    </main>

    <script>
      function toggleTheme(btn) {
        const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("agent-thread-theme", next);
        document.getElementById("theme-label").textContent = next === "dark" ? "Light" : "Dark";
      }
      function copyCmd(btn, text) {
        navigator.clipboard?.writeText(text);
        const orig = btn.textContent;
        btn.textContent = "copied!";
        setTimeout(() => btn.textContent = orig, 1500);
      }
    </script>
  </body>
</html>`;

export function registerHomeRoutes(app: WorkerApp): void {
  app.get("/", (c) => c.html(HOME_HTML));
}
