export type PlatformCustomerRow = { tenantStatus: "trial" | "active" | "suspended" | "cancelled"; subscriptionStatus: "trialing" | "active" | "past_due" | "paused" | "cancelled" | null; monthlyPriceCents: number | null; annualPriceCents: number | null; billingInterval: string | null; trialEndsAt: Date | null };

export function summarizePlatformCustomers(rows: PlatformCustomerRow[], now = new Date()) {
  const activeStatuses = new Set(["active", "trialing"]); let mrrCents = 0; let active = 0; let trials = 0; let paymentRisk = 0; let trialEndingSoon = 0; let suspended = 0;
  for (const row of rows) {
    if (row.tenantStatus === "suspended" || row.tenantStatus === "cancelled") suspended += 1;
    if (row.subscriptionStatus && activeStatuses.has(row.subscriptionStatus)) { active += 1; mrrCents += row.billingInterval === "annual" ? Math.round((row.annualPriceCents ?? 0) / 12) : row.monthlyPriceCents ?? 0; }
    if (row.tenantStatus === "trial" || row.subscriptionStatus === "trialing") trials += 1;
    if (row.subscriptionStatus === "past_due") paymentRisk += 1;
    if (row.trialEndsAt) { const days = row.trialEndsAt.getTime() - now.getTime(); if (days >= 0 && days <= 7 * 24 * 60 * 60 * 1000) trialEndingSoon += 1; }
  }
  return { totalCustomers: rows.length, activeCustomers: active, trials, paymentRisk, trialEndingSoon, suspended, mrrCents, arrCents: mrrCents * 12 };
}
