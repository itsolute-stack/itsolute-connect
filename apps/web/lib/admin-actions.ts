"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma, plans } from "@itsolute/db";
import type { TenantMode, Plan, TenantStatus, BillingCycle } from "@itsolute/db";
import { createUser, SESSION_COOKIE } from "@itsolute/auth";
import { requireAdminSession } from "./session";

const PLAN_IDS = Object.keys(plans.PLANS) as Plan[];

// Default business hours (IST) — drives quiet-hours defaults.
const DEFAULT_BUSINESS_HOURS = {
  mon: { open: "09:00", close: "19:00" },
  tue: { open: "09:00", close: "19:00" },
  wed: { open: "09:00", close: "19:00" },
  thu: { open: "09:00", close: "19:00" },
  fri: { open: "09:00", close: "19:00" },
  sat: { open: "09:00", close: "19:00" },
  sun: null,
};

// Create a new tenant (spec §8 — the "C" of Tenant CRUD), optionally with an
// owner login so the business can sign in immediately. Mode is derived from the
// plan so they can't disagree.
export async function createTenantAction(_prev: unknown, formData: FormData) {
  await requireAdminSession();

  const brandName = String(formData.get("brandName") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const plan = String(formData.get("plan") ?? "") as Plan;
  const timezone = String(formData.get("timezone") ?? "").trim() || "Asia/Kolkata";
  const avgJobValue = Math.max(0, Math.round(Number(formData.get("avgJobValue") ?? 0)) || 0);
  const status = String(formData.get("status") ?? "trial") as TenantStatus;
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const ownerPassword = String(formData.get("ownerPassword") ?? "");

  if (!brandName) return { error: "Business name is required." };
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    return { error: "Slug must be lowercase letters, numbers, and hyphens." };
  }
  if (!PLAN_IDS.includes(plan)) return { error: "Pick a plan." };
  if (!["trial", "active", "paused"].includes(status)) return { error: "Invalid status." };

  if (await prisma.tenant.findUnique({ where: { slug } })) {
    return { error: `Slug "${slug}" is already taken.` };
  }
  if (ownerEmail) {
    if (!ownerEmail.includes("@")) return { error: "Owner email looks invalid." };
    if (ownerPassword.length < 8) return { error: "Owner password must be at least 8 characters." };
    if (await prisma.user.findUnique({ where: { email: ownerEmail } })) {
      return { error: "A user with that email already exists." };
    }
  }

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      brandName,
      timezone,
      mode: plans.planFor(plan).mode as TenantMode,
      plan,
      avgJobValue,
      status,
      businessHours: DEFAULT_BUSINESS_HOURS,
    },
  });

  if (ownerEmail && ownerPassword) {
    await createUser({ email: ownerEmail, password: ownerPassword, role: "owner", tenantId: tenant.id, name: `${brandName} Owner` });
  }

  revalidatePath("/admin");
  redirect(`/admin/tenants/${tenant.id}`);
}

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

// Full Plivo provisioning from the admin UI: creates the Plivo Application
// pointed at our webhooks, assigns the (owned) number to it, and writes the
// PlivoNumber row — the same work scripts/provision.ts does. It runs on the API
// service (which holds the Plivo credentials); the web forwards the admin
// session token so the API can authorize it.
export async function assignPlivoNumberAction(_prev: unknown, formData: FormData) {
  await requireAdminSession();
  const tenantId = String(formData.get("tenantId") ?? "");
  const e164 = String(formData.get("e164") ?? "").replace(/[^\d+]/g, "");
  if (!tenantId || !/^\+\d{8,15}$/.test(e164)) return { error: "Enter a valid E.164 number (e.g. +912248123456)." };

  const apiBase = process.env.API_BASE_URL;
  if (!apiBase) return { error: "API_BASE_URL is not set on the web app — can't reach the provisioning service." };
  const token = (await cookies()).get(SESSION_COOKIE)?.value;

  let res: Response;
  try {
    res = await fetch(`${apiBase.replace(/\/$/, "")}/admin/tenants/${tenantId}/plivo-number`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ mode: "assign", e164 }),
      cache: "no-store",
    });
  } catch (e) {
    return { error: `Couldn't reach the provisioning API: ${(e as Error).message}` };
  }

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json?.ok) {
    return { error: json?.error ?? `Provisioning failed (HTTP ${res.status}).` };
  }

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true, plivoAppId: String(json.plivoAppId ?? ""), e164: String(json.e164 ?? e164) };
}

