import Link from "next/link";
import { requireTenantSession } from "@/lib/session";
import { getInbox, getTenant } from "@/lib/queries";
import { RecoveryStatusPill } from "@/components/pills";
import { phoneDisplay, relativeTime } from "@/lib/format";

export default async function InboxPage() {
  const session = await requireTenantSession();
  const [tenant, threads] = await Promise.all([getTenant(session.tenantId), getInbox(session.tenantId)]);
  if (!tenant) return null;

  const replied = threads.filter((t) => t.status === "replied");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Recovery Inbox</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          {replied.length} replied · {threads.length} recent conversations
        </p>
      </div>

      <div className="card overflow-hidden">
        {threads.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--color-ink-faint)]">
            No recovery conversations yet.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {threads.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/calls/${t.callId}`}
                  className={`flex items-center justify-between gap-3 px-5 py-4 hover:bg-black/[0.015] ${
                    t.status === "replied" ? "bg-[var(--color-money-50)]/40" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{phoneDisplay(t.callerE164)}</div>
                    <div className="text-xs text-[var(--color-ink-faint)]">
                      {t.repliedAt
                        ? `Replied ${relativeTime(t.repliedAt)}`
                        : `Sent ${t.sentAt ? relativeTime(t.sentAt) : relativeTime(t.createdAt)}`}
                    </div>
                  </div>
                  <RecoveryStatusPill status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-xs text-[var(--color-ink-faint)]">
        Replies are captured from your WhatsApp number. Two-way replying from here arrives with the full inbox.
      </p>
    </div>
  );
}
