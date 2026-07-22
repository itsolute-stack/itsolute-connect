"use client";

import { useActionState } from "react";
import { plans } from "@itsolute/db";
import { createTenantAction } from "@/lib/admin-actions";

const input =
  "w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-600)]";
const label = "block text-xs font-medium text-[var(--color-ink-soft)] mb-1";

export function NewTenantForm() {
  const [state, action, pending] = useActionState(
    createTenantAction,
    null as { error?: string } | null,
  );

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Business name</label>
          <input name="brandName" placeholder="Acme Clinic" className={input} />
        </div>
        <div>
          <label className={label}>Slug (URL id)</label>
          <input name="slug" placeholder="acme-clinic" className={input} />
        </div>
        <div>
          <label className={label}>Plan (mode follows the plan)</label>
          <select name="plan" defaultValue="recovery" className={input}>
            {plans.PLAN_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (Mode {p.mode})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Status</label>
          <select name="status" defaultValue="trial" className={input}>
            <option value="trial">trial</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
        </div>
        <div>
          <label className={label}>Timezone</label>
          <input name="timezone" defaultValue="Asia/Kolkata" className={input} />
        </div>
        <div>
          <label className={label}>Average job value (₹)</label>
          <input name="avgJobValue" type="number" defaultValue={0} className={input} />
        </div>
      </div>

      <div className="rounded-lg border border-[var(--color-line)] p-4">
        <div className="mb-3 text-xs font-semibold text-[var(--color-ink-soft)]">
          Owner login (optional — lets the business sign in right away)
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Owner email</label>
            <input name="ownerEmail" type="email" placeholder="owner@acme.com" className={input} />
          </div>
          <div>
            <label className={label}>Initial password (min 8)</label>
            <input name="ownerPassword" type="text" placeholder="they can change it later" className={input} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Creating…" : "Create tenant"}
        </button>
        {state?.error && <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>}
      </div>
    </form>
  );
}
