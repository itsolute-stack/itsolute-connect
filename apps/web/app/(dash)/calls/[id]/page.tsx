import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { getCall, getTenant } from "@/lib/queries";
import { CallStatusPill, RecoveryStatusPill, BookingStatusPill } from "@/components/pills";
import { phoneDisplay, dateTime } from "@/lib/format";

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireTenantSession();
  const { id } = await params;
  const [tenant, call] = await Promise.all([getTenant(session.tenantId), getCall(session.tenantId, id)]);
  if (!call || !tenant) notFound();

  const rec = call.recoveryMessages[0];
  const booking = call.bookings[0];
  const tz = tenant.timezone;

  // Build an ordered timeline from the timestamps we actually have.
  const steps: { label: string; at?: Date | null; done: boolean }[] = [
    { label: "Call rang", at: call.startedAt, done: true },
    { label: "Marked missed", at: call.endedAt, done: call.status === "missed" || call.status === "recovered" },
    { label: "Recovery message sent", at: rec?.sentAt, done: !!rec?.sentAt },
    { label: "Delivered", at: rec?.deliveredAt, done: !!rec?.deliveredAt },
    { label: "Read", at: rec?.readAt, done: !!rec?.readAt },
    { label: "Replied", at: rec?.repliedAt, done: !!rec?.repliedAt },
    { label: "Booked", at: booking?.createdAt, done: !!booking },
  ];

  return (
    <div className="space-y-6">
      <Link href="/calls" className="text-sm font-medium text-[var(--color-brand-700)]">
        ← Back to calls
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{phoneDisplay(call.callerE164)}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{dateTime(call.startedAt, tz)}</p>
        </div>
        <CallStatusPill status={call.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-4 text-sm font-semibold">Timeline</div>
          <ol className="relative ml-2 space-y-4 border-l border-[var(--color-line)] pl-5">
            {steps.map((s, i) => (
              <li key={i} className="relative">
                <span
                  className={`absolute -left-[26px] top-0.5 grid h-4 w-4 place-items-center rounded-full ring-4 ring-[var(--color-surface)] ${
                    s.done ? "bg-[var(--color-money-600)]" : "bg-slate-200"
                  }`}
                />
                <div className={`text-sm font-medium ${s.done ? "" : "text-[var(--color-ink-faint)]"}`}>{s.label}</div>
                <div className="text-xs text-[var(--color-ink-faint)]">
                  {s.at ? dateTime(s.at, tz) : s.done ? "" : "Pending"}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 text-sm font-semibold">Recovery message</div>
            {rec ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-ink-faint)]">Status</span>
                  <RecoveryStatusPill status={rec.status} />
                </div>
                {rec.statusReason && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--color-ink-faint)]">Reason</span>
                    <span className="font-medium">{rec.statusReason.replace(/_/g, " ")}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">No recovery message for this call.</p>
            )}
          </div>

          <div className="card p-5">
            <div className="mb-3 text-sm font-semibold">Booking</div>
            {booking ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--color-ink-faint)]">Status</span>
                <BookingStatusPill status={booking.status} />
              </div>
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">No booking yet.</p>
            )}
          </div>

          {call.recordingUrl && (
            <div className="card p-5">
              <div className="mb-3 text-sm font-semibold">Recording</div>
              <audio controls src={call.recordingUrl} className="w-full" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
