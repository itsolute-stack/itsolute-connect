"use client";

import { useActionState, useState } from "react";
import { resetUserPasswordAction, type ResetPasswordResult } from "@/lib/admin-actions";

export function UserRowActions({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ResetPasswordResult | null, FormData>(
    resetUserPasswordAction,
    null,
  );

  if (!open && !state?.ok) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium hover:bg-black/[0.03]"
      >
        Reset password
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="password"
          placeholder="leave blank = generate"
          className="w-44 rounded-lg border border-[var(--color-line)] px-2 py-1 text-xs outline-none focus:border-[var(--color-brand-600)]"
        />
        <label className="flex items-center gap-1 text-xs text-[var(--color-ink-soft)]">
          <input name="forceChange" type="checkbox" defaultChecked className="h-3.5 w-3.5" />
          Force change at next login
        </label>
        <button disabled={pending} className="btn-primary px-3 py-1 text-xs disabled:opacity-60">
          {pending ? "Resetting…" : "Reset"}
        </button>
      </div>

      {state?.error && <div className="text-xs text-[var(--color-danger-600)]">{state.error}</div>}
      {state?.ok && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-xs">
          <div className="text-emerald-800">
            New password for {state.email}: <span className="font-mono font-semibold select-all">{state.password}</span>
          </div>
          <div className="mt-0.5 text-emerald-700">
            Copy and share it now — it isn&apos;t shown again.
            {state.forced ? " They'll be asked to set their own on next login." : ""}
          </div>
        </div>
      )}
    </form>
  );
}
