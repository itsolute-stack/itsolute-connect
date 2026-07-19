import { prisma } from "@itsolute/db";
import { env } from "../src/env.js";
import { configureOwnedNumber, rentNumber } from "../src/services/plivo-provision.js";

// One-off Plivo provisioning CLI. Run where the Plivo credentials live — i.e.
// via Railway so the deployed service's env is injected:
//
//   railway run pnpm --filter @itsolute/api exec tsx scripts/provision.ts <slug> assign <e164>
//   railway run pnpm --filter @itsolute/api exec tsx scripts/provision.ts <slug> rent <countryISO>
//
// `assign` points a number you ALREADY OWN at our webhooks (no cost, works for
// India). `rent` BUYS a new number (paid; India needs a Plivo compliance app id,
// so prefer `assign` for IN).

async function main() {
  const [slug, mode, arg] = process.argv.slice(2);
  if (!slug || !mode) {
    console.error("Usage: provision.ts <tenant-slug> <assign <e164> | rent <countryISO>>");
    process.exit(1);
  }

  if (!env.plivoAuthId || !env.plivoAuthToken) {
    console.error("PLIVO_AUTH_ID / PLIVO_AUTH_TOKEN are not set in this environment.");
    process.exit(1);
  }
  if (!env.plivoWebhookBaseUrl) {
    console.error("PLIVO_WEBHOOK_BASE_URL is not set — the number would be wired to the wrong URL.");
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) {
    console.error(`No tenant with slug "${slug}".`);
    process.exit(1);
  }

  const base = env.plivoWebhookBaseUrl.replace(/\/$/, "");
  console.log(`Tenant: ${tenant.brandName} (${tenant.slug}, mode ${tenant.mode})`);
  console.log(`Webhooks: ${base}/webhooks/plivo/incoming  +  /hangup`);

  let result;
  if (mode === "assign") {
    if (!arg) throw new Error("assign needs an E.164 number you own, e.g. +912248123456");
    console.log(`Pointing owned number ${arg} at the webhooks…`);
    result = await configureOwnedNumber(tenant.id, arg);
  } else if (mode === "rent") {
    const country = arg || "IN";
    console.log(`Renting a new ${country} number (paid)…`);
    result = await rentNumber(tenant.id, { country, confirm: true });
  } else {
    throw new Error(`Unknown mode "${mode}" (use assign | rent)`);
  }

  console.log(`\n✅ Provisioned ${result.e164}  (Plivo app ${result.plivoAppId})`);
  console.log(`   Call ${result.e164} to run the first live test.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ Provisioning failed:", err?.message ?? err);
  await prisma.$disconnect();
  process.exit(1);
});
