import Link from "next/link";
import { requireTenantSession } from "@/lib/session";
import { getTenant, getWhatsAppSender, getPlivoNumber } from "@/lib/queries";
import { WhatsAppHealth } from "@/components/pills";
import { ProfileForm } from "@/components/ProfileForm";
import { ForwardingGuide } from "@/components/ForwardingGuide";
import { plans } from "@itsolute/db";

export default async function SettingsPage() {
  const session = await requireTenantSession();
  const [tenant, sender, plivo] = await Promise.all([
    getTenant(session.tenantId),
    getWhatsAppSender(session.tenantId),
    getPlivoNumber(session.tenantId),
  ]);
  if (!tenant) return null;
  const plan = plans.planFor(tenant.plan);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Manage your business and connections</p>
      </div>

      <Section title="Business profile">
        <ProfileForm
          brandName={tenant.brandName}
          avgJobValue={tenant.avgJobValue}
          bookingUrl={tenant.bookingUrl ?? ""}
        />
      </Section>

      <Section title="WhatsApp connection">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {sender ? (
              <>
                <div className="font-medium">{sender.displayE164}</div>
                <div className="text-[var(--color-ink-faint)]">{sender.displayName ?? "Business name pending"}</div>
              </>
            ) : (
              <div className="text-[var(--color-ink-soft)]">No WhatsApp number connected yet.</div>
            )}
          </div>
          <WhatsAppHealth status={sender?.status} quality={sender?.qualityRating} />
        </div>
        <p className="mt-3 text-xs text-[var(--color-ink-faint)]">
          Recovery messages are sent from your own WhatsApp Business number so customers recognise you.
        </p>
      </Section>

      <Section title="Call forwarding">
        {plivo ? (
          <ForwardingGuide plivoNumber={plivo.e164} />
        ) : (
          <p className="text-sm text-[var(--color-ink-soft)]">
            Your calling number is being provisioned. Once ready, you’ll set up call forwarding here.
          </p>
        )}
      </Section>

      <Section title="Plan & mode">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <div className="font-medium">
              {plan.label} · Mode {tenant.mode}
            </div>
            <div className="text-[var(--color-ink-faint)]">
              {tenant.mode === "A" ? "Missed-call recovery" : "Full call routing + recovery"}
            </div>
          </div>
          <Link href="/billing" className="text-sm font-medium text-[var(--color-brand-700)]">
            Manage plan →
          </Link>
        </div>
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
