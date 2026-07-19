import { env } from "../env.js";

// Client for the EXISTING self-hosted WhatsApp platform's internal send API
// (spec §0.6). ITSolute Connect only decides WHEN and WHAT to send — it does not
// re-implement the Meta Cloud API. This file is the single integration point.
//
// ── REAL CONTRACT (verified against whatsapp-platform/src/routes/notify.js) ─────
//   POST {WA_PLATFORM_BASE_URL}/api/notify/custom
//   Header: x-webhook-secret: {WA_PLATFORM_SECRET}   (platform's INTERNAL_WEBHOOK_SECRET)
//   body: {
//     brand: string,          // the platform's BRAND SLUG, e.g. "cleanwarks"
//                             //   (NOT tenant.slug "clean-warks"; see WhatsAppSender.platformBrandSlug)
//     to: string,             // recipient number; platform strips non-digits
//     templateName: string,   // template must be approved on that WABA
//     variables: string[]     // body params {{1}}, {{2}}, ... (platform wraps into Meta components)
//   }
//   Note: the platform looks up the template's language itself (Template table,
//   default en_US) — a language we pass is ignored for template sends.
//
//   Response is ALWAYS HTTP 200 (even on WhatsApp failure). Body is the raw send
//   result:
//     success → { success: true,  data: { messaging_product, contacts, messages: [{ id: "wamid.*" }] } }
//     failure → { success: false, error: <Meta error object | string> }
//   The Meta message id (our wa_message_id) is data.messages[0].id.
//
// When WA_PLATFORM_BASE_URL is unset, the client runs in MOCK mode (dev).

export interface SendTemplateInput {
  /** The platform's brand slug (WhatsAppSender.platformBrandSlug), e.g. "cleanwarks". */
  brandSlug: string;
  /** Recipient (the missed caller); platform normalizes to bare digits. */
  to: string;
  templateName: string;
  /** Ordered body variables: {{1}}, {{2}}, ... */
  variables: string[];
}

export interface SendTemplateResult {
  waMessageId: string;
  mock?: boolean;
}

export class WaPlatformError extends Error {
  constructor(
    message: string,
    public opts: {
      httpStatus?: number;
      metaCode?: number;
      /** Recipient can't receive the message (not on WhatsApp / undeliverable). */
      recipientUnreachable?: boolean;
      body?: string;
    } = {},
  ) {
    super(message);
    this.name = "WaPlatformError";
  }
  get recipientUnreachable() {
    return this.opts.recipientUnreachable === true;
  }
}

// Meta error codes that mean the SEND itself won't reach the recipient — treat
// as a terminal failure (no retry), surfaced as not_on_whatsapp. Note: the
// definitive "not on WhatsApp" signal usually arrives later as a FAILED status
// webhook (code 131026); these cover the cases Meta rejects at send time.
const RECIPIENT_UNREACHABLE_CODES = new Set([
  131026, // message undeliverable
  131030, // recipient not in allowed list
  131047, // re-engagement required (24h window)
  131051, // unsupported message type
  1013, // recipient not a valid WhatsApp user
]);

function classifyMetaError(error: unknown): { code?: number; unreachable: boolean } {
  // error can be Meta's object ({ error: { code, message } } or { code, message })
  // or a plain string. Normalize enough to classify.
  let code: number | undefined;
  let text = "";
  if (typeof error === "string") {
    text = error.toLowerCase();
  } else if (error && typeof error === "object") {
    const inner = (error as any).error ?? error;
    code = typeof inner.code === "number" ? inner.code : undefined;
    text = JSON.stringify(error).toLowerCase();
  }
  const unreachable =
    (code !== undefined && RECIPIENT_UNREACHABLE_CODES.has(code)) ||
    text.includes("not a whatsapp") ||
    text.includes("not_on_whatsapp") ||
    text.includes("not registered");
  return { code, unreachable };
}

export async function sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
  if (!env.waPlatformBaseUrl) {
    const waMessageId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(
      `[wa:mock] would send template="${input.templateName}" to=${input.to} ` +
        `brand=${input.brandSlug} vars=${JSON.stringify(input.variables)} → ${waMessageId}`,
    );
    return { waMessageId, mock: true };
  }

  const url = env.waPlatformBaseUrl.replace(/\/$/, "") + env.waPlatformSendPath;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.waPlatformSecret ? { "x-webhook-secret": env.waPlatformSecret } : {}),
    },
    body: JSON.stringify({
      brand: input.brandSlug,
      to: input.to,
      templateName: input.templateName,
      variables: input.variables,
    }),
  });

  const text = await res.text();

  // HTTP-level failure (bad secret 401, unknown brand 400, 5xx). Not a Meta
  // send-result — throw for retry/inspection.
  if (!res.ok) {
    throw new WaPlatformError(`WA platform HTTP ${res.status}`, {
      httpStatus: res.status,
      body: text,
    });
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new WaPlatformError("WA platform returned non-JSON body", { body: text });
  }

  if (json?.success === true) {
    const waMessageId: string | undefined = json?.data?.messages?.[0]?.id;
    if (!waMessageId) {
      throw new WaPlatformError("WA platform success but no message id", { body: text });
    }
    return { waMessageId };
  }

  // success === false → Meta send error. Classify recipient-unreachable so the
  // worker can mark not_on_whatsapp instead of retrying forever.
  const { code, unreachable } = classifyMetaError(json?.error);
  throw new WaPlatformError("WA platform send failed", {
    metaCode: code,
    recipientUnreachable: unreachable,
    body: text,
  });
}
