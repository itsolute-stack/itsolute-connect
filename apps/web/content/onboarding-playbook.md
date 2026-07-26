# Tenant Onboarding Playbook

The complete, current, start-to-finish process for putting a new business live on ITSolute Connect. Follow it top to bottom. Everything here matches how the system actually works today — the admin screens, the provisioning button, and the data model.

There are two kinds of businesses:

- **Mode A — Recovery.** We just catch their *missed* calls and send a WhatsApp follow-up from their own WhatsApp number. Their normal phone keeps working; we only get the calls they *don't* answer.
- **Mode B — Front Desk.** The whole phone line runs through us (menus, ring order, recordings). Bigger setup — most of this playbook is written for Mode A, which is the common case, with Mode B notes where they differ.

You never pick the mode directly — it follows the **plan** you choose.

---

## 1. Before you start

Have these in hand before you touch the admin panel. Chasing them mid-setup is what makes onboarding drag.

- **Business name** — exactly how it should read to customers (e.g. "Clean Warks").
- **A short slug** — lowercase, hyphens only (e.g. `clean-warks`). This is their internal id and can't be changed casually, so pick well.
- **Which plan they're on** — this decides Mode A vs B and their price. See the table in Step 2.
- **Business hours** — when they're open. Drives "quiet hours" so we don't message people at 2am. There's a sensible default (Mon–Sat, 9am–7pm, closed Sunday) you can leave as-is and adjust later.
- **Average job value (₹)** — roughly what one customer is worth. Only used to estimate "revenue recovered" on their dashboard. A rough number is fine; `0` is fine too.
- **Their existing phone number** — the number customers already call. We do **not** replace it. We give them a *new* Plivo number and forward missed calls from their real number to it (Step 4).
- **Their WhatsApp** — for our own businesses, whether we already run their WhatsApp on our platform (we usually do). For an outside customer, note that WhatsApp onboarding isn't self-serve yet (Step 5b).
- **Booking link (optional)** — if they take bookings online, the URL. It gets dropped into the recovery message. Can be added later.

---

## 2. Create the tenant

**Where:** `/admin` → **"+ Add tenant"** (top right) → the *Add tenant* form.

Fill in:

| Field | What it means |
|---|---|
| **Business name** | Customer-facing name. Shows on their dashboard and in the recovery message. |
| **Slug (URL id)** | Lowercase letters, numbers, hyphens. Their permanent internal id. |
| **Plan** | Sets the price **and** the mode — mode follows the plan, they can't disagree. |
| **Status** | Start as **trial** unless they're already paying. See Step 9 to flip to active. |
| **Timezone** | Leave `Asia/Kolkata` unless they're genuinely elsewhere. Drives quiet hours. |
| **Average job value (₹)** | For the "revenue recovered" estimate. Rough is fine. |

The plans, and the mode each one puts the tenant in:

| Plan | Mode | Price/mo | Included messages | Included minutes |
|---|---|---|---|---|
| **Recovery** | A | ₹499 | 150 | — |
| **Recovery Pro** | A | ₹999 | 500 | — |
| **Front Desk** | B | ₹2,499 | 500 | 750 |
| **AI Front Desk** | B | ₹4,999 | 1,000 | 750 |

> **AI Front Desk is not live yet** — it shows in the list but is a "coming soon" stub. Don't sell it as a working plan.

**Owner login (optional).** The form has a second box to create the owner's login at the same time — their email and a starting password (min 8 characters). Fill it if you want them to be able to sign in immediately; skip it and you (or they) can add it later. They can change the password afterward.

**A couple of things the create form does *not* ask for**, on purpose — they're set later:

- **Business hours** — created with the sensible default. The business edits their own hours in their **Settings** page after they log in.
- **Booking URL** — also set later, in the business's **Settings**. It's optional; the recovery message just leaves it out if it's blank.

Hit **Create tenant**. You land on the tenant's detail page — that's where the rest of this playbook happens.

---

## 3. Get a Plivo number and wire it

The business needs a dedicated number that *we* control, so missed calls land on our system. This is a two-part step: **you buy the number by hand in Plivo**, then **the app wires it up for you**.

### 3a. Buy/rent the number (done by hand, in the Plivo console)

1. Log into the **Plivo console** → **Phone Numbers** → **Buy Numbers**.
2. Pick an Indian number in the right city/area for the business.
3. **Indian numbers need KYC/compliance** — Plivo will ask for business documents and an address linked to the number. **This is done entirely in Plivo's console, not through our app**, and can take a little while to clear. There's no way around it and no API shortcut; it's a regulatory requirement.

