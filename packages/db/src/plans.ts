// Plan / mode / feature config (spec §6).
// Source of truth for pricing, limits, and feature gating — NOT hardcoded in
// components. Gate dashboard sections and API routes off `features` here.
// Prices are in rupees (paise where noted). Annual = ~20% off (see annualMultiplier).

export type PlanId = "recovery" | "recovery_pro" | "front_desk" | "ai_front_desk";
export type Mode = "A" | "B";

// Dashboard sections / capabilities that can be gated per plan.
export type Feature =
  | "overview"
  | "calls"
  | "recovery_inbox"
  | "bookings"
  | "multiple_templates"
  | "booking_automation"
  | "crm_push"
  | "analytics"
  | "review_request"
  | "call_management" // Mode B: IVR, ring order, busy-hunt, recordings
  | "call_recording"
  | "ai_voice_agent"; // future — stub UI only

export interface PlanConfig {
  id: PlanId;
  label: string;
  mode: Mode;
  /** Monthly price in rupees. */
  monthly: number;
  /** ~20% off annual — represented as an effective monthly-equivalent multiplier. */
  annualMultiplier: number;
  /** Included recovery messages per cycle (soft limit → overage). */
  includedRecoveryMessages: number;
  /** Per extra recovery message, in paise (₹0.30 = 30 paise). */
  overageMessagePaise: number;
  /** Mode B only: bundled telephony minutes. 0 for Mode A. */
  includedMinutes: number;
  /** Mode B only: per-minute overage in paise (₹2.25 = 225 paise). 0 for Mode A. */
  overageMinutePaise: number;
  features: Feature[];
  /** ai_front_desk ships as a "coming soon" stub — not a purchasable, live plan yet. */
  comingSoon?: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  recovery: {
    id: "recovery",
    label: "Recovery",
    mode: "A",
    monthly: 499,
    annualMultiplier: 0.8,
    includedRecoveryMessages: 150,
    overageMessagePaise: 30,
    includedMinutes: 0,
    overageMinutePaise: 0,
    features: ["overview", "calls", "recovery_inbox"],
  },
  recovery_pro: {
    id: "recovery_pro",
    label: "Recovery Pro",
    mode: "A",
    monthly: 999,
    annualMultiplier: 0.8,
    includedRecoveryMessages: 500,
    overageMessagePaise: 30,
    includedMinutes: 0,
    overageMinutePaise: 0,
    features: [
      "overview",
      "calls",
      "recovery_inbox",
      "bookings",
      "multiple_templates",
      "booking_automation",
      "crm_push",
      "analytics",
      "review_request",
    ],
  },
  front_desk: {
    id: "front_desk",
    label: "Front Desk",
    mode: "B",
    monthly: 2499,
    annualMultiplier: 0.8,
    includedRecoveryMessages: 500,
    overageMessagePaise: 30,
    includedMinutes: 750, // bundled 500–1,000 min
    overageMinutePaise: 225, // ₹2.00–2.50/min over bundle
    features: [
      "overview",
      "calls",
      "recovery_inbox",
      "bookings",
      "multiple_templates",
      "booking_automation",
      "crm_push",
      "analytics",
      "review_request",
      "call_management",
      "call_recording",
    ],
  },
  ai_front_desk: {
    id: "ai_front_desk",
    label: "AI Front Desk",
    mode: "B",
    monthly: 4999,
    annualMultiplier: 0.8,
    includedRecoveryMessages: 1000,
    overageMessagePaise: 30,
    includedMinutes: 750,
    overageMinutePaise: 225,
    comingSoon: true, // FUTURE — stub UI, not built
    features: [
      "overview",
      "calls",
      "recovery_inbox",
      "bookings",
      "multiple_templates",
      "booking_automation",
      "crm_push",
      "analytics",
      "review_request",
      "call_management",
      "call_recording",
      "ai_voice_agent",
    ],
  },
};

export const PLAN_LIST: PlanConfig[] = Object.values(PLANS);

export function planFor(planId: PlanId): PlanConfig {
  return PLANS[planId];
}

/** True if the plan grants the given dashboard/API feature. */
export function planHasFeature(planId: PlanId, feature: Feature): boolean {
  return PLANS[planId].features.includes(feature);
}

/** Effective price for a billing cycle. Annual returns the full-year price. */
export function priceFor(planId: PlanId, cycle: "monthly" | "annual"): number {
  const p = PLANS[planId];
  if (cycle === "annual") return Math.round(p.monthly * p.annualMultiplier * 12);
  return p.monthly;
}
