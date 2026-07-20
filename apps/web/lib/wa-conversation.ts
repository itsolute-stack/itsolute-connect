// Fetch a customer's WhatsApp conversation (the actual message text) from the
// self-hosted platform's REST API, so it can be shown inside Connect — the
// customer only has Connect, never the platform's own dashboard.
//
// Needs WA_PLATFORM_BASE_URL + a platform login (WA_PLATFORM_USER_EMAIL/PASSWORD)
// on the web env. Resilient: returns { ok:false } on any failure so a page never
// 500s just because the platform is unreachable.

export interface ConversationMessage {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  body: string | null;
  sentAt: string;
}
export interface ConversationResult {
  ok: boolean;
  messages: ConversationMessage[];
  error?: string;
}

const onlyDigits = (s: string) => s.replace(/[^\d]/g, "");
let cachedToken: string | null = null;

function base(): string | null {
  return process.env.WA_PLATFORM_BASE_URL ? process.env.WA_PLATFORM_BASE_URL.replace(/\/$/, "") : null;
}

async function login(b: string): Promise<string | null> {
  try {
    const res = await fetch(`${b}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: process.env.WA_PLATFORM_USER_EMAIL,
        password: process.env.WA_PLATFORM_USER_PASSWORD,
      }),
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    return j?.token ?? null;
  } catch {
    return null;
  }
}

async function authedGet<T>(b: string, path: string): Promise<T | null> {
  let token = cachedToken ?? (await login(b));
  if (!token) return null;
  const call = (t: string) => fetch(`${b}${path}`, { headers: { authorization: `Bearer ${t}` }, cache: "no-store" });
  let res = await call(token);
  if (res.status === 401) {
    token = await login(b);
    if (!token) return null;
    cachedToken = token;
    res = await call(token);
  } else {
    cachedToken = token;
  }
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** The full thread with a caller for a brand, oldest → newest. */
export async function getConversation(brandSlug: string, callerE164: string): Promise<ConversationResult> {
  const b = base();
  if (!b) return { ok: false, messages: [], error: "WhatsApp platform not configured." };
  if (!process.env.WA_PLATFORM_USER_EMAIL) return { ok: false, messages: [], error: "Platform login not configured." };

  const wanted = onlyDigits(callerE164);

  // Find the caller's conversation for this brand (newest activity first).
  let convoId: string | null = null;
  for (let page = 1; page <= 5 && !convoId; page++) {
    const data = await authedGet<{ conversations: { id: string; contact: { waId: string } }[]; pages: number }>(
      b,
      `/api/conversations?brand=${encodeURIComponent(brandSlug)}&page=${page}`,
    );
    if (!data) return { ok: false, messages: [], error: "Could not reach WhatsApp platform." };
    const match = data.conversations.find((c) => onlyDigits(c.contact?.waId ?? "") === wanted);
    if (match) convoId = match.id;
    if (page >= data.pages) break;
  }
  if (!convoId) return { ok: true, messages: [] }; // no conversation yet (no reply)

  const msgs = await authedGet<{ messages: ConversationMessage[] }>(b, `/api/conversations/${convoId}/messages`);
  if (!msgs) return { ok: false, messages: [], error: "Could not load messages." };
  return { ok: true, messages: msgs.messages };
}
