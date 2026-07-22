import Link from "next/link";
import { getAdminOverview } from "@/lib/admin-queries";
import { WhatsAppHealth } from "@/components/pills";
import { inr } from "@/lib/format";
import { plans } from "@itsolute/db";

export default async function AdminTenantsPage() {
  const { rows, totalMrr, activeCount, tenantCount } = await getAdminOverview();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Tenants</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">All businesses on ITSolute Connect</p>
        </div>
        <Link href="/admin/tenants/new" className="btn-primary shrink-0 px-4 py-2 text-sm">
          + Add tenant
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Tenants" value={String(tenantCount)} />
        <Stat label="Active" value={String(activeCount)} />
        <Stat label="MRR" value={inr(totalMrr)} tone />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
              <Th>Business</Th>
              <Th>Plan · Mode</Th>
              <Th>Status</Th>
              <Th>WhatsApp</Th>
              <Th>Number</Th>
              <Th>Msgs / Min</Th>
              <Th right>MRR</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {rows.map((t) => (
              <tr key={t.id} className="hover:bg-black/[0.015]">
                <td className="px-4 py-3">
                  <Link href={`/admin/tenants/${t.id}`} className="font-medium text-[var(--color-brand-700)]">
                    {t.brandName}
                  </Link>
                  <div className="text-xs text-[var(--color-ink-faint)]">{t.slug}</div>
                </td>
                <td className="px-4 py-3">
                  {plans.planFor(t.plan).label} · {t.mode}
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={t.status} />
                </td>
                <td className="px-4 py-3">
                  <WhatsAppHealth status={t.whatsapp?.status} quality={t.whatsapp?.quality} />
                </td>
                <td className="px-4 py-3">
                  {t.hasNumber ? (
                    <span className="text-[var(--color-money-700)]">✓</span>
                  ) : (
                    <span className="text-[var(--color-ink-faint)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums text-[var(--color-ink-soft)]">
                  {t.messages} / {t.minutes}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium">{inr(t.mrr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone ? "text-[var(--color-money-700)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "active"
      ? "bg-emerald-50 text-emerald-700"
      : status === "trial"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
