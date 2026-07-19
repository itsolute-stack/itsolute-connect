// Display helpers. Rupees are stored as whole rupees (avg_job_value etc.).

export function inr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function phoneDisplay(e164: string): string {
  // +919812345678 → +91 98123 45678 (best-effort for India)
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  if (m) return `+91 ${m[1]} ${m[2]}`;
  return e164;
}

export function relativeTime(d: Date | string, now: Date = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = now.getTime() - date.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function dateTime(d: Date | string, timeZone: string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-IN", {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
