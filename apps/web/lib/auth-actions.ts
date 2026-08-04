"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, signSession, sessionCookieOptions, SESSION_COOKIE, hashPassword, verifyPassword } from "@itsolute/auth";
import { prisma } from "@itsolute/db";
import { getSession } from "./session";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const result = await login(email, password);
  if (!result) return { error: "Invalid email or password." };

  const token = await signSession(result.session);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());

  // Internal admins go to the admin area; owners/staff to their dashboard.
  redirect(result.session.role === "admin" ? "/admin" : "/");
}

export async function logoutAction() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// The signed-in user sets a new password. Works for both a voluntary change and
// the admin-forced flow (clearing mustChangePassword). Verifies the current
// password first, so a walked-up session can't silently rotate it.
export async function changePasswordAction(_prev: unknown, formData: FormData) {
  const session = await getSession();
  if (!session) redirect("/login");

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New password and confirmation don't match." };

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user?.passwordHash) return { error: "Account not found." };
  if (!(await verifyPassword(current, user.passwordHash))) return { error: "Current password is incorrect." };
  if (current === next) return { error: "Choose a password different from your current one." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next), mustChangePassword: false },
  });
  // Back to wherever they belong; the forced-change guard now lets them through.
  redirect(session.role === "admin" ? "/admin" : "/");
}