// Link a tenant's OWN WABA (provider 'own' — the Phase-1 path). Embedded Signup
// (provider 'embedded') activates for external tenants after Tech Provider approval.
export async function linkWhatsAppSenderAction(_prev: unknown, formData: FormData) {
  await requireAdminSession();
  const tenantId = String(formData.get("tenantId") ?? "");
  // Only the platform brand slug + WhatsApp number are functionally required —
  // sending/ingestion key off the brand slug. The Meta IDs are informational.
  const platformBrandSlug = String(formData.get("platformBrandSlug") ?? "").trim() || null;
  const displayE164 = String(formData.get("displayE164") ?? "").replace(/[^\d+]/g, "");
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim() || null;
  const wabaId = String(formData.get("wabaId") ?? "").trim() || null;
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const q = String(formData.get("quality") ?? "").toUpperCase();
  const qualityRating = (["GREEN", "YELLOW", "RED"].includes(q) ? q : null) as
    | "GREEN"
    | "YELLOW"
    | "RED"
    | null;

  if (!tenantId || !platformBrandSlug || !/^\+\d{8,15}$/.test(displayE164)) {
    return { error: "Platform brand slug and a valid WhatsApp number are required." };
  }

  const existing = await prisma.whatsAppSender.findFirst({ where: { tenantId } });
  const data = {
    provider: "own" as const,
    wabaId,
    phoneNumberId,
    displayE164,
    displayName,
    platformBrandSlug,
    qualityRating,
    status: "connected" as const,
    connectedAt: new Date(),
  };
  if (existing) await prisma.whatsAppSender.update({ where: { id: existing.id }, data });
  else await prisma.whatsAppSender.create({ data: { tenantId, ...data } });

  revalidatePath(`/admin/tenants/${tenantId}`);
  revalidatePath("/admin");
  return { ok: true };
}

// Auto-fill WABA fields from the WhatsApp platform, given just the brand slug.
// Reads the platform's stored phone_number_id/waba_id + live Meta display/name/
// quality via the platform's /api/notify/brand-details endpoint. The web already
// holds WA_PLATFORM_BASE_URL + WA_PLATFORM_SECRET (for the conversation view).
export interface WaBrandDetails {
  ok?: boolean;
  error?: string;
  phoneNumberId?: string;
  wabaId?: string;
  displayE164?: string;
  displayName?: string;
  quality?: string;
}
export async function fetchWaBrandAction(brandSlug: string): Promise<WaBrandDetails> {
  await requireAdminSession();
  const base = process.env.WA_PLATFORM_BASE_URL;
  if (!base) return { error: "WhatsApp platform not configured (WA_PLATFORM_BASE_URL)." };
  const slug = brandSlug.trim().toLowerCase();
  if (!slug) return { error: "Enter the platform brand slug first." };

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/api/notify/brand-details/${encodeURIComponent(slug)}`, {
      headers: { "x-webhook-secret": process.env.WA_PLATFORM_SECRET ?? "" },
      cache: "no-store",
    });
  } catch (e) {
    return { error: `Couldn't reach the platform: ${(e as Error).message}` };
  }
  if (res.status === 404) return { error: `No brand "${slug}" found on the platform.` };
  if (res.status === 401) return { error: "Platform rejected the secret (check WA_PLATFORM_SECRET)." };
  if (!res.ok) return { error: `Platform returned HTTP ${res.status}.` };

  const j: any = await res.json().catch(() => ({}));
  const displayE164 = j.displayNumber ? "+" + String(j.displayNumber).replace(/[^\d]/g, "") : "";
  return {
    ok: true,
    phoneNumberId: String(j.phoneNumberId ?? ""),
    wabaId: String(j.wabaId ?? ""),
    displayE164,
    displayName: String(j.verifiedName ?? ""),
    quality: String(j.quality ?? ""),
  };
}
