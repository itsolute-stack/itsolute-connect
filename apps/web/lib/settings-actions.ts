"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@itsolute/db";
import { requireTenantSession } from "./session";

// Update the signed-in tenant's own profile. The tenantId comes from the
// verified session — never from the form.
export async function updateProfileAction(_prev: unknown, formData: FormData) {
  const session = await requireTenantSession();

  const brandName = String(formData.get("brandName") ?? "").trim();
  const avgJobValue = Math.max(0, Math.round(Number(formData.get("avgJobValue") ?? 0)) || 0);
  const bookingUrl = String(formData.get("bookingUrl") ?? "").trim() || null;

  if (!brandName) return { error: "Business name is required." };

  await prisma.tenant.update({
    where: { id: session.tenantId },
    data: { brandName, avgJobValue, bookingUrl },
  });
  revalidatePath("/settings");
  revalidatePath("/");
  return { ok: true };
}
