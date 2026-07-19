import type { Request, Response, NextFunction } from "express";
import { verifySession, SESSION_COOKIE, type Session } from "@itsolute/auth";

// Extract the session token from an Authorization: Bearer header or the session
// cookie (the dashboard forwards one of these on admin API calls).
function tokenFrom(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.headers.cookie;
  if (cookie) {
    for (const part of cookie.split(";")) {
      const [k, ...v] = part.trim().split("=");
      if (k === SESSION_COOKIE) return decodeURIComponent(v.join("="));
    }
  }
  return undefined;
}

declare global {
  // eslint-disable-next-line no-var
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

/** Require an internal admin session (role admin) on an API route. */
export async function requireApiAdmin(req: Request, res: Response, next: NextFunction) {
  const session = await verifySession(tokenFrom(req));
  if (!session) return res.status(401).json({ error: "unauthenticated" });
  if (session.role !== "admin") return res.status(403).json({ error: "admin_required" });
  req.session = session;
  next();
}
