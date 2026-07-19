"use server";

import { revalidatePath } from "next/cache";
import { forTenant } from "@itsolute/db";
import { requireTenantSession } from "./session";
import { sendWhatsAppText } from "./wa-send";

// Reply to a missed caller on WhatsApp from the dashboard (two-way). Tenant is
// taken from the session; the message is sent from the tenant's own WABA.
export async function replyToCallerAction(_prev: unknown, formData: FormData) {
  const session = await requireTenantSession();
  const callId = String(formData.get("callId") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  if (!callId || !text) return { error: "Type a message first." };
  if (text.length > 1000) return { error: "Message too long." };

  const db = forTenant(session.tenantId);
  const call = await db.call.findFirst({ where: { id: callId } });
  if (!call) return { error: "Call not found." };

  const sender = await db.whatsAppSender.findFirst({ where: { status: "connected" } });
  if (!sender?.platformBrandSlug) return { error: "No connected WhatsApp number for this business." };

  const res = await sendWhatsAppText(sender.platformBrandSlug, call.callerE164, text);
  if (!res.ok) return { error: res.error ?? "Failed to send." };

  revalidatePath(`/calls/${callId}`);
  return { ok: true };
}