Once the number is bought and shows as active in Plivo, come back to our admin.

### 3b. Wire it with "Provision & assign" (the app does the rest)

On the tenant's detail page → **Plivo number** section:

1. Type the number in **E.164 format** (with country code, no spaces): e.g. `+912248123456`.
2. Click **Provision & assign**.

That one click does the real provisioning work automatically — the same thing our old command-line script did:

- Creates a **Plivo Application** named `connect-<slug>` pointed at our webhooks (the answer URL `…/webhooks/plivo/incoming` and hangup URL `…/webhooks/plivo/hangup`).
- **Assigns the number** to that application on Plivo.
- **Records** the number against this tenant in our database.

On success you'll see a green line: **✓ Provisioned +91… · Plivo app AP…** — that `AP…` is the Plivo Application ID it created. If anything fails, it shows you the **real** Plivo/config error (not a vague "something went wrong"), so you can act on it.

**What you still do by hand:** buying the number and clearing KYC (3a), and setting up call forwarding on the business's real phone (Step 4). Everything between — the Plivo app, the wiring, the database record — is the button's job.

---

## 4. Set up call forwarding on the business's real phone

This is the step **the customer does on their own phone**, and it's the easiest one to get wrong — so walk them through it carefully or do it with them.

**The idea:** their normal number keeps ringing as always. We only want the calls they *miss*. So we set **conditional forwarding** — forward to our Plivo number **only** when they're **busy**, **don't answer**, or are **unreachable** (switched off / no signal). We do **not** forward when they *do* answer — those calls never touch us.

### The dial codes

Here's the honest truth: **Jio, Airtel, Vi, and BSNL are all GSM networks, so they use the same standard codes.** There isn't a secret different set per carrier. Dial these from the business's phone, replacing `<PLIVO>` with the full Plivo number (with `+91`).

| What you want | Dial this |
|---|---|
| **Forward on all three conditions at once** (busy + no-answer + unreachable) — the one to use | `**004*<PLIVO>#` then call |
| Forward only when **no answer** | `**61*<PLIVO>#` |
| Forward only when **busy** | `**67*<PLIVO>#` |
| Forward only when **unreachable / switched off** | `**62*<PLIVO>#` |
| **Check** what forwarding is currently set | `*#61#` (and `*#67#`, `*#62#`) |
| **Turn off all conditional forwarding** | `##002#` then call |

**Use `**004*<PLIVO>#` — it sets all three conditions to the Plivo number in one shot.** That's what you want in almost every case.

**Per-carrier notes (small real-world gotchas, not different codes):**

- **Jio** — calls run over VoLTE. The codes work from the dialer, but if forwarding won't stick, open the **phone app → Settings → Call forwarding** and set the three conditional options there instead. Jio occasionally needs it done from the settings menu rather than the code.
- **Airtel** — codes work reliably from the dialer. No extra step usually needed.
- **Vi (Vodafone Idea)** — codes work; if a code returns an error, retry after a minute (network can be slow to accept it).
- **BSNL** — codes work, but on some circles conditional forwarding must be **activated on the account first**; if `**004*` errors out, the customer may need to ask BSNL to enable call forwarding on their plan.

**Important:** do **not** use unconditional forwarding (`**21*…#`) — that sends *every* call to us, including ones the business would have answered. We only want conditional forwarding.

---

## 5. Connect WhatsApp

The recovery message is sent from the **business's own WhatsApp number**, through our WhatsApp platform. To make that work, we need the business to connect their WhatsApp to us.

### Why we do this by hand right now (read this once, so it makes sense)

The slick one-click way to connect WhatsApp — Meta's "Embedded Signup," where the owner just logs in with Facebook and clicks Allow — is only available to companies Meta has approved as a **Tech Provider**. **Our Tech Provider application was rejected**, so that one-click flow is off the table for the foreseeable future. Until we re-apply and get approved, **every** customer connects the manual way: the business owner generates a permanent access token inside their own Meta account and hands it to us. It's a few extra minutes on a call — a temporary manual step, not how it'll always be.

### 5a. The manual connection — the primary path for every customer

You'll do this **with the business owner**, on a phone call or screen-share, because it all happens inside *their* Meta account and only they can see it. Before you start, make sure:

