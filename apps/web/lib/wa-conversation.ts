// Fetch a customer's WhatsApp conversation (the actual message text) from the
// self-hosted platform's REST API, so it can be shown inside Connect — the
// customer only has Connect, never the platform's own dashboard.
//
// Needs WA_PLATFORM_BASE_URL + a platform login (WA_PLATFORM_USER_EMAIL/PASSWORD)
// on the web env. Resilient: returns { ok:false } on any failure so a page never
// 500s just because the platform is unreachable. Auth/transport is shared with
// the template automation via wa-platform-client.

import { waBase, waLoginConfigured, authedGetJson } from "./wa-platform-client";

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

/** The full thread with a caller for a brand, oldest → newest. */
export async function getConversation(brandSlug: string, callerE164: string): Promise<ConversationResult> {
  if (!waBase()) return { ok: false, messages: [], error: "WhatsApp platform not configured." };
  if (!waLoginConfigured()) return { ok: false, messages: [], error: "Platform login not configured." };

  const wanted = onlyDigits(callerE164);

  // Find the caller's conversation for this brand (newest activity first).
  let convoId: string | null = null;
  for (let page = 1; page <= 5 && !convoId; page++) {
    const data = await authedGetJson<{ conversations: { id: string; contact: { waId: string } }[]; pages: number }>(
      `/api/conversations?brand=${encodeURIComponent(brandSlug)}&page=${page}`,
    );
    if (!data) return { ok: false, messages: [], error: "Could not reach WhatsApp platform." };
    const match = data.conversations.find((c) => onlyDigits(c.contact?.waId ?? "") === wanted);
    if (match) convoId = match.id;
    if (page >= data.pages) break;
  }
  if (!convoId) return { ok: true, messages: [] }; // no conversation yet (no reply)

  const msgs = await authedGetJson<{ messages: ConversationMessage[] }>(`/api/conversations/${convoId}/messages`);
  if (!msgs) return { ok: false, messages: [], error: "Could not load messages." };
  return { ok: true, messages: msgs.messages };
}
