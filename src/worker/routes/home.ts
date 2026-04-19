import { html } from "hono/html";

import type { WorkerApp } from "../types";

export function registerHomeRoutes(app: WorkerApp): void {
  app.get("/", (c) =>
    c.html(
      html`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>agent-thread</title>
          </head>
          <body>
            <main>
              <h1>agent-thread</h1>
              <p>Upload Claude sessions with <code>bunx agent-thread</code>.</p>
            </main>
          </body>
        </html>`,
    ),
  );
}
