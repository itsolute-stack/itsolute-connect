import Link from "next/link";

export function OnboardingBanner({ callsDone, whatsappDone }: { callsDone: boolean; whatsappDone: boolean }) {
  const remaining = [!callsDone && "call forwarding", !whatsappDone && "WhatsApp"].filter(Boolean);
  return (
    <Link
      href="/onboarding"
      className="card flex items-center justify-between gap-3 border-[var(--color-brand-600)]/20 bg-[var(--color-brand-50)] px-5 py-3.5 transition-colors hover:bg-[var(--color-brand-100)]"
    >
      <div className="text-sm">
        <span className="font-semibold text-[var(--color-brand-700)]">Finish setting up</span>
        <span className="text-[var(--color-ink-soft)]"> — {remaining.join(" and ")} left to go.</span>
      </div>
      <span className="shrink-0 text-sm font-medium text-[var(--color-brand-700)]">Continue →</span>
    </Link>
  );
}
