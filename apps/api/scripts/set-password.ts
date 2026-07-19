import { prisma } from "@itsolute/db";
import { hashPassword } from "@itsolute/auth";

// Set (rotate) a user's password. Run against the production DB:
//   railway run pnpm --filter @itsolute/api exec tsx scripts/set-password.ts <email> <new-password>
// or locally with DATABASE_URL set. Pick a strong password — this is an
// internet-facing dashboard login.

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error("Usage: set-password.ts <email> <new-password>");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) {
    console.error(`No user with email "${email}".`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });
  console.log(`✅ Password updated for ${user.email} (role ${user.role}).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Failed:", e?.message ?? e);
  await prisma.$disconnect();
  process.exit(1);
});
