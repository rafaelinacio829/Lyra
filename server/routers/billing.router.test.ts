import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAdmin, stripe } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAdmin: vi.fn(), stripe: { customers: { create: vi.fn() }, checkout: { sessions: { create: vi.fn() } }, billingPortal: { sessions: { create: vi.fn() } }, invoices: { list: vi.fn() }, products: { create: vi.fn() }, prices: { create: vi.fn() }, subscriptions: { retrieve: vi.fn(), update: vi.fn() } } }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAdmin }));
vi.mock("../billing/stripe", () => ({ stripe }));

import { billingRouter } from "./billing";

const context = { user: { id: 3, openId: "admin", name: "Admin", email: "admin@example.test", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: { origin: "https://lyra.example.test" }, protocol: "https", get: () => "lyra.example.test" }, res: {} as never };

function queueDbRows(...rows: unknown[][]) {
  const queue = [...rows];
  getDb.mockResolvedValue({
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(queue.shift() ?? []) }) }) })),
    update: vi.fn(() => ({ set: () => ({ where: () => Promise.resolve() }) })),
  });
}

describe("billing router", () => {
  beforeEach(() => { vi.clearAllMocks(); requireTenantAdmin.mockResolvedValue({ membershipId: 4, role: "tenant_admin" }); });
  it("cria checkout com o customer existente e metadados do tenant", async () => {
    queueDbRows([{ id: 8, name: "Acme", primaryEmail: "financeiro@acme.test" }], [{ id: 15, providerCustomerId: "cus_existing" }]); stripe.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.test/session" });
    await expect(billingRouter.createCaller(context).createCheckout({ tenantId: 8, planCode: "growth", interval: "monthly" })).resolves.toEqual({ url: "https://checkout.stripe.test/session" });
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({ customer: "cus_existing", metadata: expect.objectContaining({ tenant_id: "8", plan_code: "growth" }), success_url: "https://lyra.example.test/app/billing?success=1" }));
  });
  it("cria sessão do portal somente para o customer do tenant", async () => {
    queueDbRows([{ providerCustomerId: "cus_tenant" }]); stripe.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.test/session" });
    await expect(billingRouter.createCaller(context).createPortal({ tenantId: 8 })).resolves.toEqual({ url: "https://billing.stripe.test/session" });
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({ customer: "cus_tenant", return_url: "https://lyra.example.test/app/billing" });
  });
  it("lista faturas do customer associado ao tenant", async () => {
    queueDbRows([{ providerCustomerId: "cus_tenant" }]); stripe.invoices.list.mockResolvedValue({ data: [{ id: "in_1", status: "paid", amount_paid: 29900, currency: "brl", created: 1_700_000_000, hosted_invoice_url: "https://stripe.test/invoice", invoice_pdf: "https://stripe.test/invoice.pdf" }] });
    const result = await billingRouter.createCaller(context).invoices({ tenantId: 8 });
    expect(stripe.invoices.list).toHaveBeenCalledWith({ customer: "cus_tenant", limit: 12 }); expect(result[0]).toMatchObject({ id: "in_1", amountPaid: 29900, status: "paid" });
  });
});
