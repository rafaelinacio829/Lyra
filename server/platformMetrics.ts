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

export type CustomerHealthInput = PlatformCustomerRow & { id: number; cancelAtPeriodEnd?: boolean | null; conversations?: number | null; messages?: number | null };

export function scoreCustomerHealth(customer: CustomerHealthInput, now = new Date()) {
  const reasons: string[] = [];
  if (customer.subscriptionStatus === "past_due") reasons.push("Cobrança pendente");
  if (customer.cancelAtPeriodEnd) reasons.push("Cancelamento programado");
  if (customer.tenantStatus === "suspended" || customer.tenantStatus === "cancelled") reasons.push("Ambiente inativo");
  if (customer.trialEndsAt) { const days = Math.ceil((customer.trialEndsAt.getTime() - now.getTime()) / 86400000); if (days >= 0 && days <= 3) reasons.push("Trial termina em até 3 dias"); }
  if ((customer.subscriptionStatus === "active" || customer.subscriptionStatus === "trialing") && !customer.conversations && !customer.messages) reasons.push("Sem atividade no período");
  const level = reasons.some(reason => reason === "Cobrança pendente" || reason === "Ambiente inativo") ? "critical" : reasons.length ? "attention" : "healthy";
  const score = level === "critical" ? 25 : level === "attention" ? 65 : 100;
  return { level, score, reasons };
}
