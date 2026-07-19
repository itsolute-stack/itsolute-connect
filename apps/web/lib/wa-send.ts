// Send a free-text WhatsApp message via the existing platform's internal API.
// Valid only inside the 24h customer-service window (i.e. after the customer
// has replied) — outside it, Meta requires a template and the platform returns
// success:false. Requires WA_PLATFORM_BASE_URL + WA_PLATFORM_SECRET on the web env.

export interface SendTextResult {
  ok: boolean;
  error?: string;
}

export async function sendWhatsAppText(
  brandSlug: string,
  to: string,
  message: string,
): Promise<SendTextResult> {
  const base = process.env.WA_PLATFORM_BASE_URL;
  if (!base) return { ok: false, error: "WhatsApp platform not configured (WA_PLATFORM_BASE_URL)." };
  const path = process.env.WA_PLATFORM_SEND_PATH || "/api/notify/custom";

  let res: Response;
  try {
    res = await fetch(base.replace(/\/$/, "") + path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.WA_PLATFORM_SECRET ? { "x-webhook-secret": process.env.WA_PLATFORM_SECRET } : {}),
      },
      body: JSON.stringify({ brand: brandSlug, to, message }),
    });
  } catch (e) {
    return { ok: false, error: `Could not reach WhatsApp platform: ${(e as Error).message}` };
  }

  const text = await res.text();
  if (!res.ok) return { ok: false, error: `WhatsApp platform returned HTTP ${res.status}.` };

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "Unexpected response from WhatsApp platform." };
  }
  if (json?.success === true) return { ok: true };
  return { ok: false, error: "Message not sent — the 24h reply window may have closed." };
}
