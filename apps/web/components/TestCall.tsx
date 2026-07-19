"use client";

import { useState } from "react";
import { checkTestCallAction, type TestCallState } from "@/lib/onboarding-actions";

export function TestCall({ number, alreadyTested }: { number: string; alreadyTested: boolean }) {
  const [state, setState] = useState<TestCallState>(alreadyTested ? { status: "found", recovery: null } : { status: "idle" });
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    try {
      setState(await checkTestCallAction());
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-[var(--color-ink-soft)]">
        <li>
          From another phone, call your own number and <strong>let it ring out</strong> without answering.
        </li>
        <li>It forwards to {number} — we log the missed call and message that caller on WhatsApp.</li>
        <li>Come back here and check.</li>
      </ol>

      {state.status === "found" ? (
        <div className="rounded-lg bg-[var(--color-money-50)] px-4 py-3 text-sm text-[var(--color-money-700)]">
          ✓ Test call received{state.recovery ? ` — recovery message ${state.recovery}` : ""}. Forwarding works!
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={check}
            disabled={checking}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {checking ? "Checking…" : "I made a test call — check now"}
          </button>
          {state.status === "waiting" && (
            <span className="text-sm text-[var(--color-ink-soft)]">
              No call yet — give it a few seconds and try again.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
