import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

// One-off seed for a LIVE Mode B (Front Desk) trial tenant — the same way we
// proved Mode A on Clean Warks. It creates:
//   - a Front Desk (Mode B) tenant in `trial`
//   - an owner login so you can reach the /call-management dashboard
//   - a ready-made 2-option IVR tree (root menu → press 1 / press 2, both ring
//     the staff hunt) so you don't have to hand-build the fiddly part
//
// It does NOT create staff or provision a number — you add the two staff phone
// numbers in the Call Management UI and provision the Plivo number from /admin,
// exactly as a real onboarding would.
//
// Run it where DATABASE_URL is available (e.g. via Railway so the deployed DB is
// injected):
//   railway run pnpm --filter @itsolute/db exec tsx prisma/seed-modeb-test.ts
//
// Optional overrides (env vars):
//   MODEB_SLUG, MODEB_BRAND, MODEB_OWNER_EMAIL, MODEB_OWNER_PASSWORD
//
// Idempotent: re-running upserts the tenant, leaves an existing owner alone
// (unless MODEB_RESET_PASSWORD=1), and rebuilds the IVR tree cleanly.

try {
  process.loadEnvFile();
} catch {
  // env injected directly (Railway) — fine.
}

const prisma = new PrismaClient();
const hash = (plain: string) => bcrypt.hash(plain, 12); // match @itsolute/auth

const SLUG = process.env.MODEB_SLUG ?? "modeb-test";
const BRAND = process.env.MODEB_BRAND ?? "Mode B Front Desk Test";
const OWNER_EMAIL = (process.env.MODEB_OWNER_EMAIL ?? "modeb-test@itsolute.com").toLowerCase().trim();
const OWNER_PASSWORD = process.env.MODEB_OWNER_PASSWORD ?? randomBytes(9).toString("base64url"); // ~12 chars
const RESET_PASSWORD = process.env.MODEB_RESET_PASSWORD === "1";

const DEFAULT_BUSINESS_HOURS = {
  mon: { open: "09:00", close: "19:00" },
  tue: { open: "09:00", close: "19:00" },
  wed: { open: "09:00", close: "19:00" },
  thu: { open: "09:00", close: "19:00" },
  fri: { open: "09:00", close: "19:00" },
  sat: { open: "09:00", close: "19:00" },
  sun: null,
};

async function main() {
  // 1. Tenant — Front Desk plan puts it in Mode B.
  const tenant = await prisma.tenant.upsert({
    where: { slug: SLUG },
    update: { brandName: BRAND, mode: "B", plan: "front_desk", status: "trial" },
    create: {
      slug: SLUG,
      brandName: BRAND,
      timezone: "Asia/Kolkata",
      businessHours: DEFAULT_BUSINESS_HOURS,
      mode: "B",
      plan: "front_desk",
      status: "trial",
      avgJobValue: 3000,
      recordCalls: false,
    },
  });

  // 2. Owner login (so you can open /call-management for this tenant).
  const existingOwner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  let ownerPasswordToShow: string | null = OWNER_PASSWORD;
  if (!existingOwner) {
    await prisma.user.create({
      data: {
        email: OWNER_EMAIL,
        passwordHash: await hash(OWNER_PASSWORD),
        role: "owner",
        tenantId: tenant.id,
        name: `${BRAND} Owner`,
      },
    });
  } else if (RESET_PASSWORD) {
    await prisma.user.update({
      where: { id: existingOwner.id },
      data: { passwordHash: await hash(OWNER_PASSWORD), tenantId: tenant.id, role: "owner" },
    });
  } else {
    ownerPasswordToShow = null; // untouched — we don't know/print the existing one
  }

  // 3. IVR tree — rebuild cleanly so re-runs don't stack duplicate nodes.
  await prisma.ivrNode.deleteMany({ where: { tenantId: tenant.id } });
  const root = await prisma.ivrNode.create({
    data: {
      tenantId: tenant.id,
      parentId: null,
      key: null,
      prompt: `Thanks for calling ${BRAND}. For sales, press 1. For support, press 2.`,
      action: "submenu",
    },
  });
  await prisma.ivrNode.create({
    data: { tenantId: tenant.id, parentId: root.id, key: "1", prompt: "Connecting you now, please hold.", action: "ring_staff" },
  });
  await prisma.ivrNode.create({
    data: { tenantId: tenant.id, parentId: root.id, key: "2", prompt: "Connecting you now, please hold.", action: "ring_staff" },
  });

  const staffCount = await prisma.staff.count({ where: { tenantId: tenant.id } });

  // 4. Summary + next steps.
  console.log("\n✅ Mode B test tenant ready\n");
  console.log(`  Tenant:   ${tenant.brandName}  (slug: ${tenant.slug})`);
  console.log(`  Tenant id:${tenant.id}`);
  console.log(`  Plan/mode: Front Desk · Mode B · status trial`);
  console.log(`  Owner:    ${OWNER_EMAIL}`);
  if (ownerPasswordToShow) console.log(`  Password: ${ownerPasswordToShow}   (change it after first login)`);
  else console.log(`  Password: (owner already existed — left unchanged; set MODEB_RESET_PASSWORD=1 to reset)`);
  console.log(`\n  IVR tree created:`);
  console.log(`    Root (menu): "${root.prompt}"`);
  console.log(`      press 1 → ring staff`);
  console.log(`      press 2 → ring staff`);
  console.log(`  Staff configured: ${staffCount}  ${staffCount === 0 ? "→ add your two numbers in Call Management" : ""}`);
  console.log(`\n  Next:`);
  console.log(`    1. /admin → open "${tenant.brandName}" → Plivo number → Provision & assign (buy the number in Plivo first).`);
  console.log(`    2. Sign in as ${OWNER_EMAIL} → Call Management → add both staff numbers in ring order.`);
  console.log(`    3. (Optional) link WhatsApp + submit the recovery template to see the missed→recovery message fire.\n`);
}

main()
  .catch((e) => {
    console.error("seed-modeb-test failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
