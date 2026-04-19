import { Hono } from "hono";

import { registerHomeRoutes } from "./routes/home";
import { registerSessionRoutes } from "./routes/sessions";
import { registerUploadRoutes } from "./routes/uploads";
import type { Bindings } from "./types";

const app = new Hono<{ Bindings: Bindings }>();

registerHomeRoutes(app);
registerUploadRoutes(app);
registerSessionRoutes(app);

export default app;
