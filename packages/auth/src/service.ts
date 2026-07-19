import { prisma, forTenant, type UserRole } from "@itsolute/db";
import { hashPassword, verifyPassword } from "./password.js";
import { signSession, type Session } from "./session.js";

// ---------------------------------------------------------------------------
// Login / signup
// ---------------------------------------------------------------------------

export interface LoginResult {
  session: Session;
  token: string;
}

/**
 * Authenticate by email + password. Returns a signed session token, or null on
 * bad credentials (do not leak which of email/password was wrong to callers).
 */
export async function login(email: string, password: string): Promise<LoginResult | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.passwordHash) return null;

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  const session: Session = {
    userId: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };
  return { session, token: await signSession(session) };
}

export interface CreateUserInput {
  email: string;
  password: string;
  role: UserRole;
  /** null for internal admin users. */
  tenantId: string | null;
  name?: string;
}

/** Create a user with a hashed password. Used by admin + Phase-1 provisioning. */
export async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      role: input.role,
      tenantId: input.tenantId,
      name: input.name ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Authorization guards — turn a Session into safe, tenant-scoped access
// ---------------------------------------------------------------------------

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 = 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * The single sanctioned way for customer-facing code to get a DB client.
 * Requires a tenant session and returns a client hard-scoped to that tenant.
 * The tenantId comes from the verified session — never from request input.
 */
export function tenantDbFor(session: Session | null) {
  if (!session) throw new AuthError("Not authenticated", 401);
  if (!session.tenantId) throw new AuthError("Tenant context required", 403);
  return forTenant(session.tenantId);
}

/** Require any authenticated session. */
export function requireSession(session: Session | null): Session {
  if (!session) throw new AuthError("Not authenticated", 401);
  return session;
}

/** Require an internal admin session (tenantId null, role admin). */
export function requireAdmin(session: Session | null): Session {
  const s = requireSession(session);
  if (s.role !== "admin") throw new AuthError("Admin access required", 403);
  return s;
}

/** Require one of the given roles within a tenant. */
export function requireRole(session: Session | null, ...roles: UserRole[]): Session {
  const s = requireSession(session);
  if (!roles.includes(s.role)) throw new AuthError("Insufficient role", 403);
  return s;
}
