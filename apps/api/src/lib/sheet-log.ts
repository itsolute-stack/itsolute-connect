import { JWT } from "google-auth-library";
import type { Tenant } from "@itsolute/db";
import { env } from "../env.js";

// Append a finished call to the tenant's Google Sheet via the Sheets API, using
// ONE shared service account (we own each sheet and share it read-only with the
// business — the service account has edit access). Best-effort and non-blocking:
// any failure is logged and swallowed so it never affects call handling.

export interface CallLogRow {
  time: string; // human-readable timestamp in the tenant's timezone
  caller: string;
  status: string; // missed | answered | recovered
  durationSec: number;
  billableSec: number;
  mode: string; // A | B
  callUuid?: string | null;
}

// One JWT client for the whole process; it caches and refreshes its own token.
let client: JWT | null = null;
function sheetsClient(): JWT | null {
  if (!env.googleSaEmail || !env.googleSaPrivateKey) return null;
  if (!client) {
    client = new JWT({
      email: env.googleSaEmail,
      key: env.googleSaPrivateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  return client;
}

export async function logCallToSheet(
  tenant: Pick<Tenant, "callLogSheetId" | "brandName">,
  row: CallLogRow,
): Promise<void> {
  const sheetId = tenant.callLogSheetId;
  if (!sheetId) return; // logging off for this tenant

  const jwt = sheetsClient();
  if (!jwt) {
    console.warn("[sheet] GOOGLE_SERVICE_ACCOUNT_* not configured — skipping call log");
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const { token } = await jwt.getAccessToken();
    if (!token) throw new Error("no access token from service account");

    // Append to the first sheet (range "A1" defaults to the first tab).
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}` +
      `/values/A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
    const values = [
      [row.time, row.caller, row.status, row.durationSec, row.billableSec, row.mode, row.callUuid ?? ""],
    ];

    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ values }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn(`[sheet] ${tenant.brandName}: Sheets append HTTP ${res.status} ${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn(`[sheet] ${tenant.brandName}: call-log post failed —`, (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}
