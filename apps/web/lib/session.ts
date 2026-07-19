import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Session } from "@itsolute/auth";

// Read + verify the session from the httpOnly cookie (Node runtime).
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

// Guard for customer dashboard pages: require a tenant session, else redirect.
export async function requireTenantSession(): Promise<Session & { tenantId: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "admin" || !session.tenantId) redirect("/admin");
  return session as Session & { tenantId: string };
}

// Guard for the internal admin area: require an admin session (no tenant).
export async function requireAdminSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  return session;
}
