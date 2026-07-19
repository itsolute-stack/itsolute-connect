"use client";

import { toggleRecordingAction } from "@/lib/callmgmt-actions";

export function RecordingToggle({ on }: { on: boolean }) {
  return (
    <form action={toggleRecordingAction} className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm font-medium">Call recording</div>
        <div className="text-xs text-[var(--color-ink-faint)]">
          Record answered calls for quality and training.
        </div>
      </div>
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      <button
        type="submit"
        role="switch"
        aria-checked={on}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--color-money-600)]" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </form>
  );
}
