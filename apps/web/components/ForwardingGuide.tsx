"use client";

import { useState } from "react";

// Per-carrier conditional call-forwarding guide (spec §5 Track 1). The GSM
// dialer codes are the same across Indian carriers; per-carrier notes cover the
// app-based alternative. Forwarding busy / no-answer / unreachable to the Plivo
// number turns every unanswered call into a recovery message.

const CARRIERS = ["Jio", "Airtel", "Vi", "BSNL"] as const;
type Carrier = (typeof CARRIERS)[number];

const NOTES: Record<Carrier, string> = {
  Jio: "Dial the codes below, or set forwarding in the MyJio app → Call settings.",
  Airtel: "Dial the codes below, or use the Airtel Thanks app → Call forwarding.",
  Vi: "Dial the codes below, or set it in the Vi app → Manage → Call forwarding.",
  BSNL: "Dial the codes below from your BSNL number to activate.",
};

export function ForwardingGuide({ plivoNumber }: { plivoNumber: string }) {
  const [carrier, setCarrier] = useState<Carrier>("Jio");
  const codes = [
    { when: "When your line is busy", code: `**67*${plivoNumber}#` },
    { when: "When you don’t answer", code: `**61*${plivoNumber}#` },
    { when: "When unreachable / switched off", code: `**62*${plivoNumber}#` },
  ];

  return (
    <div>
      <div className="mb-4 rounded-lg bg-[var(--color-brand-50)] px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-brand-700)]">
          Your calling number
        </div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums">{plivoNumber}</div>
        <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
          Forward your real phone’s missed calls here. We never change your number — callers still dial you as normal.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {CARRIERS.map((c) => (
          <button
            key={c}
            onClick={() => setCarrier(c)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              carrier === c ? "bg-[var(--color-brand-600)] text-white" : "text-[var(--color-ink-soft)] hover:bg-black/[0.04]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <p className="mb-3 text-xs text-[var(--color-ink-soft)]">{NOTES[carrier]}</p>

      <ul className="space-y-2">
        {codes.map((c) => (
          <li key={c.code} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] px-4 py-3">
            <div>
              <div className="text-sm font-medium">{c.when}</div>
              <div className="mt-0.5 font-mono text-sm text-[var(--color-ink-soft)]">{c.code}</div>
            </div>
            <CopyButton text={c.code} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      className="shrink-0 rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium hover:bg-black/[0.03]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
