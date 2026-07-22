import { Router, type Request, type Response } from "express";
import { requireApiAdmin } from "../lib/api-auth.js";
import { asyncHandler } from "../lib/async-handler.js";
import { configureOwnedNumber, rentNumber } from "../services/plivo-provision.js";

// Admin API (spec §10). Currently the Plivo provisioning endpoint — the part
// that must call the Plivo API. Tenant CRUD / WABA linking are DB-only and live
// as dashboard server actions. Every route requires an admin session.
export const adminRouter = Router();

adminRouter.use(requireApiAdmin);

// POST /admin/tenants/:id/plivo-number
//   { mode: "assign", e164 }                 → wire an owned number to our webhooks
//   { mode: "rent", country?, pattern?, confirm } → BUY a new number (paid; needs confirm)
adminRouter.post(
  "/tenants/:id/plivo-number",
  asyncHandler(async (req: Request, res: Response) => {
    const tenantId = req.params.id;
    const body = req.body ?? {};

    try {
      if (body.mode === "rent") {
        const result = await rentNumber(tenantId, {
          country: body.country,
          pattern: body.pattern,
          confirm: body.confirm === true,
        });
        return res.json({ ok: true, ...result });
      }

      // default: assign an existing owned number
      if (!body.e164) return res.status(400).json({ ok: false, error: "A phone number is required." });
      const result = await configureOwnedNumber(tenantId, String(body.e164));
      return res.json({ ok: true, ...result });
    } catch (e) {
      // Admin-only endpoint — surface the real Plivo/config error to the UI.
      return res.status(502).json({ ok: false, error: (e as Error).message });
    }
  }),
);
