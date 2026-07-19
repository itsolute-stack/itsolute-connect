import { PrismaClient, Prisma } from "@prisma/client";

export * from "@prisma/client";
export * as plans from "./plans.js";

// ---------------------------------------------------------------------------
// Base client (singleton across hot-reloads)
// ---------------------------------------------------------------------------
// Use the base client ONLY where the tenant is not (yet) known from a user
// session: webhook handlers that resolve the tenant from the Plivo `To` number,
// internal admin operations, and the tenant-scoping factory below. Everything
// driven by an authenticated customer session MUST go through `forTenant()`.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ---------------------------------------------------------------------------
// Tenant scoping (spec §0.5 — isolation is sacred)
// ---------------------------------------------------------------------------
// `forTenant(tenantId)` returns a Prisma client that transparently forces
// `tenantId` into every query on tenant-owned models. The tenantId ALWAYS comes
// from the authenticated session — never from client input.
//
// Models with a mandatory, non-null tenantId are hard-scoped here. Two models
// are intentionally excluded and handled explicitly by callers:
//   - Template: tenantId is nullable (null = shared default); a tenant must be
//     able to read both its own and shared templates.
//   - User / Tenant: identity + admin rows; scoped by id / role, not tenantId.

const TENANT_SCOPED_MODELS = new Set<string>([
  "PlivoNumber",
  "WhatsAppSender",
  "Call",
  "RecoveryMessage",
  "Booking",
  "Staff",
  "IvrNode",
  "UsageDaily",
]);

// findUnique/findUniqueOrThrow accept only unique fields in `where`, so tenantId
// cannot be injected into them. They are blocked for scoped models — use
// findFirst (which the guard scopes) instead. This prevents an un-scoped lookup
// from silently crossing tenants.
const BLOCKED_OPERATIONS = new Set<string>(["findUnique", "findUniqueOrThrow"]);

function withTenantWhere(args: any, tenantId: string) {
  args = args ?? {};
  args.where = { ...(args.where ?? {}), tenantId };
  return args;
}

function withTenantData(args: any, tenantId: string) {
  args = args ?? {};
  if (Array.isArray(args.data)) {
    args.data = args.data.map((d: any) => ({ ...d, tenantId }));
  } else {
    args.data = { ...(args.data ?? {}), tenantId };
  }
  return args;
}

export type TenantClient = ReturnType<typeof forTenant>;

export function forTenant(tenantId: string) {
  if (!tenantId) throw new Error("forTenant() requires a tenantId from the session");

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_SCOPED_MODELS.has(model)) return query(args);

          if (BLOCKED_OPERATIONS.has(operation)) {
            throw new Error(
              `${operation} is not tenant-safe on ${model}; use findFirst so tenant scoping applies.`,
            );
          }

          switch (operation) {
            case "create":
            case "createMany":
            case "createManyAndReturn":
              return query(withTenantData(args, tenantId));

            case "upsert": {
              const a = withTenantWhere(args, tenantId);
              a.create = { ...(a.create ?? {}), tenantId };
              return query(a);
            }

            case "findFirst":
            case "findFirstOrThrow":
            case "findMany":
            case "update":
            case "updateMany":
            case "delete":
            case "deleteMany":
            case "count":
            case "aggregate":
            case "groupBy":
              return query(withTenantWhere(args, tenantId));

            default:
              return query(withTenantWhere(args, tenantId));
          }
        },
      },
    },
  });
}

export { Prisma };
