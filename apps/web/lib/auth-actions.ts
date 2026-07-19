"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { login, signSession, sessionCookieOptions, SESSION_COOKIE } from "@itsolute/auth";

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
