// Minimal Plivo XML builders. Plivo answers a call by fetching XML from the
// answer URL; we only need Speak + Hangup for Mode A.

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Speak a branded line, then hang up (Mode A: the caller already missed us). */
export function speakThenHangup(text: string, language = "en-IN"): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Response>\n` +
    `  <Speak language="${escapeXml(language)}" voice="Polly.Aditi">${escapeXml(text)}</Speak>\n` +
    `  <Hangup/>\n` +
    `</Response>`
  );
}

/** Bare hangup — used for unknown/unprovisioned numbers. */
export function hangup(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Hangup/>\n</Response>`;
}

// ── Mode B (Front Desk) ──────────────────────────────────────────────────────

/** IVR menu: speak a prompt and collect one DTMF digit, POSTing it to `action`. */
export function ivrMenu(prompt: string, action: string, language = "en-IN"): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Response>\n` +
    `  <GetDigits action="${escapeXml(action)}" method="POST" numDigits="1" timeout="7" retries="1">\n` +
    `    <Speak language="${escapeXml(language)}" voice="Polly.Aditi">${escapeXml(prompt)}</Speak>\n` +
    `  </GetDigits>\n` +
    `  <Speak language="${escapeXml(language)}" voice="Polly.Aditi">We didn't catch that. Goodbye.</Speak>\n` +
    `  <Hangup/>\n` +
    `</Response>`
  );
}

/**
 * Ring one staff number; when that leg ends Plivo POSTs the result to `action`
 * (which decides whether to hunt to the next number). Optionally records.
 */
export function dialStaff(
  numberE164: string,
  action: string,
  opts: { timeoutSec?: number; record?: boolean; callerId?: string } = {},
): string {
  const attrs = [
    `action="${escapeXml(action)}"`,
    `method="POST"`,
    `timeout="${opts.timeoutSec ?? 20}"`,
    ...(opts.callerId ? [`callerId="${escapeXml(opts.callerId)}"`] : []),
    ...(opts.record ? [`record="true"`, `redirect="false"`] : []),
  ].join(" ");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Response>\n` +
    `  <Dial ${attrs}>\n` +
    `    <Number>${escapeXml(numberE164)}</Number>\n` +
    `  </Dial>\n` +
    `</Response>`
  );
}
