import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantAdmin } from "@/lib/admin-queries";
import { EditTenantForm, AssignNumberForm, LinkWabaForm, RecoveryTemplateForm } from "@/components/admin/TenantForms";
import { WhatsAppHealth } from "@/components/pills";
import { plans } from "@itsolute/db";
import { inr } from "@/lib/format";

export default async function AdminTenantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tenant = await getTenantAdmin(id);
  if (!tenant) notFound();

  const sender = tenant.whatsappSenders[0] ?? null;
  const number = tenant.plivoNumbers[0] ?? null;
  const plan = plans.planFor(tenant.plan);
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
