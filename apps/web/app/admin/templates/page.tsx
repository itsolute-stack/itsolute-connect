import { getAdminTemplates } from "@/lib/admin-queries";

export default async function AdminTemplatesPage() {
  const templates = await getAdminTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Templates</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Recovery templates across tenants</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
              <th className="px-4 py-2.5 font-medium">Tenant</th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Lang</th>
              <th className="px-4 py-2.5 font-medium">Category</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {templates.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-3">{t.tenantName}</td>
                <td className="px-4 py-3 font-mono text-xs">{t.name}</td>
                <td className="px-4 py-3">{t.language}</td>
                <td className="px-4 py-3">
                  <span className={t.category !== "utility" ? "text-amber-700" : ""}>{t.category}</span>
                </td>
                <td className="px-4 py-3">
                  <TemplateStatus status={t.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--color-ink-faint)]">
        Recovery templates must be <code>utility</code> + approved. Non-utility categories are flagged.
      </p>
    </div>
  );
}

function TemplateStatus({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : status === "pending"
        ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}
