import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("BillingPage", () => {
  it("declara hooks de cobrança antes dos retornos condicionais de loading e tenant", () => {
    const source = readFileSync(join(process.cwd(), "client", "src", "pages", "BillingPage.tsx"), "utf8");
    const firstConditionalReturn = source.indexOf("if (tenants.isLoading)");
    expect(source.indexOf("const changePlan = trpc.billing.changePlan.useMutation")).toBeGreaterThan(-1);
    expect(source.indexOf("const invoices = trpc.billing.invoices.useQuery")).toBeGreaterThan(-1);
    expect(source.indexOf("const changePlan = trpc.billing.changePlan.useMutation")).toBeLessThan(firstConditionalReturn);
    expect(source.indexOf("const invoices = trpc.billing.invoices.useQuery")).toBeLessThan(firstConditionalReturn);
  });
});
