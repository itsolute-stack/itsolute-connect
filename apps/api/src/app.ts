import express, { type Request, type Response, type NextFunction } from "express";
import { plivoWebhooks } from "./webhooks/plivo.js";
import { adminRouter } from "./admin/router.js";

export function createApp() {
  const app = express();

  // Behind Railway's proxy — trust X-Forwarded-* so req.protocol/host and the
  // reconstructed webhook URL (for signature checks) are correct.
  app.set("trust proxy", true);
  app.disable("x-powered-by");

  // Plivo posts application/x-www-form-urlencoded.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  app.get("/health", (_req, res) => res.json({ ok: true, service: "itsolute-connect-api" }));

  app.use("/webhooks/plivo", plivoWebhooks);
  app.use("/admin", adminRouter);

  // 404
  app.use((_req, res) => res.status(404).json({ error: "not_found" }));

  // Error handler — never leak internals to callers.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: "internal_error" });
  });

  return app;
}
