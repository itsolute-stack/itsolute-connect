"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/settings-actions";

export function ProfileForm({
  brandName,
  avgJobValue,
  bookingUrl,
}: {
  brandName: string;
  avgJobValue: number;
  bookingUrl: string;
}) {
  const [state, action, pending] = useActionState(
    updateProfileAction,
    null as { ok?: boolean; error?: string } | null,
  );

  return (
    <form action={action} className="space-y-4">
      <Field label="Business name" name="brandName" defaultValue={brandName} />
      <Field
        label="Average job value (₹)"
        name="avgJobValue"
        type="number"
        defaultValue={String(avgJobValue)}
        hint="Used to estimate revenue recovered."
      />
      <Field label="Booking link" name="bookingUrl" defaultValue={bookingUrl} placeholder="https://…" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.ok && <span className="text-sm text-[var(--color-money-700)]">Saved</span>}
        {state?.error && <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full max-w-md rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-600)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
      />
      {hint && <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{hint}</p>}
    </div>
  );
}
