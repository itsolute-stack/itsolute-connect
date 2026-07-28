import type { Tenant } from "@itsolute/db";

// Append a finished call to the tenant's own Google Sheet via its Apps Script
// web-app URL (tenant.callLogWebhookUrl). Best-effort and non-blocking: any
// failure is logged and swallowed so it never affects call handling. No Google
// auth — the operator owns each sheet + script and shares it with the tenant.

export interface CallLogRow {
  time: string; // human-readable timestamp in the tenant's timezone
  caller: string;
  status: string; // missed | answered | recovered
  durationSec: number;
  billableSec: number;
  mode: string; // A | B
  callUuid?: string | null;
}

export async function logCallToSheet(
  tenant: Pick<Tenant, "callLogWebhookUrl" | "brandName">,
  row: CallLogRow,
): Promise<void> {
  const url = tenant.callLogWebhookUrl;
  if (!url) return; // logging off for this tenant

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brand: tenant.brandName, ...row }),
      signal: controller.signal,
      // Apps Script web apps 302-redirect to their content host; follow it.
      redirect: "follow",
    });
    if (!res.ok) console.warn(`[sheet] ${tenant.brandName}: webhook returned HTTP ${res.status}`);
  } catch (e) {
    console.warn(`[sheet] ${tenant.brandName}: call-log post failed —`, (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
