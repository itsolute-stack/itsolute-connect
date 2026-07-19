import { SignJWT, jwtVerify, type JWTPayload } from "jose";

// The session is a signed JWT (HS256) stored in an httpOnly cookie. It is
// framework-agnostic: the Next.js dashboard and the Express API both import
// these functions and share one AUTH_SECRET, so a session minted by one is
// verified by the other. The tenantId here ALWAYS comes from the authenticated
// user record — it is the value every tenant-scoped query is keyed on.

export const SESSION_COOKIE = "itsc_session";

export type Role = "owner" | "staff" | "admin";

export interface Session {
  userId: string;
  /** null = internal ITSolute admin (no tenant). */
  tenantId: string | null;
  email: string;
  role: Role;
}

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set to a 32+ character random string");
  }
  return new TextEncoder().encode(s);
}

function ttlSeconds(): number {
  const hours = Number(process.env.SESSION_TTL_HOURS ?? "720");
  return Math.max(1, hours) * 3600;
}

export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ ...session } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds())
    .sign(secret());
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") return null;
    if (payload.role !== "owner" && payload.role !== "staff" && payload.role !== "admin") return null;
    const tenantId = payload.tenantId;
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: typeof tenantId === "string" ? tenantId : null,
    };
  } catch {
    return null;
  }
}

/** Cookie attributes for the session. Framework code sets the actual cookie. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: ttlSeconds(),
  };
}
