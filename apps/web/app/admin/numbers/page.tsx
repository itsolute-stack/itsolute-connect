import Link from "next/link";
import { getAllNumbers } from "@/lib/admin-queries";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Numbers · Connect Admin" };

export default async function AdminNumbersPage() {
  const numbers = await getAllNumbers();
  const active = numbers.filter((n) => n.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Plivo numbers</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Every number provisioned through Connect — {active} active of {numbers.length} total.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
              <Th>Number</Th>
              <Th>Allocated to</Th>
              <Th>Status</Th>
              <Th>Plivo App ID</Th>
              <Th right>Calls</Th>
              <Th>Provisioned</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {numbers.map((n) => (
              <tr key={n.id} className="hover:bg-black/[0.015]">
                <td className="px-4 py-3 font-medium tabular-nums">{n.e164}</td>
                <td className="px-4 py-3">
                  {n.tenantId ? (
                    <Link href={`/admin/tenants/${n.tenantId}`} className="text-[var(--color-brand-700)]">
                      {n.tenantName}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-ink-faint)]">—</span>
                  )}
                  {n.tenantSlug && <div className="text-xs text-[var(--color-ink-faint)]">{n.tenantSlug}</div>}
                </td>
                <td className="px-4 py-3">
                  <NumberStatus status={n.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-ink-soft)]">{n.plivoAppId ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{n.calls}</td>
                <td className="px-4 py-3 text-[var(--color-ink-soft)]">{dateTime(n.createdAt, "Asia/Kolkata")}</td>
              </tr>
            ))}
            {numbers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--color-ink-faint)]">
                  No numbers provisioned yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--color-ink-faint)]">
        This lists numbers wired into Connect (via <strong>Provision &amp; assign</strong>). A number you bought in the
        Plivo console but haven&apos;t provisioned yet won&apos;t appear here. <code>active</code> = live and routing
        calls for its tenant; <code>released</code> = no longer in service.
      </p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}

function NumberStatus({ status }: { status: string }) {
  const cls = status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
