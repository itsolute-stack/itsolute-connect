import type { CallStatus, RecoveryStatus, QualityRating, WhatsAppSenderStatus, BookingStatus } from "@itsolute/db";

function Pill({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

const CALL: Record<CallStatus, { label: string; cls: string }> = {
  ringing: { label: "Ringing", cls: "bg-slate-100 text-slate-600" },
  answered: { label: "Answered", cls: "bg-slate-100 text-slate-600" },
  missed: { label: "Missed", cls: "bg-amber-50 text-amber-700" },
  recovered: { label: "Recovered", cls: "bg-emerald-50 text-emerald-700" },
};
export function CallStatusPill({ status }: { status: CallStatus }) {
  const s = CALL[status];
  return <Pill label={s.label} className={s.cls} />;
}

const RECOVERY: Record<RecoveryStatus, { label: string; cls: string }> = {
  queued: { label: "Queued", cls: "bg-slate-100 text-slate-600" },
  sent: { label: "Sent", cls: "bg-indigo-50 text-indigo-700" },
  delivered: { label: "Delivered", cls: "bg-indigo-50 text-indigo-700" },
  read: { label: "Read", cls: "bg-indigo-50 text-indigo-700" },
  replied: { label: "Replied", cls: "bg-emerald-50 text-emerald-700" },
  failed: { label: "No WhatsApp", cls: "bg-rose-50 text-rose-700" },
  skipped: { label: "Skipped", cls: "bg-slate-100 text-slate-500" },
};
export function RecoveryStatusPill({ status }: { status: RecoveryStatus }) {
  const s = RECOVERY[status];
  return <Pill label={s.label} className={s.cls} />;
}

const BOOKING: Record<BookingStatus, { label: string; cls: string }> = {
  requested: { label: "Requested", cls: "bg-amber-50 text-amber-700" },
  confirmed: { label: "Confirmed", cls: "bg-indigo-50 text-indigo-700" },
  done: { label: "Done", cls: "bg-emerald-50 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-500" },
};
export function BookingStatusPill({ status }: { status: BookingStatus }) {
  const s = BOOKING[status];
  return <Pill label={s.label} className={s.cls} />;
}

export function WhatsAppHealth({
  status,
  quality,
}: {
  status?: WhatsAppSenderStatus | null;
  quality?: QualityRating | null;
}) {
  if (!status || status === "disconnected") {
    return <Pill label="Not connected" className="bg-slate-100 text-slate-600" />;
  }
  if (status === "flagged" || quality === "RED") {
    return <Pill label="Action needed" className="bg-rose-50 text-rose-700" />;
  }
  if (quality === "YELLOW") {
    return <Pill label="Warning" className="bg-amber-50 text-amber-700" />;
  }
  return <Pill label="Healthy" className="bg-emerald-50 text-emerald-700" />;
}
