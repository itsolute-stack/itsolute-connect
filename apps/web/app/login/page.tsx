"use client";

import { useActionState } from "react";
import { loginAction } from "@/lib/auth-actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);

  return (
    <main className="min-h-screen grid place-items-center px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 font-semibold text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand-600)] text-white">C</span>
            ITSolute Connect
          </div>
          <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Sign in to your dashboard</p>
        </div>

        <form action={action} className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-600)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
              placeholder="owner@yourbusiness.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Password</label>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-brand-600)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
              placeholder="••••••••"
            />
          </div>
          {state?.error && <p className="text-sm text-[var(--color-danger-600)]">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full py-2.5 text-sm disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
