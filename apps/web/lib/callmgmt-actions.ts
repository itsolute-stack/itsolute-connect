"use server";

import { revalidatePath } from "next/cache";
import { forTenant, prisma } from "@itsolute/db";
import type { IvrAction } from "@itsolute/db";
import { requireTenantSession } from "./session";

// All Call Management writes are Mode B only and tenant-scoped via the session.

async function tenantId() {
  const s = await requireTenantSession();
  return s.tenantId;
}

export async function addStaffAction(_prev: unknown, formData: FormData) {
  const id = await tenantId();
  const name = String(formData.get("name") ?? "").trim();
  const e164 = String(formData.get("e164") ?? "").replace(/[^\d+]/g, "");
  if (!name || !/^\+\d{8,15}$/.test(e164)) return { error: "Name and a valid E.164 number are required." };

  const db = forTenant(id);
  const count = await db.staff.count();
  await db.staff.create({ data: { tenantId: id, name, e164, ringOrder: count } });
  revalidatePath("/call-management");
  return { ok: true };
}

export async function deleteStaffAction(formData: FormData) {
  const id = await tenantId();
  const staffId = String(formData.get("staffId") ?? "");
  await forTenant(id).staff.deleteMany({ where: { id: staffId } });
  revalidatePath("/call-management");
}

export async function moveStaffAction(formData: FormData) {
  const id = await tenantId();
  const staffId = String(formData.get("staffId") ?? "");
  const dir = String(formData.get("dir") ?? "");
  const db = forTenant(id);
  const list = await db.staff.findMany({ orderBy: { ringOrder: "asc" } });
  const idx = list.findIndex((s) => s.id === staffId);
  const swap = dir === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swap < 0 || swap >= list.length) return;
  // swap ring orders
  await db.staff.update({ where: { id: list[idx].id }, data: { ringOrder: list[swap].ringOrder } });
  await db.staff.update({ where: { id: list[swap].id }, data: { ringOrder: list[idx].ringOrder } });
  revalidatePath("/call-management");
}

export async function toggleAlertAction(formData: FormData) {
  const id = await tenantId();
  const staffId = String(formData.get("staffId") ?? "");
  const db = forTenant(id);
  const s = await db.staff.findFirst({ where: { id: staffId } });
  if (s) await db.staff.update({ where: { id: s.id }, data: { alertOnMissed: !s.alertOnMissed } });
  revalidatePath("/call-management");
}

export async function toggleRecordingAction(formData: FormData) {
  const id = await tenantId();
  const on = formData.get("on") === "true";
  await prisma.tenant.update({ where: { id }, data: { recordCalls: on } });
  revalidatePath("/call-management");
}

const IVR_ACTIONS: IvrAction[] = ["ring_staff", "submenu", "voicemail", "hangup"];

export async function addIvrNodeAction(_prev: unknown, formData: FormData) {
  const id = await tenantId();
  const parentId = String(formData.get("parentId") ?? "") || null;
  const key = String(formData.get("key") ?? "").trim() || null;
  const prompt = String(formData.get("prompt") ?? "").trim();
  const action = String(formData.get("action") ?? "") as IvrAction;
  if (!prompt) return { error: "A prompt is required." };
  if (!IVR_ACTIONS.includes(action)) return { error: "Invalid action." };
  if (parentId && !key) return { error: "Child nodes need a DTMF key." };

  await forTenant(id).ivrNode.create({ data: { tenantId: id, parentId, key, prompt, action } });
  revalidatePath("/call-management");
  return { ok: true };
}

export async function deleteIvrNodeAction(formData: FormData) {
  const id = await tenantId();
  const nodeId = String(formData.get("nodeId") ?? "");
  await forTenant(id).ivrNode.deleteMany({ where: { id: nodeId } });
  revalidatePath("/call-management");
}
