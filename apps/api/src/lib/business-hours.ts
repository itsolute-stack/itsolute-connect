// Quiet-hours math in a tenant's local timezone, without a date library.
// We read the tenant-local wall clock via Intl and work in minutes-of-day.
//
// Note: this assumes the local UTC offset is stable across the deferral window
// (true for India / IST, which has no DST). When we expand to DST timezones,
// swap in a tz-aware date library for msUntilWindowOpen.

export interface MessagingWindow {
  startMin: number; // minutes-of-day, inclusive
  endMin: number; // minutes-of-day, exclusive
}

/** Tenant-local seconds since midnight for a given instant. */
function localSecondsOfDay(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  let hour = get("hour");
  if (hour === 24) hour = 0; // some environments render midnight as 24
  return hour * 3600 + get("minute") * 60 + get("second");
}

/** Tenant-local calendar date as an ISO YYYY-MM-DD string. */
export function localDateYmd(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isWithinMessagingWindow(
  now: Date,
  timeZone: string,
  window: MessagingWindow,
): boolean {
  const sec = localSecondsOfDay(now, timeZone);
  const startSec = window.startMin * 60;
  const endSec = window.endMin * 60;
  return sec >= startSec && sec < endSec;
}

/**
 * Milliseconds until the window next opens. 0 if already open. If we're past
 * today's close, it rolls to tomorrow's open.
 */
export function msUntilWindowOpen(
  now: Date,
  timeZone: string,
  window: MessagingWindow,
): number {
  const sec = localSecondsOfDay(now, timeZone);
  const startSec = window.startMin * 60;
  const endSec = window.endMin * 60;

  if (sec >= startSec && sec < endSec) return 0;

  const daySec = 24 * 3600;
  const secsUntilOpen = sec < startSec ? startSec - sec : daySec - sec + startSec;
  return secsUntilOpen * 1000;
}
