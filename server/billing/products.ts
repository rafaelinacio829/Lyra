export const BILLING_PLANS = {
  starter: { name: "Starter", monthlyCents: 29900, annualCents: 23900, description: "Para estruturar o atendimento com governança." },
  growth: { name: "Growth", monthlyCents: 69900, annualCents: 55900, description: "Para equipes que precisam escalar com previsibilidade." },
  scale: { name: "Scale", monthlyCents: 149900, annualCents: 119900, description: "Para operações críticas e mais capacidade." },
} as const;

export type BillingPlanCode = keyof typeof BILLING_PLANS;

export function getBillingPlan(code: string) {
  const plan = BILLING_PLANS[code as BillingPlanCode];
  if (!plan) throw new Error("Plano não encontrado.");
  return plan;
}