- They can log into their business's Facebook/Meta account, and they are an **admin** of it.
- They already have a **WhatsApp Business Account (WABA)** set up with their number (if not, that's a separate setup first).

Then walk them through this, step by step. The words in quotes are roughly what you can read out loud.

1. **Log in.** "Go to **business.facebook.com** and log in with your business Facebook account." Make sure it's the account that owns their business/WhatsApp, not a personal one.
2. **Open Business Settings.** "Click the **gear / Settings** icon — that's **Business Settings**."
3. **Create a System User.** "On the left, open **Users → System Users**, then click **Add**. Name it something like **ITSolute Connect**, set the role to **Admin**, and click **Create System User**." (A system user is just a permanent, non-human login that lets us send on their behalf — it's normal.)
4. **Give it access to their WhatsApp account.** "With that new system user selected, click **Add Assets** (or **Assign Assets**) → **WhatsApp Accounts** → tick your **WhatsApp Business Account** → turn on **Full control / Manage**, then **Save**."
5. **Generate the permanent token.** "Still on the system user, click **Generate New Token**." Then, in that dialog: pick the **App** (if there's more than one, choose the one connected to their WhatsApp account); set **Token expiration** to **Never**; tick the **two** permissions **`whatsapp_business_management`** and **`whatsapp_business_messaging`**; and click **Generate Token**. The token appears **once** — have them **copy it immediately** and paste it somewhere safe to send to you. If they lose it, they just generate a new one. Because expiration is **Never**, this token keeps working — that's what makes it a permanent connection.
6. **Copy the WABA ID.** "Go to **Business Settings → Accounts → WhatsApp Accounts** (or open **WhatsApp Manager**), click your WhatsApp account, and copy the **WhatsApp Business Account ID** — a long number." Send that to you too.
7. **Copy the Phone Number ID.** "In **WhatsApp Manager → Phone Numbers**, click your number, and copy the **Phone number ID**." Be clear with them: this is **not** the phone number itself — it's a separate long number that sits next to it. That's the one we need.
8. **Note the number and display name.** Take down the actual **WhatsApp number** (with country code, e.g. `+91 98765 43210`) and the **display name** Meta shows for it (their approved business name).

By the end you should have five things from them: **the permanent token, the WABA ID, the Phone Number ID, the WhatsApp number, and the display name.**

### The number catch — is their number already on the normal WhatsApp app?

A phone number can only live in **one** WhatsApp at a time — either the everyday **WhatsApp / WhatsApp Business app** on their phone, **or** the WhatsApp Business **API** (which is what we use). It can't be both. So if the number they want to use is currently active in the regular WhatsApp app, you have two options — explain both and let them choose:

- **Option A — Move that number over to the API.** They remove/deregister the number from the phone app, and it gets registered on the Business API instead. **Good:** they keep their known number that customers already have. **Trade-off:** they lose the chat app for that number — messages now flow through the API/our platform, not the green WhatsApp app on their phone.
- **Option B — Use a second number for the API.** Keep their existing WhatsApp app number exactly as-is, and use a **different** number (a spare SIM, or a landline that can receive a verification call/SMS) for the Business API. **Good:** zero disruption to their current WhatsApp. **Trade-off:** the recovery messages go out from a different number than the one customers may recognize.

For most small businesses that live in the WhatsApp app all day, **Option B** is the calmer choice. If they rarely use the app and care most about the recognizable number, **Option A**.

### Then, on our side — register it and link the tenant

Once you have those five things:

1. **Give the token + IDs to our WhatsApp platform** for that brand. This is where messages actually send from, and it's the one place the **access token** is stored. **Connect itself never stores the token** — that's why the admin form below never asks for it. You'll register the brand under a short **brand slug** you choose (e.g. `acmeclinic`).
2. In Connect admin, open the **tenant's page → "WhatsApp sender (own WABA)"** and fill in the **Platform brand slug** (the slug you just set, e.g. `acmeclinic`), the **WhatsApp number** in E.164 form (e.g. `+919876543210`), the **Display name**, the **Phone Number ID**, and the **WABA ID**.
3. Click **Link WhatsApp (own WABA)**.

**Shortcut:** once the brand exists on the platform, you don't have to paste all five — just type the **brand slug** and click **Fetch from platform**, and it fills the WhatsApp number, display name, Phone Number ID, WABA ID (if stored), and quality for you. Manual paste is always the fallback.

### 5b. Embedded Signup — on hold, not scrapped

Embedded Signup (the one-click "log in with Facebook and Allow" flow, provider `embedded`) stays the goal, but it's **on hold**: our Meta Tech Provider application was rejected, so we can't offer it right now. We'll revisit it only if we re-apply and Meta approves us. Until that day, **do not** offer or promise the one-click flow to anyone — the manual connection in 5a is how every customer gets connected.

### If the token is missing a permission (what it looks like)

The most common mistake is generating the token **without both permissions ticked** (Step 5). Here's the catch: a token missing a permission still *looks* fine — it links without complaint. The problem only surfaces when you actually try to use it.

The clearest tell comes at **Step 6**: when you click **Create & submit to Meta** for the recovery template, it **fails with a real Meta error** instead of a green success — something like `(#200) requires whatsapp_business_management permission`, or an OAuth/permissions error naming the token or a missing scope. That is **not** a bug on our side, and **not** a template problem — it's the token missing a scope.

**The fix:** have the owner **generate a fresh token** (Step 5) with **both** `whatsapp_business_management` and `whatsapp_business_messaging` ticked and expiration set to **Never**, give you the new token, update it on our platform for that brand, and run Step 6 again.

**How to tell it apart from other failures:** if the error instead mentions the **template name, category, or the WABA** — not permissions — it's a template/setup issue (see Steps 6 and 8), not the token. A permissions/scope wording in the error is what points at the token specifically.

---

## 6. Approve the recovery template

WhatsApp won't let you message someone who called (a "cold" contact) with free text — the first message **must** be a pre-approved **template**. Recovery uses one, and it has rules.

### Why it must be category = *utility*

A recovery message ("sorry we missed your call, here's how to book") is a **utility** message — it's a service follow-up, not promotion. Meta requires it to be **category = utility**. A *marketing* template will get throttled, rejected, or drag the number's quality down. Utility is required, and it's what keeps the number healthy.

### How many you need

**Just one** — the missed-call recovery template — for both Mode A and Mode B. It's the only message we start (a "business-initiated" message), so it's the only one that needs a template. The caller's *replies* come back inside WhatsApp's 24-hour window, so those go out as normal text with no template. (Booking-confirmed / reminder templates are optional extras, not required for recovery.)

### The easy way — the "Create & submit to Meta" button (automated)

On the tenant's detail page there's a **Recovery template** section. Once WhatsApp is linked (Step 5), click **Create & submit to Meta**. That does the whole thing for you:

- Submits the recovery template (category **utility**) to Meta for approval, **under that tenant's WhatsApp brand**.
- Records a matching template row in Connect so the recovery worker and the Templates page can see it.

It comes back showing the Meta status — almost always **pending** at first. Meta reviews it (usually minutes to a few hours). Click **Refresh status** to re-check; once it flips to **approved**, recovery messages send live. No WhatsApp Manager, no copy-paste. (If the template already exists on Meta, the button just records its current status instead of erroring.)

> **This is new — it used to be manual.** Before, you (or I) had to write and submit the template in Meta's WhatsApp Manager by hand for every tenant — that's the step we did for Clean Warks. The button replaces that. You only fall back to doing it by hand in WhatsApp Manager if you want a *custom* wording different from the standard recovery message.

### What's happening underneath (so the failures make sense)

A template lives in **two places** and both must line up: the approved template **on Meta** (it sends by name), and a **row in Connect** marked `utility` + `approved`. The button keeps them in sync. If a tenant has no row of its own, the worker falls back to the **shared default** (`recovery_default_en`) that ships with the system — which is why the button submits under that same name, so everything matches. You can see all template rows and their status on the **Templates** admin page.

### What happens if there isn't one — the exact failure we hit with Clean Warks

If there's **no approved utility template** the tenant can use, the recovery **silently does not send**. In the system it shows up as a **RecoveryMessage with status `skipped` and reason `no_template`** — the call is logged as missed, but no WhatsApp goes out, and there's no loud error. That's exactly what bit us with Clean Warks: missed calls were being caught, but messages weren't landing because the utility template wasn't approved and name-matched yet. The fix was to get the utility template approved on Meta with the right name so the row lined up — after which messages flowed. **If you ever see missed calls but no messages, check this first.**

---

## 7. Test it

Don't call it done until you've watched one real missed call go all the way through.

**The test:**

1. From a **different** phone (ideally one that's on WhatsApp), call the business's **real** number.
2. **Don't let them answer** — let it ring out, or have them decline, so conditional forwarding kicks in and the call lands on the Plivo number.
3. Wait a few seconds.

**What should happen, and where to check each part in admin:**

| Stage | What you should see | Where to look |
|---|---|---|
| **Call caught** | A **Call** row for that caller, status **missed** | The tenant's **Calls** list |
| **Message queued/sent** | A **RecoveryMessage**, status **sent** | The **Recovery / inbox** view |
| **Message delivered** | A real WhatsApp message arrives from the business's number | The calling phone's WhatsApp |

If the WhatsApp actually arrives on the test phone, it works end to end.

**If something's missing, find the stage that broke:**

- **No Call row at all** → the call never reached us. Forwarding isn't set right (Step 4), or the number isn't provisioned to this tenant (Step 3b). Confirm the call actually forwarded — check that they didn't just answer it.
- **Call row, but no RecoveryMessage** → the worker isn't picking it up, or the queue/worker is down.
- **RecoveryMessage `skipped`** → read the **reason**: `no_sender` (WhatsApp not linked — Step 5), `no_template` (no approved utility template — Step 6), `cooldown` (you already messaged this caller recently), `quiet_hours_deferred` (outside business hours — it'll send when they open).
- **RecoveryMessage `failed`, reason `not_on_whatsapp`** → the caller's number isn't on WhatsApp. Test with a number that is.
- **Everything says sent but nothing arrives** → see the troubleshooting table below (template/quality/token issues).

---

## 8. Common failures and fixes

Real things we've actually hit, and what they mean.

| Symptom | What's really going on | Fix |
|---|---|---|
| **"Error Reaching Answer URL"** (in Plivo) | Plivo tried to hand the call to our webhook and couldn't — the API is down, `PLIVO_WEBHOOK_BASE_URL` is wrong, or the call's signature failed our check (we return 403 on an unverified webhook). | Check the API is up and healthy; confirm the Plivo Application's answer URL points at the live API; confirm the Plivo auth credentials match. |
| **"Custom Id cannot contain :"** | Old bug — we were putting a `:` in a Plivo custom id, which Plivo rejects. | **Already fixed.** Listed here only so it's recognizable if it ever resurfaces in old logs. |
| **WhatsApp send fails, no detail** | A send bounced but the reason was buried. The worker now logs the real HTTP status, Meta error code, and body, so failures explain themselves. | Check the worker logs — you'll see `httpStatus` / `metaCode` / `body`. Usually: template not approved, template **name mismatch**, wrong/expired access token, or wrong category. |
| **"Create & submit to Meta" fails with a permissions error** | The WhatsApp access token was generated without both required scopes (`whatsapp_business_management` + `whatsapp_business_messaging`). It links fine but can't submit templates. | Regenerate the token in Meta with **both** permissions ticked and expiration **Never**, update it on the platform for that brand, retry. See Step 5. |
| **Quality rating goes YELLOW or RED** | Meta flagged the number — too many messages blocked/reported, or spammy content. RED can pause the number's ability to send. | Slow down; make sure you're on a **utility** template with a genuine, helpful tone; stop messaging people who clearly don't want it. Quality recovers over time with clean sending. |
| **Worker log: "subscribing to 0 brands"** | The real-time WhatsApp listener found **no connected sender with a brand slug** to subscribe to — so live delivery/reply updates are off. | Link the tenant's WhatsApp (Step 5) so a sender with a `platformBrandSlug` exists, then restart the worker. |
| **Missed calls logged, but no messages** | Almost always `no_template` (no approved utility template lined up) or `no_sender` (WhatsApp not linked). | Check the RecoveryMessage **reason**. Fix per Step 5 or Step 6. |
| **Call rings but never shows as missed** | The number isn't provisioned to this tenant, or the business actually **answered** (we only get unanswered calls), or forwarding is unconditional/off. | Re-check Step 3b (is the PlivoNumber active for this tenant?) and Step 4 (conditional forwarding set correctly?). |

---

## 9. Going live — switching from trial to active

When a trial business becomes a real paying customer:

1. Open their tenant detail page → **Plan & mode** section.
2. Set **Status** from `trial` to **active**.
3. Confirm the **Plan** is the one they're actually paying for — the plan is what sets their **MRR** (the monthly price shown on the `/admin` tenants list comes straight from the plan's price).
4. Set **Billing cycle** — `monthly`, or `annual` for the ~20%-off yearly price.
5. If there's a one-time done-for-you setup charge, put it in **Onboarding fee (₹)** (optional).
6. Save.

That's it — they now count as active, and their price rolls into the MRR total on the tenants overview. To pause a customer later (non-payment, a break), set Status to `paused` instead of deleting them; their data and setup stay intact.

---

*Keep this current.* When the process changes, edit `apps/web/content/onboarding-playbook.md` in the repo — this page renders straight from that file.
