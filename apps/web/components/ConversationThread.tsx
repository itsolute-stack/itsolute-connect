import type { ConversationMessage } from "@/lib/wa-conversation";

// Renders the WhatsApp back-and-forth (inbound left, outbound right) — the
// actual message text pulled from the platform, shown inside Connect.
export function ConversationThread({
  messages,
  timeZone,
  error,
}: {
  messages: ConversationMessage[];
  timeZone: string;
  error?: string;
}) {
  if (error) {
    return <p className="text-sm text-[var(--color-ink-faint)]">Couldn’t load the conversation ({error}).</p>;
  }
  if (messages.length === 0) {
    return <p className="text-sm text-[var(--color-ink-faint)]">No messages yet — nothing back from this customer.</p>;
  }

  return (
    <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
      {messages.map((m) => {
        const outbound = m.direction === "OUTBOUND";
        return (
          <div key={m.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                outbound
                  ? "rounded-br-sm bg-[var(--color-brand-600)] text-white"
                  : "rounded-bl-sm bg-slate-100 text-[var(--color-ink)]"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{m.body || "—"}</div>
              <div className={`mt-1 text-[10px] ${outbound ? "text-white/70" : "text-[var(--color-ink-faint)]"}`}>
                {new Date(m.sentAt).toLocaleString("en-IN", {
                  timeZone,
                  day: "numeric",
                  month: "short",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
