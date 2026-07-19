import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// The Prisma CLI auto-loads .env, but running this seed via tsx does not — load
// it so DATABASE_URL is available when the client is instantiated below.
try {
  process.loadEnvFile();
} catch {
  // no .env (env vars injected directly) — fine.
}

const prisma = new PrismaClient();

// Keep in sync with @itsolute/auth (12 rounds). Inlined here to avoid a circular
// package dependency (auth depends on db).
const hash = (plain: string) => bcrypt.hash(plain, 12);

// Spec §11 — Phase 1 provisioning (our own businesses). All start in Mode A on
// the `recovery` plan. Plivo numbers + WABAs are wired up per-tenant via the
// admin area later; this just creates the tenant rows so onboarding can begin.
const PHASE_1_TENANTS = [
  { slug: "clean-warks", brandName: "Clean Warks", avgJobValue: 1500 },
  { slug: "cctvpros", brandName: "CCTVPROS", avgJobValue: 8000 },
  { slug: "itsolute", brandName: "ITSolute", avgJobValue: 5000 },
  { slug: "senza-aura", brandName: "Senza Aura", avgJobValue: 2000 },
];

// Default business hours (IST) — drives quiet-hours deferral (spec §9).
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
  // Shared default recovery template (tenantId null). MUST be `utility`,
  // short + service-toned (spec §4a.5, §9). {{1}} = brand name, {{2}} = booking url.
  await prisma.template.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      tenantId: null,
      name: "recovery_default_en",
      language: "en",
      category: "utility",
      status: "approved",
      body:
        "Hi, this is {{1}}. Sorry we missed your call just now — we'd love to help. " +
        "You can book a time here: {{2}} or just reply to this message and we'll get right back to you.",
    },
  });

  for (const t of PHASE_1_TENANTS) {
    await prisma.tenant.upsert({
      where: { slug: t.slug },
      update: { brandName: t.brandName },
      create: {
        slug: t.slug,
        brandName: t.brandName,
        timezone: "Asia/Kolkata",
        businessHours: DEFAULT_BUSINESS_HOURS,
        avgJobValue: t.avgJobValue,
        mode: "A",
        plan: "recovery",
        status: "trial",
      },
    });
  }

  // Dev logins — only when explicitly requested, so weak passwords never reach
  // production. Set SEED_DEV_USERS=true and (optionally) SEED_PASSWORD.
  if (process.env.SEED_DEV_USERS === "true") {
    const password = process.env.SEED_PASSWORD ?? "changeme-dev-123";
    const passwordHash = await hash(password);

    await prisma.user.upsert({
      where: { email: "admin@itsolute.com" },
      update: {},
      create: {
        email: "admin@itsolute.com",
        passwordHash,
        name: "ITSolute Admin",
        role: "admin",
        tenantId: null,
      },
    });

    for (const t of PHASE_1_TENANTS) {
      const tenant = await prisma.tenant.findUnique({ where: { slug: t.slug } });
      if (!tenant) continue;
      await prisma.user.upsert({
        where: { email: `owner@${t.slug}.itsolute.com` },
        update: {},
        create: {
          email: `owner@${t.slug}.itsolute.com`,
          passwordHash,
          name: `${t.brandName} Owner`,
          role: "owner",
          tenantId: tenant.id,
        },
      });
    }
    console.log(`Seeded dev users (password: "${password}").`);
  }

  console.log(`Seeded ${PHASE_1_TENANTS.length} tenants + 1 shared default template.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
