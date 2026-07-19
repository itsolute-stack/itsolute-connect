"use client";

import { useActionState } from "react";
import { addStaffAction, deleteStaffAction, moveStaffAction, toggleAlertAction } from "@/lib/callmgmt-actions";
import { phoneDisplay } from "@/lib/format";

interface Staff {
  id: string;
  name: string;
  e164: string;
  ringOrder: number;
  alertOnMissed: boolean;
}

export function StaffManager({ staff }: { staff: Staff[] }) {
  const [state, action, pending] = useActionState(addStaffAction, null as { ok?: boolean; error?: string } | null);
  const input = "rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-600)]";

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-[var(--color-line)]">
        {staff.map((s, i) => (
          <li key={s.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-brand-50)] text-xs font-semibold text-[var(--color-brand-700)]">
                {i + 1}
              </span>
              <div>
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-xs text-[var(--color-ink-faint)]">{phoneDisplay(s.e164)}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <form action={toggleAlertAction}>
                <input type="hidden" name="staffId" value={s.id} />
                <button
                  className={`rounded-lg px-2 py-1 text-xs font-medium ${s.alertOnMissed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                  title="Alert this person on a missed call"
                >
                  {s.alertOnMissed ? "Alerts on" : "Alerts off"}
                </button>
              </form>
              <MoveButton staffId={s.id} dir="up" disabled={i === 0} label="↑" />
              <MoveButton staffId={s.id} dir="down" disabled={i === staff.length - 1} label="↓" />
              <form action={deleteStaffAction}>
                <input type="hidden" name="staffId" value={s.id} />
                <button className="rounded-lg px-2 py-1 text-xs text-[var(--color-danger-600)] hover:bg-rose-50">
                  Remove
                </button>
              </form>
            </div>
          </li>
        ))}
        {staff.length === 0 && (
          <li className="py-3 text-sm text-[var(--color-ink-faint)]">No staff yet. Add who should be rung.</li>
        )}
      </ul>

      <form action={action} className="flex flex-wrap items-end gap-2 border-t border-[var(--color-line)] pt-4">
        <input name="name" placeholder="Name" className={input} />
        <input name="e164" placeholder="+9198…" className={input} />
        <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Adding…" : "Add staff"}
        </button>
        {state?.error && <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>}
      </form>
      <p className="text-xs text-[var(--color-ink-faint)]">
        Calls ring staff top-to-bottom. Busy or no-answer hunts to the next number.
      </p>
    </div>
  );
}

function MoveButton({ staffId, dir, disabled, label }: { staffId: string; dir: string; disabled: boolean; label: string }) {
  return (
    <form action={moveStaffAction}>
      <input type="hidden" name="staffId" value={staffId} />
      <input type="hidden" name="dir" value={dir} />
      <button
        disabled={disabled}
        className="rounded-lg px-2 py-1 text-xs text-[var(--color-ink-soft)] hover:bg-black/[0.04] disabled:opacity-30"
      >
        {label}
      </button>
    </form>
  );
}
