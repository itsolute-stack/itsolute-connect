import Link from "next/link";
import { requireTenantSession } from "@/lib/session";
import { getTenant } from "@/lib/queries";
import { getOnboarding } from "@/lib/onboarding";
import { ForwardingGuide } from "@/components/ForwardingGuide";
import { TestCall } from "@/components/TestCall";
import { WhatsAppHealth } from "@/components/pills";

export default async function OnboardingPage() {
  const session = await requireTenantSession();
  const [tenant, ob] = await Promise.all([getTenant(session.tenantId), getOnboarding(session.tenantId)]);
  if (!tenant) return null;

  const callSteps = [ob.calls.numberAssigned, ob.calls.tested].filter(Boolean).length;
  const waSteps = [ob.whatsapp.connected, ob.whatsapp.templateApproved].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Get set up</h1>
        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">
          Two quick tracks. They’re independent — do them in any order.
        </p>
      </div>

      {ob.complete && (
        <div className="card flex items-center justify-between gap-3 border-[var(--color-money-600)]/30 bg-[var(--color-money-50)] p-5">
          <div>
            <div className="font-semibold text-[var(--color-money-700)]">You’re all set 🎉</div>
            <p className="text-sm text-[var(--color-ink-soft)]">Missed calls are now recovered automatically.</p>
          </div>
          <Link href="/" className="btn-primary px-4 py-2 text-sm">
            Go to dashboard
          </Link>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Track 1 — Calls */}
        <Track title="Calls" subtitle="Route missed calls to us" done={callSteps} total={2}>
          <Step done={ob.calls.numberAssigned} title="Your calling number">
            {ob.calls.numberAssigned ? (
              <p className="text-sm text-[var(--color-ink-soft)]">
                Assigned: <span className="font-medium text-[var(--color-ink)]">{ob.calls.number}</span>
              </p>
            ) : (
              <p className="text-sm text-[var(--color-ink-soft)]">
                We’re assigning your number — this usually takes a few minutes.
              </p>
            )}
          </Step>

          <Step done={ob.calls.numberAssigned && ob.calls.tested} title="Set call forwarding">
            {ob.calls.number ? (
              <ForwardingGuide plivoNumber={ob.calls.number} />
            ) : (
              <p className="text-sm text-[var(--color-ink-faint)]">Available once your number is assigned.</p>
            )}
          </Step>

          <Step done={ob.calls.tested} title="Test it" last>
            {ob.calls.number ? (
              <TestCall number={ob.calls.number} alreadyTested={ob.calls.tested} />
            ) : (
              <p className="text-sm text-[var(--color-ink-faint)]">Available once your number is assigned.</p>
            )}
          </Step>
        </Track>

        {/* Track 2 — WhatsApp */}
        <Track title="WhatsApp" subtitle="Send from your own number" done={waSteps} total={2}>
          <Step done={ob.whatsapp.connected} title="Connect WhatsApp">
            {ob.whatsapp.connected ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-[var(--color-ink-soft)]">
                  Connected:{" "}
                  <span className="font-medium text-[var(--color-ink)]">{ob.whatsapp.sender?.displayE164}</span>
                </p>
                <WhatsAppHealth status={ob.whatsapp.sender?.status} quality={ob.whatsapp.sender?.qualityRating} />
              </div>
            ) : (
              <div>
                <button className="btn-primary px-4 py-2 text-sm" disabled>
                  Connect WhatsApp
                </button>
                <p className="mt-2 text-xs text-[var(--color-ink-faint)]">
                  Recovery messages send from your own WhatsApp Business number so customers recognise you. For our
                  own businesses we connect this for you; self-serve signup activates after Meta Tech Provider approval.
                </p>
              </div>
            )}
          </Step>

          <Step done={ob.whatsapp.templateApproved} title="Recovery message approved">
            <p className="text-sm text-[var(--color-ink-soft)]">
              {ob.whatsapp.templateApproved
                ? "Your utility recovery template is approved and ready to send."
                : "We’ll submit your recovery template for approval on your WhatsApp number."}
            </p>
          </Step>

          <Step done={ob.whatsapp.connected} title="WhatsApp health" last>
            {ob.whatsapp.connected ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[var(--color-ink-soft)]">Quality rating:</span>
                <span className="font-medium">{ob.whatsapp.sender?.qualityRating ?? "—"}</span>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-ink-faint)]">Shows once WhatsApp is connected.</p>
            )}
          </Step>
        </Track>
      </div>
    </div>
  );
}

function Track({
  title,
  subtitle,
  done,
  total,
  children,
}: {
  title: string;
  subtitle: string;
  done: number;
  total: number;
  children: React.ReactNode;
}) {
  const pct = Math.round((done / total) * 100);
  return (
    <section className="card p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-[var(--color-ink-faint)]">
          {done}/{total} done
        </span>
      </div>
      <p className="mb-3 text-xs text-[var(--color-ink-faint)]">{subtitle}</p>
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[var(--color-money-600)]" style={{ width: `${pct}%` }} />
      </div>
      <div>{children}</div>
    </section>
  );
}

function Step({
  done,
  title,
  last = false,
  children,
}: {
  done: boolean;
  title: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative pl-8 ${last ? "" : "pb-6"}`}>
      {!last && <span className="absolute left-[11px] top-6 h-full w-px bg-[var(--color-line)]" />}
      <span
        className={`absolute left-0 top-0.5 grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
          done ? "bg-[var(--color-money-600)] text-white" : "border border-[var(--color-line)] bg-white text-[var(--color-ink-faint)]"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <div className="mb-2 text-sm font-medium">{title}</div>
      {children}
    </div>
  );
}
