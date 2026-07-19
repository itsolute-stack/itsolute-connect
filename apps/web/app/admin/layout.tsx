import Link from "next/link";
import { requireAdminSession } from "@/lib/session";
import { logoutAction } from "@/lib/auth-actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdminSession();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-ink)] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-semibold">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 text-sm">C</span>
              Connect Admin
            </Link>
            <nav className="hidden items-center gap-1 text-sm sm:flex">
              <AdminLink href="/admin">Tenants</AdminLink>
              <AdminLink href="/admin/templates">Templates</AdminLink>
              <AdminLink href="/admin/usage">Usage</AdminLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/60 md:inline">{session.email}</span>
            <form action={logoutAction}>
              <button className="rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

function AdminLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">
      {children}
    </Link>
  );
}
