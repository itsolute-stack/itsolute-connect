import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession, type Session } from "@itsolute/auth";
import { prisma } from "@itsolute/db";

// Read + verify the session from the httpOnly cookie (Node runtime).
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

// If an admin flagged this user for a forced password change, send them to the
// change-password screen and keep them there until they pick a new one. Checked
// against the DB so it takes effect on the next request, not just next login.
// The /change-password route must NOT call the guards (it uses getSession
// directly), or this would loop.
async function enforcePasswordChange(session: Session): Promise<void> {
  let mustChange = false;
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { mustChangePassword: true },
    });
    mustChange = user?.mustChangePassword ?? false;
  } catch {
    // Fail open: if the column isn't there yet (migration 6 not applied), don't
    // take the whole dashboard down — the forced-change flow just stays dormant
    // until the migration lands. `redirect` throws, so it must be outside try.
    mustChange = false;
  }
  if (mustChange) redirect("/change-password");
}

// Guard for customer dashboard pages: require a tenant session, else redirect.
export async function requireTenantSession(): Promise<Session & { tenantId: string }> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "admin" || !session.tenantId) redirect("/admin");
  await enforcePasswordChange(session);
  return session as Session & { tenantId: string };
}

// Guard for the internal admin area: require an admin session (no tenant).
export async function requireAdminSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/");
  await enforcePasswordChange(session);
  return session;
}
