import Link from "next/link";
import { requireTenantSession } from "@/lib/session";
import { getCalls, getTenant, type CallFilters } from "@/lib/queries";
import { CallStatusPill, RecoveryStatusPill } from "@/components/pills";
import { phoneDisplay, dateTime } from "@/lib/format";

const STATUSES = ["missed", "recovered", "answered"] as const;

export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const session = await requireTenantSession();
  const tenant = (await getTenant(session.tenantId))!;
  const sp = await searchParams;
  const filters: CallFilters = {
    status: STATUSES.includes(sp.status as any) ? (sp.status as CallFilters["status"]) : undefined,
    q: sp.q,
    page: sp.page ? Number(sp.page) : 1,
  };
  const { calls, total, page, pages } = await getCalls(session.tenantId, filters);

  const tab = (label: string, value?: string) => {
    const active = (filters.status ?? "") === (value ?? "");
    const params = new URLSearchParams();
    if (value) params.set("status", value);
    if (filters.q) params.set("q", filters.q);
    return (
      <Link
        key={label}
        href={`/calls${params.toString() ? `?${params}` : ""}`}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
          active ? "bg-[var(--color-brand-600)] text-white" : "text-[var(--color-ink-soft)] hover:bg-black/[0.04]"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Calls</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{total} calls</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {tab("All")}
          {tab("Missed", "missed")}
          {tab("Recovered", "recovered")}
          {tab("Answered", "answered")}
        </div>
        <form className="flex gap-2">
          {filters.status && <input type="hidden" name="status" value={filters.status} />}
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Search number…"
            className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-sm outline-none focus:border-[var(--color-brand-600)]"
          />
        </form>
      </div>

      <div className="card overflow-hidden">
        {calls.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--color-ink-faint)]">No calls match this view.</div>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {calls.map((call) => {
              const rec = call.recoveryMessages[0];
              return (
                <li key={call.id}>
                  <Link
                    href={`/calls/${call.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-black/[0.015]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{phoneDisplay(call.callerE164)}</div>
                      <div className="text-xs text-[var(--color-ink-faint)]">{dateTime(call.startedAt, tenant.timezone)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec && <RecoveryStatusPill status={rec.status} />}
                      <CallStatusPill status={call.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <PageLink page={page - 1} disabled={page <= 1} filters={filters} label="Previous" />
          <span className="text-[var(--color-ink-faint)]">
            Page {page} of {pages}
          </span>
          <PageLink page={page + 1} disabled={page >= pages} filters={filters} label="Next" />
        </div>
      )}
    </div>
  );
}

function PageLink({ page, disabled, filters, label }: { page: number; disabled: boolean; filters: CallFilters; label: string }) {
  if (disabled) return <span className="rounded-lg px-3 py-1.5 text-[var(--color-ink-faint)]">{label}</span>;
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(page));
  return (
    <Link href={`/calls?${params}`} className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 font-medium hover:bg-black/[0.03]">
      {label}
    </Link>
  );
}
