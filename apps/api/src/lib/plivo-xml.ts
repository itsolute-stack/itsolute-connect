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

/**
 * The audible element for an IVR prompt: an uploaded greeting (<Play>) when the
 * node has an audio URL, otherwise TTS (<Speak>) of the typed prompt. Keeping
 * this in one place means every node type (menu, ring greeting, voicemail,
 * hangup) plays audio consistently when one is uploaded.
 */
function promptTag(text: string, audioUrl: string | undefined, language: string): string {
  if (audioUrl) return `<Play>${escapeXml(audioUrl)}</Play>`;
  return `<Speak language="${escapeXml(language)}" voice="Polly.Aditi">${escapeXml(text)}</Speak>`;
}

/** Play/speak a node's prompt, then hang up (voicemail / hangup IVR actions). */
export function promptThenHangup(text: string, audioUrl?: string, language = "en-IN"): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Response>\n` +
    `  ${promptTag(text, audioUrl, language)}\n` +
    `  <Hangup/>\n` +
    `</Response>`
  );
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

/**
 * IVR menu: play/speak a prompt and collect one DTMF digit, POSTing it to
 * `action`. Plays an uploaded greeting (<Play>) when `opts.audioUrl` is set,
 * otherwise speaks the typed prompt.
 */
export function ivrMenu(
  prompt: string,
  action: string,
  opts: { audioUrl?: string; language?: string } = {},
): string {
  const language = opts.language ?? "en-IN";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Response>\n` +
    `  <GetDigits action="${escapeXml(action)}" method="POST" numDigits="1" timeout="7" retries="1">\n` +
    `    ${promptTag(prompt, opts.audioUrl, language)}\n` +
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
  opts: {
    timeoutSec?: number;
    record?: boolean;
    callerId?: string;
    speakBefore?: string;
    audioBefore?: string;
    language?: string;
  } = {},
): string {
  const attrs = [
    `action="${escapeXml(action)}"`,
    `method="POST"`,
    `timeout="${opts.timeoutSec ?? 20}"`,
    ...(opts.callerId ? [`callerId="${escapeXml(opts.callerId)}"`] : []),
    ...(opts.record ? [`record="true"`, `redirect="false"`] : []),
  ].join(" ");
  // Optionally play/speak a greeting (a ring_staff node's prompt) before dialing.
  const greet =
    opts.audioBefore || opts.speakBefore
      ? `  ${promptTag(opts.speakBefore ?? "", opts.audioBefore, opts.language ?? "en-IN")}\n`
      : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Response>\n` +
    greet +
    `  <Dial ${attrs}>\n` +
    `    <Number>${escapeXml(numberE164)}</Number>\n` +
    `  </Dial>\n` +
    `</Response>`
  );
}
