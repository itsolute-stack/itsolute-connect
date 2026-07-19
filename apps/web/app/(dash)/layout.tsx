import { requireTenantSession } from "@/lib/session";
import { getTenant } from "@/lib/queries";
import { plans } from "@itsolute/db";
import { Sidebar, type NavItem } from "@/components/Sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenantSession();
  const tenant = await getTenant(session.tenantId);
  if (!tenant) return null;

  const plan = plans.planFor(tenant.plan);
  const has = (f: plans.Feature) => plans.planHasFeature(tenant.plan, f);

  // Gate nav by plan + mode (spec §6). Mode A never sees Call Management.
  const items: NavItem[] = [
    { href: "/", label: "Overview", icon: "home" },
    { href: "/calls", label: "Calls", icon: "phone" },
    { href: "/inbox", label: "Recovery Inbox", icon: "inbox" },
    ...(has("bookings") ? [{ href: "/bookings", label: "Bookings", icon: "calendar" as const }] : []),
    ...(tenant.mode === "B" && has("call_management")
      ? [{ href: "/call-management", label: "Call Management", icon: "sliders" as const }]
      : []),
    { href: "/settings", label: "Settings", icon: "settings" },
    { href: "/billing", label: "Billing", icon: "card" },
  ];

  return (
    <div className="min-h-screen md:flex">
      <Sidebar items={items} brandName={tenant.brandName} planLabel={plan.label} userEmail={session.email} />
      <main className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</div>
      </main>
    </div>
  );
}
