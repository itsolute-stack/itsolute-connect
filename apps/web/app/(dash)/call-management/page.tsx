import { redirect } from "next/navigation";
import { requireTenantSession } from "@/lib/session";
import { getTenant } from "@/lib/queries";
import { getStaff, getIvrNodes, getCallAnalytics } from "@/lib/callmgmt-queries";
import { StaffManager } from "@/components/callmgmt/StaffManager";
import { IvrBuilder } from "@/components/callmgmt/IvrBuilder";
import { RecordingToggle } from "@/components/callmgmt/RecordingToggle";
import { plans } from "@itsolute/db";
import { pct } from "@/lib/format";

export default async function CallManagementPage() {
  const session = await requireTenantSession();
  const tenant = (await getTenant(session.tenantId))!;

  // Gate: Mode B + the call_management feature only (spec §6).
  if (tenant.mode !== "B" || !plans.planHasFeature(tenant.plan, "call_management")) redirect("/");

  const [staff, ivrNodes, analytics] = await Promise.all([
    getStaff(session.tenantId),
    getIvrNodes(session.tenantId),
    getCallAnalytics(session.tenantId, tenant.timezone),
  ]);

  const mins = Math.floor(analytics.avgHandleSec / 60);
  const secs = analytics.avgHandleSec % 60;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Call Management</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Front Desk routing, IVR & analytics</p>
      </div>

      {/* Analytics */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Calls" value={String(analytics.total)} />
        <Metric label="Answer rate" value={pct(analytics.answerRate)} tone="money" />
        <Metric label="Missed rate" value={pct(analytics.missedRate)} />
        <Metric label="Avg handle time" value={analytics.total ? `${mins}m ${secs}s` : "—"} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Staff & ring order</h2>
        <StaffManager staff={staff} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">IVR menu</h2>
        <IvrBuilder nodes={ivrNodes} />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 text-sm font-semibold">Recording</h2>
        <RecordingToggle on={tenant.recordCalls} />
      </section>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "money" }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "money" ? "text-[var(--color-money-700)]" : ""}`}>
        {value}
      </div>
    </div>
  );
}
