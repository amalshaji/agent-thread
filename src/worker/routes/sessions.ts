import { renderSessionPage } from "../render";
import { findUploadByPublicId, loadNormalizedSession } from "../storage";
import type { WorkerApp } from "../types";

export function registerSessionRoutes(app: WorkerApp): void {
  app.get("/api/sessions/:publicId", async (c) => {
    const upload = await findUploadByPublicId(c.env.DB, c.req.param("publicId"));

    if (!upload) {
      return c.json({ error: "Session not found." }, 404);
    }

    const session = await loadNormalizedSession(c.env.SESSIONS_BUCKET, upload.normalized_key);

    if (!session) {
      return c.json({ error: "Normalized session missing from storage." }, 404);
    }

    return c.json(session);
  });

  app.get("/t/:publicId", async (c) => {
    const publicId = c.req.param("publicId");
    const upload = await findUploadByPublicId(c.env.DB, publicId);

    if (!upload) {
      return c.text("Session not found.", 404);
    }

    const session = await loadNormalizedSession(c.env.SESSIONS_BUCKET, upload.normalized_key);

    if (!session) {
      return c.text("Stored session payload is missing.", 404);
    }

    return c.html(await renderSessionPage(publicId, session));
  });
}
