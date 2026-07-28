import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantAdmin, getTenantMonthUsage } from "@/lib/admin-queries";
import { EditTenantForm, AssignNumberForm, LinkWabaForm, RecoveryTemplateForm } from "@/components/admin/TenantForms";
import { WhatsAppHealth, CallStatusPill, RecoveryStatusPill } from "@/components/pills";
import { plans } from "@itsolute/db";
import { inr, dateTime, phoneDisplay } from "@/lib/format";

function secs(n: number) {
  if (!n) return "—";
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

export default async function AdminTenantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenantAdmin(id);
  if (!tenant) notFound();

  const sender = tenant.whatsappSenders[0] ?? null;
  const number = tenant.plivoNumbers[0] ?? null;
  const plan = plans.planFor(tenant.plan);
  const isModeB = tenant.mode === "B";
  const usage = await getTenantMonthUsage(tenant.id, tenant.timezone);
  const recoveryTemplate =
    tenant.templates.find((t) => t.name === "recovery_default_en") ??
    tenant.templates.find((t) => t.category === "utility") ??
    null;

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-medium text-[var(--color-brand-700)]">
        ← All tenants
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{tenant.brandName}</h1>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
            {tenant.slug} · {plan.label} · Mode {tenant.mode} · {inr(plan.monthly)}/mo
          </p>
        </div>
        <WhatsAppHealth status={sender?.status} quality={sender?.qualityRating} />
      </div>

      <Section title="Plan & mode">
        <EditTenantForm
          id={tenant.id}
          mode={tenant.mode}
          plan={tenant.plan}
          status={tenant.status}
          billingCycle={tenant.billingCycle}
          onboardingFee={tenant.onboardingFee}
          aiEnabled={tenant.aiEnabled}
          callLogSheetId={tenant.callLogSheetId}
        />
      </Section>

      <Section title="Plivo number">
        {number && (
          <p className="mb-3 text-sm">
            Current: <span className="font-medium">{number.e164}</span>{" "}
            <span className="text-[var(--color-ink-faint)]">({number.status})</span>
          </p>
        )}
        <AssignNumberForm tenantId={tenant.id} current={number?.e164} />
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          Enter a Plivo number you already own (buy it in the Plivo console first). This creates the Plivo
          Application pointed at our webhooks, assigns the number to it, and records it — full provisioning,
          no CLI needed. Returns the new Plivo Application ID on success.
        </p>
      </Section>

      <Section title="WhatsApp sender (own WABA)">
        <LinkWabaForm tenantId={tenant.id} sender={sender} />
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          Enter the platform brand slug (e.g. <code>cleanwarks</code>) and click <strong>Fetch from platform</strong> — it
          pulls the WhatsApp number, display name, phone number ID, WABA ID and quality from the platform DB + live Meta
          (no Meta copy-paste). Sending and ingestion key off the brand slug; the Meta IDs are informational. External
          tenants later use Embedded Signup (provider <code>embedded</code>) after Meta Tech Provider approval.
        </p>
      </Section>

      <Section title="Recovery template">
        <RecoveryTemplateForm
          tenantId={tenant.id}
          hasSender={Boolean(sender?.platformBrandSlug)}
          currentStatus={recoveryTemplate?.status ?? null}
        />
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          One <code>utility</code> template is all a tenant needs for missed-call recovery. This submits it to Meta for
          you (via the WhatsApp platform) and records it here — no more doing it by hand. Link WhatsApp first; the
          template goes under that brand&apos;s WABA. It sends live once Meta shows <strong>approved</strong> (usually
          minutes–hours) — use <strong>Refresh status</strong> to re-check.
        </p>
      </Section>

      <Section title="Plan details & usage this month">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Plan" value={`${plan.label} (Mode ${tenant.mode})`} />
          <Fact label="Price" value={`${inr(plan.monthly)}/mo · ${tenant.billingCycle}`} />
          <Fact label="Status" value={tenant.status} />
          <Fact label="Onboarding fee" value={tenant.onboardingFee ? inr(tenant.onboardingFee) : "—"} />
          <Fact label="Messages" value={`${usage.messages} / ${plan.includedRecoveryMessages}`} />
          <Fact
            label="Minutes"
            value={isModeB ? `${usage.minutes} / ${plan.includedMinutes}` : "— (Mode A)"}
          />
          <Fact label="Recording" value={tenant.recordCalls ? "on" : "off"} />
          <Fact label="Timezone" value={tenant.timezone} />
        </div>
      </Section>

      <Section title={`Recent calls (${tenant.calls.length})`}>
        {tenant.calls.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">No calls yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                  <Th>Time</Th>
                  <Th>Caller</Th>
                  <Th>Status</Th>
                  <Th right>Duration</Th>
                  {isModeB && <Th right>Billable</Th>}
                  <Th>Recording</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {tenant.calls.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 text-[var(--color-ink-soft)]">{dateTime(c.startedAt, tenant.timezone)}</td>
                    <td className="px-3 py-2 tabular-nums">{phoneDisplay(c.callerE164)}</td>
                    <td className="px-3 py-2">
                      <CallStatusPill status={c.status} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{secs(c.durationSec)}</td>
                    {isModeB && <td className="px-3 py-2 text-right tabular-nums">{secs(c.billableSec)}</td>}
                    <td className="px-3 py-2">
                      {c.recordingUrl ? (
                        <a href={c.recordingUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--color-brand-700)]">
                          ▶ Recording
                        </a>
                      ) : (
                        <span className="text-[var(--color-ink-faint)]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Recovery messages (${tenant.recoveryMessages.length})`}>
        {tenant.recoveryMessages.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">No recovery messages yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                  <Th>Time</Th>
                  <Th>To</Th>
                  <Th>Status</Th>
                  <Th>Reason / note</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {tenant.recoveryMessages.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 text-[var(--color-ink-soft)]">{dateTime(m.createdAt, tenant.timezone)}</td>
                    <td className="px-3 py-2 tabular-nums">{phoneDisplay(m.callerE164)}</td>
                    <td className="px-3 py-2">
                      <RecoveryStatusPill status={m.status} />
                    </td>
                    <td className="px-3 py-2 text-[var(--color-ink-faint)]">{m.statusReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title={`Message templates (${tenant.templates.length})`}>
        {tenant.templates.length === 0 ? (
          <p className="text-sm text-[var(--color-ink-faint)]">No templates recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">
                  <Th>Name</Th>
                  <Th>Lang</Th>
                  <Th>Category</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-line)]">
                {tenant.templates.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2 font-mono text-xs">{t.name}</td>
                    <td className="px-3 py-2">{t.language}</td>
                    <td className={`px-3 py-2 ${t.category !== "utility" ? "text-amber-700" : ""}`}>{t.category}</td>
                    <td className="px-3 py-2">{t.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {isModeB && (
        <Section title="Front desk routing (Mode B)">
          <div className="mb-4">
            <h3 className="mb-2 text-xs font-medium text-[var(--color-ink-soft)]">Staff & ring order</h3>
            {tenant.staff.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-faint)]">
                No staff yet — the owner adds them in Call Management.
              </p>
            ) : (
              <ol className="list-decimal space-y-1 pl-6 text-sm">
                {tenant.staff.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{s.name}</span> · {phoneDisplay(s.e164)}
                    {!s.alertOnMissed && <span className="text-xs text-[var(--color-ink-faint)]"> (no missed-alert)</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium text-[var(--color-ink-soft)]">IVR menu</h3>
            {tenant.ivrNodes.length === 0 ? (
              <p className="text-sm text-[var(--color-ink-faint)]">No IVR — calls go straight to the staff hunt.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {tenant.ivrNodes.map((n) => (
                  <li key={n.id} className={n.parentId ? "pl-6" : "font-medium"}>
                    {n.key ? <code className="mr-1">[{n.key}]</code> : <span className="mr-1 text-[var(--color-ink-faint)]">▸ menu</span>}
                    {n.prompt} <span className="text-xs text-[var(--color-ink-faint)]">→ {n.action}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
            Read-only here. The tenant owner edits staff, ring order and the IVR in their own Call Management dashboard.
          </p>
        </Section>
      )}

      <Section title="Users">
        <ul className="divide-y divide-[var(--color-line)] text-sm">
          {tenant.users.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2">
              <span>{u.email}</span>
              <span className="text-xs text-[var(--color-ink-faint)]">{u.role}</span>
            </li>
          ))}
          {tenant.users.length === 0 && <li className="py-2 text-[var(--color-ink-faint)]">No users yet.</li>}
        </ul>
      </Section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 font-medium ${right ? "text-right" : ""}`}>{children}</th>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
