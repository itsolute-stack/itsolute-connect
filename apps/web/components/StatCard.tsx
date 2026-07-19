type Tone = "default" | "money" | "brand";

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
  emphasis = false,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  emphasis?: boolean;
}) {
  const valueColor =
    tone === "money"
      ? "text-[var(--color-money-700)]"
      : tone === "brand"
        ? "text-[var(--color-brand-700)]"
        : "text-[var(--color-ink)]";

  return (
    <div
      className={`card p-5 ${emphasis ? "ring-1 ring-[var(--color-money-600)]/20 bg-[var(--color-money-50)]/40" : ""}`}
    >
      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">{label}</div>
      <div className={`mt-2 text-3xl font-semibold tabular-nums leading-none ${valueColor}`}>{value}</div>
      {sub && <div className="mt-2 text-xs text-[var(--color-ink-soft)]">{sub}</div>}
    </div>
  );
}
