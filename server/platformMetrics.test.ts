import { describe, expect, it } from "vitest";
import { scoreCustomerHealth, summarizePlatformCustomers } from "./platformMetrics";

describe("métricas comerciais de plataforma", () => {
  it("calcula clientes ativos, receita recorrente e riscos a partir de dados reais de assinatura", () => {
    const summary = summarizePlatformCustomers([
      { tenantStatus: "active", subscriptionStatus: "active", monthlyPriceCents: 29900, annualPriceCents: 299000, billingInterval: "monthly", trialEndsAt: null },
      { tenantStatus: "trial", subscriptionStatus: "trialing", monthlyPriceCents: 69900, annualPriceCents: 699000, billingInterval: "annual", trialEndsAt: new Date("2026-08-20T00:00:00Z") },
      { tenantStatus: "active", subscriptionStatus: "past_due", monthlyPriceCents: 149900, annualPriceCents: 1499000, billingInterval: "monthly", trialEndsAt: null },
      { tenantStatus: "suspended", subscriptionStatus: "cancelled", monthlyPriceCents: 29900, annualPriceCents: 299000, billingInterval: "monthly", trialEndsAt: null },
    ], new Date("2026-08-14T00:00:00Z"));
    expect(summary).toMatchObject({ totalCustomers: 4, activeCustomers: 2, trials: 1, paymentRisk: 1, trialEndingSoon: 1, suspended: 1, mrrCents: 88150, arrCents: 1057800 });
  });
});

describe("saúde da carteira", () => {
  it("prioriza cobrança pendente e falta de adoção sem inventar atividade", () => {
    expect(scoreCustomerHealth({ id: 1, tenantStatus: "active", subscriptionStatus: "past_due", monthlyPriceCents: 29900, annualPriceCents: 299000, billingInterval: "monthly", trialEndsAt: null, conversations: 0, messages: 0 })).toMatchObject({ level: "critical", reasons: ["Cobrança pendente"] });
    expect(scoreCustomerHealth({ id: 2, tenantStatus: "active", subscriptionStatus: "active", monthlyPriceCents: 29900, annualPriceCents: 299000, billingInterval: "monthly", trialEndsAt: null, conversations: 0, messages: 0 })).toMatchObject({ level: "attention", reasons: ["Sem atividade no período"] });
  });
});
