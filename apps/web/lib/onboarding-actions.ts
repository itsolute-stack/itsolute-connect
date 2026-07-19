"use server";

import { requireTenantSession } from "./session";
import { checkRecentTestCall } from "./onboarding";

export type TestCallState =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "found"; recovery: string | null };

// Checks whether a test call reached the tenant's Plivo number in the last while.
export async function checkTestCallAction(): Promise<TestCallState> {
  const session = await requireTenantSession();
  const result = await checkRecentTestCall(session.tenantId);
  if (!result.found) return { status: "waiting" };
  return { status: "found", recovery: result.recovery };
}
