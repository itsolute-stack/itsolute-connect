import { prisma } from "@itsolute/db";

// TEMPORARY diagnostic — reports the runtime env/DB state on Vercel to pinpoint
// the login 500. Exposes no secret VALUES (only lengths, host, booleans, and a
// credential-redacted error). Delete this route once diagnosed.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "94b9a032fda34c8b";

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("k") !== TOKEN) return new Response("not found", { status: 404 });

  const dbUrl = process.env.DATABASE_URL ?? "";
  let dbHost = "";
  try { dbHost = dbUrl ? new URL(dbUrl).host : ""; } catch { dbHost = "(unparseable)"; }

  let prismaOk = false;
  let prismaError = "";
  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaOk = true;
  } catch (e: any) {
    prismaError = String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/gi, "postgres://<redacted>").slice(0, 500);
  }

  // Exercise the exact login logic (Prisma model query + bcrypt + jose sign).
  let loginOk = false;
  let loginError = "";
  try {
    const { login } = await import("@itsolute/auth");
    const r = await login("admin@itsolute.com", "dev-pass-123");
    loginOk = !!r;
  } catch (e: any) {
    loginError = String(e?.message ?? e).replace(/postgres(ql)?:\/\/\S+/gi, "postgres://<redacted>").slice(0, 500);
  }

  return Response.json({
    node: process.version,
    authSecretLen: (process.env.AUTH_SECRET ?? "").length,
    databaseUrlSet: !!dbUrl,
    databaseUrlHost: dbHost,
    databaseUrlIsPooler: dbHost.includes("pooler"),
    prismaOk,
    prismaError,
    loginOk,
    loginError,
  });
}
