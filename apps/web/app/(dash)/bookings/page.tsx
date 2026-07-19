import Link from "next/link";
import { requireTenantSession } from "@/lib/session";
import { getBookings, getTenant } from "@/lib/queries";
import { BookingStatusPill } from "@/components/pills";
import { phoneDisplay, dateTime } from "@/lib/format";
import { plans } from "@itsolute/db";
import { redirect } from "next/navigation";

export default async function BookingsPage() {
  const session = await requireTenantSession();
  const tenant = (await getTenant(session.tenantId))!;
  if (!plans.planHasFeature(tenant.plan, "bookings")) redirect("/");

  const bookings = await getBookings(session.tenantId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Bookings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">From recovered calls</p>
      </div>

      <div className="card overflow-hidden">
        {bookings.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--color-ink-faint)]">
            No bookings yet. Bookings created from a recovery conversation show up here.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{phoneDisplay(b.callerE164)}</div>
                  <div className="text-xs text-[var(--color-ink-faint)]">
                    {b.scheduledAt ? dateTime(b.scheduledAt, tenant.timezone) : `Requested ${dateTime(b.createdAt, tenant.timezone)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.callId && (
                    <Link href={`/calls/${b.callId}`} className="text-xs font-medium text-[var(--color-brand-700)]">
                      View call
                    </Link>
                  )}
                  <BookingStatusPill status={b.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
