"use client";

import { useActionState, useState, useEffect } from "react";
import { plans } from "@itsolute/db";
import {
  updateTenantAction,
  assignPlivoNumberAction,
  linkWhatsAppSenderAction,
  fetchWaBrandAction,
  submitRecoveryTemplateAction,
  refreshRecoveryTemplateAction,
  type TemplateActionResult,
} from "@/lib/admin-actions";

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
  callLogSheetId,
}: {
  id: string;
  mode: string;
  plan: string;
  status: string;
  billingCycle: string;
  onboardingFee: number | null;
  aiEnabled: boolean;
  callLogSheetId: string | null;
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
      <div>
        <label className={label}>Call-log Google Sheet (ID or URL)</label>
        <input
          name="callLogSheetId"
          defaultValue={callLogSheetId ?? ""}
          placeholder="1AbC…xyz  or  https://docs.google.com/spreadsheets/d/1AbC…xyz/edit"
          className={input}
        />
        <p className="mt-1 text-xs text-[var(--color-ink-faint)]">
          Every finished call is appended to this sheet (we own it, share it with the business). The service
          account must have edit access. Leave blank to turn logging off.
        </p>
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

type AssignResult = {
  ok?: boolean;
  error?: string;
  plivoAppId?: string;
  e164?: string;
  movedFrom?: string | null;
  needsConfirm?: boolean;
  currentTenantName?: string;
  currentTenantSlug?: string;
} | null;

export function AssignNumberForm({ tenantId, current }: { tenantId: string; current?: string }) {
  const [state, action, pending] = useActionState<AssignResult, FormData>(assignPlivoNumberAction, null);

  // The action returns needsConfirm when the number is already on another
  // tenant. Show a block-and-confirm step; re-showing on each fresh result so
  // "Cancel" can't be sticky and hide a genuine second warning.
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => setDismissed(false), [state]);
  const showConfirm = Boolean(state?.needsConfirm) && !dismissed;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div>
        <label className={label}>Plivo number (E.164)</label>
        <input
          name="e164"
          defaultValue={current ?? ""}
          placeholder="+912248123456"
          className={`${input} sm:max-w-xs`}
        />
      </div>

      {showConfirm ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-800">
            ⚠️ {state!.e164} is already assigned to {state!.currentTenantName}
            {state!.currentTenantSlug ? ` (${state!.currentTenantSlug})` : ""}.
          </p>
          <p className="mt-1 text-amber-700">
            Reassigning will <strong>disconnect it from {state!.currentTenantName}</strong> — their calls stop routing —
            and move it to this tenant. Only continue if that number should no longer serve {state!.currentTenantName}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              name="confirm"
              value="true"
              disabled={pending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {pending ? "Reassigning…" : `Yes, disconnect ${state!.currentTenantName} & reassign`}
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-black/[0.03]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
            {pending ? "Provisioning…" : "Provision & assign"}
          </button>
          {state?.ok && (
            <span className="text-sm text-[var(--color-money-700)]">
              ✓ Provisioned {state.e164}
              {state.movedFrom ? ` · moved from ${state.movedFrom}` : ""}
              {state.plivoAppId ? ` · Plivo app ${state.plivoAppId}` : ""}
            </span>
          )}
          {state?.error && <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>}
        </div>
      )}
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

  // Controlled so "Fetch from platform" can populate the fields.
  const [brand, setBrand] = useState(sender?.platformBrandSlug ?? "");
  const [displayE164, setDisplayE164] = useState(sender?.displayE164 ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState(sender?.phoneNumberId ?? "");
  const [wabaId, setWabaId] = useState(sender?.wabaId ?? "");
  const [displayName, setDisplayName] = useState(sender?.displayName ?? "");
  const [quality, setQuality] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<{ ok?: boolean; error?: string } | null>(null);

  async function onFetch() {
    setFetching(true);
    setFetchMsg(null);
    try {
      const r = await fetchWaBrandAction(brand);
      if (r.error) {
        setFetchMsg({ error: r.error });
      } else {
        if (r.phoneNumberId) setPhoneNumberId(r.phoneNumberId);
        if (r.wabaId) setWabaId(r.wabaId);
        if (r.displayE164) setDisplayE164(r.displayE164);
        if (r.displayName) setDisplayName(r.displayName);
        setQuality(r.quality ?? "");
        setFetchMsg({ ok: true });
      }
    } finally {
      setFetching(false);
    }
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <input type="hidden" name="quality" value={quality} />

      <div>
        <label className={label}>Platform brand slug</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="platformBrandSlug"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="cleanwarks"
            className={`${input} sm:max-w-xs`}
          />
          <button
            type="button"
            onClick={onFetch}
            disabled={fetching || !brand.trim()}
            className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50"
          >
            {fetching ? "Fetching…" : "Fetch from platform"}
          </button>
          {fetchMsg?.ok && <span className="text-sm text-[var(--color-money-700)]">Filled ✓{quality ? ` · quality ${quality}` : ""}</span>}
          {fetchMsg?.error && <span className="text-sm text-[var(--color-danger-600)]">{fetchMsg.error}</span>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={label}>WhatsApp number (E.164)</label>
          <input name="displayE164" value={displayE164} onChange={(e) => setDisplayE164(e.target.value)} placeholder="+919847012345" className={input} />
        </div>
        <div>
          <label className={label}>Display name (auto)</label>
          <input name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>Phone number ID (auto, optional)</label>
          <input name="phoneNumberId" value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} className={input} />
        </div>
        <div>
          <label className={label}>WABA ID (auto, optional)</label>
          <input name="wabaId" value={wabaId} onChange={(e) => setWabaId(e.target.value)} className={input} />
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

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-sm text-[var(--color-ink-faint)]">not created yet</span>;
  const s = status.toLowerCase();
  const cls =
    s === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : s === "rejected"
        ? "bg-red-50 text-red-700"
        : "bg-amber-50 text-amber-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{s}</span>;
}

export function RecoveryTemplateForm({
  tenantId,
  hasSender,
  currentStatus,
}: {
  tenantId: string;
  hasSender: boolean;
  currentStatus: string | null;
}) {
  const [busy, setBusy] = useState<"submit" | "refresh" | null>(null);
  const [result, setResult] = useState<TemplateActionResult | null>(null);
  const [status, setStatus] = useState<string | null>(currentStatus);

  async function run(kind: "submit" | "refresh") {
    setBusy(kind);
    setResult(null);
    try {
      const r =
        kind === "submit"
          ? await submitRecoveryTemplateAction(tenantId)
          : await refreshRecoveryTemplateAction(tenantId);
      setResult(r);
      if (r.ok && r.status) setStatus(r.status);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-[var(--color-ink-soft)]">Recovery template</span>
        <StatusBadge status={status} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => run("submit")}
          disabled={!hasSender || busy !== null}
          className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
        >
          {busy === "submit" ? "Submitting…" : status ? "Re-submit to Meta" : "Create & submit to Meta"}
        </button>
        <button
          type="button"
          onClick={() => run("refresh")}
          disabled={!hasSender || busy !== null}
          className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50"
        >
          {busy === "refresh" ? "Checking…" : "Refresh status"}
        </button>

        {result?.ok && (
          <span className="text-sm text-[var(--color-money-700)]">
            ✓ {result.status ? `Meta status: ${result.status}` : "Done"}
            {result.metaId ? ` · id ${result.metaId}` : ""}
          </span>
        )}
        {result?.error && <span className="text-sm text-[var(--color-danger-600)]">{result.error}</span>}
      </div>
      {result?.note && <p className="text-xs text-[var(--color-ink-faint)]">{result.note}</p>}
    </div>
  );
}
