# ITSolute Connect

Multi-tenant SaaS for micro local-service businesses in India: never lose a
customer to a missed call. Unanswered calls trigger an instant WhatsApp recovery
message (from the customer's **own** WhatsApp Business number) with a booking
link. Higher tiers route the whole phone system through the cloud.

Two service modes, designed in from day one:

- **Mode A — Recovery** (Phase 1, live first): conditional call-forwarding → Plivo → missed-call recovery.
- **Mode B — Front Desk** (scaffolded, enabled per tenant): all calls route through Plivo — IVR, ring/hunt, recordings, logs — with recovery layered on top.

## Monorepo layout

```
apps/
  web/    → Next.js dashboard (Vercel, connect.itsolute.com)   [not yet built]
  api/    → Express backend + Plivo webhooks (Railway); BullMQ workers next
packages/
  db/     → Prisma schema, client, tenant-scoping guard, plan config, seed
  auth/   → email+password sessions (bcryptjs + jose), roles, authz guards
```

pnpm workspaces. Node ≥ 20.

## Tenant isolation (non-negotiable)

Every customer-facing query goes through `forTenant(session.tenantId)` from
`@itsolute/db`, which forces `tenantId` into every query on tenant-owned models.
The `tenantId` **always** comes from the verified session — never from client
input. `findUnique` is blocked on scoped models (it can't be tenant-scoped);
use `findFirst`. Customer-facing code should obtain its client via
`tenantDbFor(session)` in `@itsolute/auth`.

## Getting started

```bash
pnpm install

# 1. Point at a Postgres (Supabase or Railway PG)
cp .env.example .env            # set DATABASE_URL + AUTH_SECRET
cp packages/db/.env.example packages/db/.env

# 2. Generate client + apply schema
pnpm db:generate
pnpm --filter @itsolute/db exec prisma migrate deploy   # applies prisma/migrations

# 3. Seed the four Phase-1 tenants + shared recovery template
pnpm db:seed
# add dev logins:
SEED_DEV_USERS=true SEED_PASSWORD=... pnpm db:seed
```

### Run the API (Plivo webhooks)

```bash
cp apps/api/.env.example apps/api/.env   # set DATABASE_URL, AUTH_SECRET, PLIVO_AUTH_TOKEN
pnpm --filter @itsolute/api dev           # http://localhost:4000/health
```

Point a tenant's Plivo application answer_url at
`POST {PLIVO_WEBHOOK_BASE_URL}/webhooks/plivo/incoming` and hangup_url at
`/webhooks/plivo/hangup`. Inbound webhooks are rejected unless the Plivo V3
signature verifies (`PLIVO_AUTH_TOKEN`); use `PLIVO_SKIP_SIGNATURE=true` only for
local testing.

### Run the recovery worker

```bash
pnpm --filter @itsolute/api dev:worker   # needs REDIS_URL
```

A missed call enqueues a recovery job. The worker picks the tenant's connected
WABA + an approved `utility` template, applies **cooldown** (6h per tenant+caller,
default) and **quiet-hours** (defers sends outside 08:00–21:00 tenant-local),
then sends via the WhatsApp platform and records a `RecoveryMessage`. Policy
defaults live in [`apps/api/src/config.ts`](apps/api/src/config.ts). With
`WA_PLATFORM_BASE_URL` unset the send runs in mock mode.

### WhatsApp integration & status/reply ingestion

The existing WhatsApp platform (Meta Cloud API) is the single send/receive point
— ITSolute Connect only decides *when/what* to send. Sends go to that platform's
`POST /api/notify/custom` ([lib/wa-platform.ts](apps/api/src/lib/wa-platform.ts),
authed by `x-webhook-secret`), keyed by `WhatsAppSender.platformBrandSlug` (e.g.
`cleanwarks`) — which is **not** the same as `tenant.slug` (`clean-warks`).

The platform doesn't push events to us, so delivery/read/reply status is ingested
two ways, both feeding the same forward-only, idempotent correlation service
([services/recovery-events.ts](apps/api/src/services/recovery-events.ts)):

1. **Real-time** — a WebSocket subscriber ([ws/wa-subscriber.ts](apps/api/src/ws/wa-subscriber.ts))
   consumes `MESSAGE_STATUS` + `NEW_MESSAGE` per brand.
2. **Reconciliation** — a periodic poll ([workers/reconcile.ts](apps/api/src/workers/reconcile.ts))
   re-derives status from the platform's REST API matched by `waMessageId`, so a
   WebSocket gap never leaves billing-relevant status silently stale.

Both run in the worker process. Status matches by `waMessageId`; replies match by
(brand → tenant, caller number). A reply flips the `RecoveryMessage` to `replied`,
marks the `Call` `recovered`, and fires the owner-alert seam.

**Recovery is measured by replies, not read receipts.** The platform's
`/api/notify/*` send path doesn't create a `Message` row, so Meta's
delivered/read webhooks have nothing to update for recovery sends — delivered/read
are not tracked for them (by decision). Recovery rate and "revenue recovered" are
driven by replies/bookings (the actual conversion signal), which *are* tracked.

### Dashboard (`apps/web`)

Next.js 15 App Router + Tailwind v4, Inter, mobile-first. Auth via the shared
`@itsolute/auth` session cookie; every page reads through `forTenant(session.tenantId)`.
The **Overview** home leads with the four hero metrics — missed calls, recovered,
recovery rate, est. revenue recovered — then trend, WhatsApp health, and a
recent-calls feed. Nav is gated by plan/mode (Mode A never sees Call Management;
Bookings only on plans that include it). Run: `pnpm --filter @itsolute/web dev`.

## Plans & feature gating

Pricing, limits, and per-plan features live in
[`packages/db/src/plans.ts`](packages/db/src/plans.ts) as config — not hardcoded
in components. Gate dashboard sections and API routes off `planHasFeature()`.

## Build status

- [x] **Step 1** — Prisma schema + initial migration + auth with tenant scoping
- [x] **Step 2** — Plivo `incoming` / `hangup` webhooks → Call rows (`apps/api`)
- [x] **Step 3** — BullMQ recovery worker (cooldown + quiet-hours) → WhatsApp send
- [x] **Step 4** — WhatsApp status/reply ingestion (WebSocket + reconciliation) + owner alert
- [x] **Step 5** — Customer dashboard (`apps/web`: Overview, Calls, Recovery Inbox, Bookings, Settings, Billing)
- [x] **Step 6** — First-run onboarding wizard (two-track, live progress, "test it")
- [x] **Step 7** — Internal admin area (`/admin`) + Phase-1 provisioning tooling
- [x] **Step 8** — Mode B: IVR + staff-hunt routing, recordings, usage metering, Call Management UI

### Mode B — Front Desk (`apps/api` + `apps/web`)

Enabled per tenant (`mode = B` + `front_desk`/`ai_front_desk` plan). All calls route
through Plivo: an incoming call walks an optional IVR tree, then rings staff in
`ringOrder` with busy/no-answer **hunting to the next number**, recording each hop
to `Call.routePath`. Answered → `Call.answered` (+ `billableSec`, recording URL,
metered into `UsageDaily.minutes`); nobody answers → falls through to the same
recovery flow as Mode A. Multi-step Plivo control lives in
[services/mode-b.ts](apps/api/src/services/mode-b.ts) with `/webhooks/plivo/ivr`
and `/webhooks/plivo/dial-status` (hunt index carried in the action URL).

The **Call Management** dashboard section (Mode B only, gated in nav + by page
redirect) has staff & ring-order management (reorder, per-staff missed-call
alerts), a functional **IVR builder** (tree of menu steps), a recording toggle,
and call analytics (volume, answer rate, missed rate, avg handle time).

The AI Front Desk plan (`ai_front_desk`) remains a "coming soon" stub — the
`aiEnabled` flag and the IVR/answer hand-off points exist, but no voice pipeline
is built.

### Internal admin (`/admin`, role `admin`)

Separate dark-themed area, gated by `requireAdminSession`. **Tenants** list (mode,
plan, WhatsApp quality, usage, MRR); **tenant detail** with CRUD (plan/mode/status/
billing/onboarding fee/AI) and Phase-1 provisioning — assign a Plivo number, link a
tenant's own WABA (`provider=own`); plus **Templates** and **Usage** across tenants.
Tenant CRUD, number assignment, and WABA linking are DB-only dashboard server
actions. Actually renting a number + wiring webhooks via the **Plivo API** lives in
`apps/api` ([services/plivo-provision.ts](apps/api/src/services/plivo-provision.ts),
`POST /admin/tenants/:id/plivo-number`, admin-JWT-guarded); it needs Plivo
credentials and renting is an explicit paid action.

## Deployment

- **`apps/web`** → Vercel (`itsolute-connect-web.vercel.app`). Env: `DATABASE_URL`,
  `AUTH_SECRET` (32+ chars, **identical to the API's**), `SESSION_TTL_HOURS` (opt).
- **`apps/api`** → Railway, two services from the same package sharing env:
  - API (Plivo webhooks): start `pnpm run start:api`.
  - Worker (recovery queue + WhatsApp status/reply): start `pnpm run start:worker`.

All three read `DATABASE_URL` (Supabase pooler URL) and `AUTH_SECRET` — keep
`AUTH_SECRET` the same value across every service or sessions won't verify across
web and API.
