"use client";

import { useActionState } from "react";
import { plans } from "@itsolute/db";
import { updateTenantAction, assignPlivoNumberAction, linkWhatsAppSenderAction } from "@/lib/admin-actions";

type Result = { ok?: boolean; error?: string } | null;

function Status({ state }: { state: Result }) {
  if (state?.ok) return <span className="text-sm text-[var(--color-money-700)]">Saved</span>;
  if (state?.error) return <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>;
  return null;
}

const input =
  "w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-600)]";
const label = "block text-xs font-medium text-[var(--color-ink-soft)] mb-1";

export function EditTenantForm({
  id,
  mode,
  plan,
  status,
  billingCycle,
  onboardingFee,
  aiEnabled,
}: {
  id: string;
  mode: string;
  plan: string;
  status: string;
  billingCycle: string;
  onboardingFee: number | null;
  aiEnabled: boolean;
}) {
  const [state, action, pending] = useActionState<Result, FormData>(updateTenantAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label}>Plan</label>
          <select name="plan" defaultValue={plan} className={input}>
            {plans.PLAN_LIST.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} (Mode {p.mode})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Mode</label>
          <select name="mode" defaultValue={mode} className={input}>
            <option value="A">A — Recovery</option>
            <option value="B">B — Front Desk</option>
          </select>
        </div>
        <div>
          <label className={label}>Status</label>
          <select name="status" defaultValue={status} className={input}>
            <option value="trial">trial</option>
            <option value="active">active</option>
            <option value="paused">paused</option>
          </select>
        </div>
        <div>
          <label className={label}>Billing cycle</label>
          <select name="billingCycle" defaultValue={billingCycle} className={input}>
            <option value="monthly">monthly</option>
            <option value="annual">annual (~20% off)</option>
          </select>
        </div>
        <div>
          <label className={label}>Onboarding fee (₹, optional)</label>
          <input name="onboardingFee" type="number" defaultValue={onboardingFee ?? ""} className={input} />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input name="aiEnabled" type="checkbox" defaultChecked={aiEnabled} className="h-4 w-4" />
          AI enabled (future)
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AssignNumberForm({ tenantId, current }: { tenantId: string; current?: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(assignPlivoNumberAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Plivo number (E.164)</label>
          <input name="e164" defaultValue={current ?? ""} placeholder="+912248123456" className={input} />
        </div>
        <div>
          <label className={label}>Plivo Application ID (optional)</label>
          <input name="plivoAppId" placeholder="app id" className={input} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Saving…" : "Assign number"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function LinkWabaForm({
  tenantId,
  sender,
}: {
  tenantId: string;
  sender?: {
    phoneNumberId: string | null;
    wabaId: string | null;
    displayE164: string;
    displayName: string | null;
    platformBrandSlug: string | null;
  } | null;
}) {
  const [state, action, pending] = useActionState<Result, FormData>(linkWhatsAppSenderAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>Phone number ID</label>
          <input name="phoneNumberId" defaultValue={sender?.phoneNumberId ?? ""} className={input} />
        </div>
        <div>
          <label className={label}>WABA ID</label>
          <input name="wabaId" defaultValue={sender?.wabaId ?? ""} className={input} />
        </div>
        <div>
          <label className={label}>WhatsApp number (E.164)</label>
          <input name="displayE164" defaultValue={sender?.displayE164 ?? ""} placeholder="+919847012345" className={input} />
        </div>
        <div>
          <label className={label}>Display name</label>
          <input name="displayName" defaultValue={sender?.displayName ?? ""} className={input} />
        </div>
        <div>
          <label className={label}>Platform brand slug</label>
          <input name="platformBrandSlug" defaultValue={sender?.platformBrandSlug ?? ""} placeholder="cleanwarks" className={input} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Saving…" : "Link WhatsApp (own WABA)"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}
