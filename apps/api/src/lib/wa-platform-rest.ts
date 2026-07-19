import { env } from "../env.js";

// Authenticated REST client for the WhatsApp platform, used only by the
// reconciliation poll. The platform's read endpoints require a JWT obtained via
// POST /api/auth/login; we cache the token and re-login on 401.

export interface PlatformContact {
  id: string;
  waId: string;
  name?: string | null;
}
export interface PlatformMessage {
  id: string;
  waMessageId: string | null;
  direction: "INBOUND" | "OUTBOUND";
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  body: string | null;
  sentAt: string;
}
export interface PlatformConversation {
  id: string;
  contact: PlatformContact;
  lastMessageAt: string | null;
}

let cachedToken: string | null = null;

function baseUrl() {
  if (!env.waPlatformBaseUrl) throw new Error("WA_PLATFORM_BASE_URL not set");
  return env.waPlatformBaseUrl.replace(/\/$/, "");
}

async function login(): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: env.waPlatformUserEmail,
      password: env.waPlatformUserPassword,
    }),
  });
  if (!res.ok) throw new Error(`WA platform login failed (${res.status})`);
  const json: any = await res.json();
  if (!json?.token) throw new Error("WA platform login returned no token");
  cachedToken = json.token;
  return json.token;
}

async function authedGet<T>(path: string): Promise<T> {
  const token = cachedToken ?? (await login());
  const doFetch = (t: string) =>
    fetch(`${baseUrl()}${path}`, { headers: { authorization: `Bearer ${t}` } });

  let res = await doFetch(token);
  if (res.status === 401) {
    // token expired — re-login once
    res = await doFetch(await login());
  }
  if (!res.ok) throw new Error(`WA platform GET ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

/** One page of conversations for a brand, newest activity first. */
export function listConversations(brandSlug: string, page = 1) {
  return authedGet<{ conversations: PlatformConversation[]; total: number; pages: number }>(
    `/api/conversations?brand=${encodeURIComponent(brandSlug)}&page=${page}`,
  );
}

export function getConversationMessages(conversationId: string) {
  return authedGet<{ messages: PlatformMessage[] }>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
  );
}

/** Test seam. */
export function _resetToken() {
  cachedToken = null;
}
