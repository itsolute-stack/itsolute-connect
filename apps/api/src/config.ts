// Recovery policy defaults (spec §9). Tenant-configurable later; centralized
// here so the worker and any future settings UI share one source of truth.

export const recoveryConfig = {
  /** Skip a recovery message if one was already SENT to this (tenant, caller)
   *  within this window. Default 6h. */
  cooldownMs: 6 * 60 * 60 * 1000,

  /** Messaging window in tenant-local minutes-of-day. Sends outside this window
   *  are deferred until it next opens. Default 08:00–21:00. */
  quietHours: {
    startMin: 8 * 60, // 08:00
    endMin: 21 * 60, // 21:00
  },
} as const;
