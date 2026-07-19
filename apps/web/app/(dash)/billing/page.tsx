import { requireTenantSession } from "@/lib/session";
import { getTenant, getUsageThisMonth } from "@/lib/queries";
import { plans } from "@itsolute/db";
import { inr } from "@/lib/format";

export default async function BillingPage() {
  const session = await requireTenantSession();
  const tenant = (await getTenant(session.tenantId))!;
  const usage = await getUsageThisMonth(session.tenantId, tenant.timezone);
  const plan = plans.planFor(tenant.plan);
  const price = plans.priceFor(tenant.plan, tenant.billingCycle);

  const msgPct = plan.includedRecoveryMessages
    ? Math.min(100, Math.round((usage.recoveryMessages / plan.includedRecoveryMessages) * 100))
    : 0;
  const minPct = plan.includedMinutes ? Math.min(100, Math.round((usage.minutes / plan.includedMinutes) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Plan and usage this cycle</p>
      </div>

      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-[var(--color-ink-faint)]">Current plan</div>
            <div className="text-lg font-semibold">
              {plan.label} · Mode {tenant.mode}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold tabular-nums">{inr(price)}</div>
            <div className="text-xs text-[var(--color-ink-faint)]">
              per {tenant.billingCycle === "annual" ? "year" : "month"}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <UsageCard
          label="Recovery messages"
          used={usage.recoveryMessages}
          included={plan.includedRecoveryMessages}
          percent={msgPct}
          overageNote={`Then ${inr(plan.overageMessagePaise / 100)} each`}
        />
        {plan.includedMinutes > 0 && (
          <UsageCard
            label="Call minutes"
            used={usage.minutes}
            included={plan.includedMinutes}
            percent={minPct}
            overageNote={`Then ${inr(plan.overageMinutePaise / 100)} / min`}
          />
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Invoices</h2>
        <p className="text-sm text-[var(--color-ink-soft)]">Invoices will appear here once billing is live.</p>
      </section>
    </div>
  );
}

function UsageCard({
  label,
  used,
  included,
  percent,
  overageNote,
}: {
  label: string;
  used: number;
  included: number;
  percent: number;
  overageNote: string;
}) {
  const over = used > included;
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-sm tabular-nums text-[var(--color-ink-soft)]">
          {used.toLocaleString("en-IN")} / {included.toLocaleString("en-IN")}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${over ? "bg-[var(--color-danger-600)]" : "bg-[var(--color-brand-600)]"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
        {over ? "Over the included amount. " : ""}
        {overageNote}
      </p>
    </div>
  );
}
