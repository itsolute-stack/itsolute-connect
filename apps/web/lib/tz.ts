// Compute the current-month range in a tenant's timezone, returned as UTC
// Date bounds for querying. No date library (India has no DST).

function tzOffsetMs(timeZone: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +(p.hour === "24" ? 0 : p.hour), +p.minute, +p.second);
  return asUTC - date.getTime();
}

export interface MonthRange {
  start: Date;
  end: Date;
  label: string;
}

export function currentMonthRange(timeZone: string, now: Date = new Date()): MonthRange {
  const offset = tzOffsetMs(timeZone, now);
  // Tenant-local Y/M of "now".
  const local = new Date(now.getTime() + offset);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  // Local midnight on the 1st, converted back to a real UTC instant.
  const start = new Date(Date.UTC(y, m, 1) - offset);
  const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
  return { start, end: now, label };
}
