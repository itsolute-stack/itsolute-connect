// Lightweight inline SVG bar chart — daily missed (base) vs recovered (accent).
// No chart library (spec §7). Server-rendered.

export function TrendChart({ data }: { data: { date: string; missed: number; recovered: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-40 place-items-center text-sm text-[var(--color-ink-faint)]">
        No missed calls yet this month.
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.missed));
  const barW = 100 / data.length;

  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full">
        {data.map((d, i) => {
          const x = i * barW;
          const h = (d.missed / max) * 38;
          const rh = (d.recovered / max) * 38;
          const w = Math.max(0.5, barW * 0.62);
          const cx = x + barW / 2 - w / 2;
          return (
            <g key={d.date}>
              <rect x={cx} y={40 - h} width={w} height={h} rx="0.6" fill="#e2e8f0" />
              <rect x={cx} y={40 - rh} width={w} height={rh} rx="0.6" fill="var(--color-money-600)" />
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-ink-soft)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#e2e8f0]" /> Missed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--color-money-600)]" /> Recovered
        </span>
      </div>
    </div>
  );
}
