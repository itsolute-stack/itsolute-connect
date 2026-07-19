"use server";

import { revalidatePath } from "next/cache";
import { prisma, plans } from "@itsolute/db";
import type { TenantMode, Plan, TenantStatus, BillingCycle } from "@itsolute/db";
import { requireAdminSession } from "./session";

const PLAN_IDS = Object.keys(plans.PLANS) as Plan[];

// Tenant CRUD: mode / plan / status / billing / onboarding fee (spec §8).
export async function updateTenantAction(_prev: unknown, formData: FormData) {
  await requireAdminSession();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing tenant id." };

  const mode = String(formData.get("mode")) as TenantMode;
  const plan = String(formData.get("plan")) as Plan;
  const status = String(formData.get("status")) as TenantStatus;
  const billingCycle = String(formData.get("billingCycle")) as BillingCycle;
  const onboardingFeeRaw = String(formData.get("onboardingFee") ?? "").trim();
  const aiEnabled = formData.get("aiEnabled") === "on";

  if (!["A", "B"].includes(mode)) return { error: "Invalid mode." };
  if (!PLAN_IDS.includes(plan)) return { error: "Invalid plan." };
  if (!["trial", "active", "paused"].includes(status)) return { error: "Invalid status." };

  // Guard: plan and mode must agree (recovery* = A, *front_desk = B).
  if (plans.planFor(plan).mode !== mode) {
    return { error: `Plan "${plans.planFor(plan).label}" runs in Mode ${plans.planFor(plan).mode}.` };
  }

  await prisma.tenant.update({
    where: { id },
    data: {
      mode,
      plan,
      status,
      billingCycle: ["monthly", "annual"].includes(billingCycle) ? billingCycle : "monthly",
      onboardingFee: onboardingFeeRaw ? Math.max(0, Math.round(Number(onboardingFeeRaw)) || 0) : null,
      aiEnabled,
    },
  });
  revalidatePath(`/admin/tenants/${id}`);
  revalidatePath("/admin");
  return { ok: true };
}

// Assign an existing Plivo number to a tenant (manual). The number's Plivo
// Application answer/hangup URLs are configured via the API provisioning service
// (needs Plivo credentials); this records the assignment.
export async function assignPlivoNumberAction(_prev: unknown, formData: FormData) {
  await requireAdminSession();
  const tenantId = String(formData.get("tenantId") ?? "");
  const e164 = String(formData.get("e164") ?? "").replace(/[^\d+]/g, "");
  const plivoAppId = String(formData.get("plivoAppId") ?? "").trim() || null;
  if (!tenantId || !/^\+\d{8,15}$/.test(e164)) return { error: "Enter a valid E.164 number (e.g. +912248123456)." };

  const existing = await prisma.plivoNumber.findUnique({ where: { e164 } });
  if (existing && existing.tenantId !== tenantId) return { error: "That number is assigned to another tenant." };

  await prisma.plivoNumber.upsert({
    where: { e164 },
    update: { tenantId, plivoAppId, status: "active" },
    create: { tenantId, e164, plivoAppId, status: "active" },
  });
  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

// Link a tenant's OWN WABA (provider 'own' — the Phase-1 path). Embedded Signup
// (provider 'embedded') activates for external tenants after Tech Provider approval.
export async function linkWhatsAppSenderAction(_prev: unknown, formData: FormData) {
  await requireAdminSession();
  const tenantId = String(formData.get("tenantId") ?? "");
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const wabaId = String(formData.get("wabaId") ?? "").trim() || null;
  const displayE164 = String(formData.get("displayE164") ?? "").replace(/[^\d+]/g, "");
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const platformBrandSlug = String(formData.get("platformBrandSlug") ?? "").trim() || null;
  if (!tenantId || !phoneNumberId || !/^\+\d{8,15}$/.test(displayE164)) {
    return { error: "Phone number ID and a valid WhatsApp number are required." };
  }

  const existing = await prisma.whatsAppSender.findFirst({ where: { tenantId } });
  const data = {
    provider: "own" as const,
    wabaId,
    phoneNumberId,
    displayE164,
    displayName,
    platformBrandSlug,
    status: "connected" as const,
    connectedAt: new Date(),
  };
  if (existing) await prisma.whatsAppSender.update({ where: { id: existing.id }, data });
  else await prisma.whatsAppSender.create({ data: { tenantId, ...data } });

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}
