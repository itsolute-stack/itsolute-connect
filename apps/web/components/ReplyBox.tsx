"use client";

import { useActionState, useRef, useEffect } from "react";
import { replyToCallerAction } from "@/lib/inbox-actions";

export function ReplyBox({ callId }: { callId: string }) {
  const [state, action, pending] = useActionState(
    replyToCallerAction,
    null as { ok?: boolean; error?: string } | null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the textarea after a successful send.
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="callId" value={callId} />
      <textarea
        name="text"
        rows={3}
        placeholder="Reply to this customer on WhatsApp…"
        className="w-full resize-none rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-600)] focus:ring-2 focus:ring-[var(--color-brand-100)]"
      />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Sending…" : "Send"}
        </button>
        {state?.ok && <span className="text-sm text-[var(--color-money-700)]">Sent ✓</span>}
        {state?.error && <span className="text-sm text-[var(--color-danger-600)]">{state.error}</span>}
      </div>
      <p className="text-xs text-[var(--color-ink-faint)]">
        Sends from your WhatsApp number. Free replies work within 24h of the customer’s last message.
      </p>
    </form>
  );
}
