import Link from "next/link";
import { getAllUsers } from "@/lib/admin-queries";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Users · Connect Admin" };

export default async function AdminUsersPage() {
  const users = await getAllUsers();
  const admins = users.filter((u) => !u.tenantId).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Everyone with a login — {users.length} total, {admins} internal admin{admins === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
              <Th>Email</Th>
              <Th>Name</Th>
              <Th>Role</Th>
              <Th>Tenant</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-black/[0.015]">
                <td className="px-4 py-3 font-medium">{u.email}</td>
                <td className="px-4 py-3 text-[var(--color-ink-soft)]">{u.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <RolePill role={u.role} />
                </td>
                <td className="px-4 py-3">
                  {u.tenantId ? (
                    <Link href={`/admin/tenants/${u.tenantId}`} className="text-[var(--color-brand-700)]">
                      {u.tenantName}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-ink-faint)]">Internal admin</span>
                  )}
                </td>
                <td className="px-4 py-3 text-[var(--color-ink-soft)]">{dateTime(u.createdAt, "Asia/Kolkata")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}

function RolePill({ role }: { role: string }) {
  const cls =
    role === "admin"
      ? "bg-violet-50 text-violet-700"
      : role === "owner"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{role}</span>;
}
