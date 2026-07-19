"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";
import { logoutAction } from "@/lib/auth-actions";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}

export function Sidebar({
  items,
  brandName,
  planLabel,
  userEmail,
}: {
  items: NavItem[];
  brandName: string;
  planLabel: string;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                : "text-[var(--color-ink-soft)] hover:bg-black/[0.03] hover:text-[var(--color-ink)]"
            }`}
          >
            <Icon name={it.icon} className="h-[18px] w-[18px]" />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-1">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--color-brand-600)] text-white font-semibold">
        {brandName.charAt(0)}
      </span>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold leading-tight">{brandName}</div>
        <div className="text-xs text-[var(--color-ink-faint)]">{planLabel}</div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 md:hidden">
        {brand}
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-lg p-2 hover:bg-black/[0.04]">
          <Icon name="menu" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-[var(--color-surface)] p-4 shadow-xl">
            <div className="mb-6">{brand}</div>
            {nav}
            <Logout email={userEmail} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:gap-6 md:border-r md:border-[var(--color-line)] md:bg-[var(--color-surface)] md:p-4">
        <div className="pt-1">{brand}</div>
        <div className="flex-1">{nav}</div>
        <Logout email={userEmail} />
      </aside>
    </>
  );
}

function Logout({ email }: { email: string }) {
  return (
    <div className="mt-6 border-t border-[var(--color-line)] pt-3">
      <div className="truncate px-3 pb-2 text-xs text-[var(--color-ink-faint)]">{email}</div>
      <form action={logoutAction}>
        <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-black/[0.03]">
          <Icon name="logout" className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </form>
    </div>
  );
}
