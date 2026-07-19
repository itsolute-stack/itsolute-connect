import Link from "next/link";
import { requireTenantSession } from "@/lib/session";
import { getTenant, getOverview, getWhatsAppSender } from "@/lib/queries";
import { getOnboarding } from "@/lib/onboarding";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { StatCard } from "@/components/StatCard";
import { TrendChart } from "@/components/TrendChart";
import { CallStatusPill, RecoveryStatusPill, WhatsAppHealth } from "@/components/pills";
import { inr, pct, phoneDisplay, relativeTime } from "@/lib/format";

export default async function OverviewPage() {
  const session = await requireTenantSession();
  const tenant = (await getTenant(session.tenantId))!;
  const [overview, sender, onboarding] = await Promise.all([
    getOverview(session.tenantId, tenant.timezone, tenant.avgJobValue),
    getWhatsAppSender(session.tenantId),
    getOnboarding(session.tenantId),
  ]);

  return (
    <div className="space-y-6">
      {!onboarding.complete && (
        <OnboardingBanner callsDone={onboarding.callsDone} whatsappDone={onboarding.whatsappDone} />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Overview</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {tenant.brandName} · {overview.periodLabel}
          </p>
        </div>
        <span className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)]">
          This month
        </span>
      </div>

      {/* HERO — the "is this making me money" metrics, leading the screen */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Missed calls" value={String(overview.missed)} sub="Calls we caught for you" />
        <StatCard
          label="Recovered"
          value={String(overview.recovered)}
          tone="money"
          sub="Turned into a conversation"
        />
        <StatCard label="Recovery rate" value={pct(overview.recoveryRate)} tone="brand" sub="Recovered ÷ missed" />
        <StatCard
          label="Est. revenue recovered"
          value={inr(overview.revenueRecovered)}
          tone="money"
          emphasis
          sub={`${overview.recovered} × ${inr(tenant.avgJobValue)} avg job`}
        />
      </section>

      {/* Trend + WhatsApp health */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="mb-1 text-sm font-semibold">Missed vs recovered</div>
          <p className="mb-4 text-xs text-[var(--color-ink-faint)]">Daily, this month</p>
          <TrendChart data={overview.trend} />
        </div>
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold">WhatsApp health</span>
            <WhatsAppHealth status={sender?.status} quality={sender?.qualityRating} />
          </div>
          {sender ? (
            <dl className="space-y-2.5 text-sm">
              <Row label="Sending number" value={sender.displayE164} />
              <Row label="Business name" value={sender.displayName ?? "—"} />
              <Row label="Quality rating" value={sender.qualityRating ?? "—"} />
            </dl>
          ) : (
            <div className="text-sm text-[var(--color-ink-soft)]">
              <p>No WhatsApp number connected yet.</p>
              <Link href="/settings" className="mt-2 inline-block font-medium text-[var(--color-brand-700)]">
                Connect WhatsApp →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Recent activity */}
      <section className="card">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3.5">
          <span className="text-sm font-semibold">Recent missed calls</span>
          <Link href="/calls" className="text-sm font-medium text-[var(--color-brand-700)]">
            View all
          </Link>
        </div>
        {overview.recentCalls.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[var(--color-ink-faint)]">
            No missed calls yet. When a call is missed, we’ll message the caller on WhatsApp automatically.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-line)]">
            {overview.recentCalls.map((call) => {
              const rec = call.recoveryMessages[0];
              return (
                <li key={call.id}>
                  <Link
                    href={`/calls/${call.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-black/[0.015]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{phoneDisplay(call.callerE164)}</div>
                      <div className="text-xs text-[var(--color-ink-faint)]">{relativeTime(call.startedAt)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {rec && <RecoveryStatusPill status={rec.status} />}
                      <CallStatusPill status={call.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--color-ink-faint)]">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
