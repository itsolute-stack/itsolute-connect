"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/auth-actions";

const input =
  "w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-600)]";
const label = "block text-xs font-medium text-[var(--color-ink-soft)] mb-1";

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(
    changePasswordAction,
    null as { error?: string } | null,
  );
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={label}>{forced ? "Temporary password" : "Current password"}</label>
        <input name="current" type="password" autoComplete="current-password" className={input} />
      </div>
      <div>
        <label className={label}>New password (min 8)</label>
        <input name="next" type="password" autoComplete="new-password" className={input} />
      </div>
      <div>
        <label className={label}>Confirm new password</label>
        <input name="confirm" type="password" autoComplete="new-password" className={input} />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Saving…" : "Set new password"}
        </button>
        {state?.error && <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>}
      </div>
    </form>
  );
}
