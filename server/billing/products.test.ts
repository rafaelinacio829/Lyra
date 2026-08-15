import { describe, expect, it } from "vitest";
import { BILLING_PLANS, getBillingPlan } from "./products";

describe("billing products", () => {
  it("exposes a valid recurring price for every commercial plan", () => {
    for (const plan of Object.values(BILLING_PLANS)) {
      expect(plan.monthlyCents).toBeGreaterThan(0);
      expect(plan.annualCents).toBeGreaterThan(0);
      expect(plan.annualCents).toBeLessThan(plan.monthlyCents);
    }
  });

  it("rejects a plan that is not part of the Lyra catalog", () => {
    expect(() => getBillingPlan("unknown")).toThrow("Plano não encontrado");
  });
});
