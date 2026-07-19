import { getAdminUsage } from "@/lib/admin-queries";

export default async function AdminUsagePage() {
  const usage = await getAdminUsage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Usage</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">This month, by tenant</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
              <th className="px-4 py-2.5 font-medium">Tenant</th>
              <th className="px-4 py-2.5 font-medium">Recovery messages</th>
              <th className="px-4 py-2.5 font-medium">Call minutes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {usage.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[var(--color-ink-faint)]">
                  No usage recorded this month yet.
                </td>
              </tr>
            ) : (
              usage.map((u) => (
                <tr key={u.tenantId}>
                  <td className="px-4 py-3 font-medium">{u.brandName}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {u.messages} <span className="text-[var(--color-ink-faint)]">/ {u.includedMessages}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {u.minutes}{" "}
                    <span className="text-[var(--color-ink-faint)]">
                      {u.includedMinutes ? `/ ${u.includedMinutes}` : "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
