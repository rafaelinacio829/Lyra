import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, stripe } = vi.hoisted(() => ({
  getDb: vi.fn(),
  stripe: { webhooks: { constructEvent: vi.fn() } },
}));
vi.mock("../db", () => ({ getDb }));
vi.mock("../billing/stripe", () => ({ stripe }));

import { handleStripeWebhook, stripeStatus } from "./stripe";

function responseMock() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function updateRecorder(updates: Array<Record<string, unknown>>) {
  return vi.fn(() => ({
    set: (values: Record<string, unknown>) => {
      updates.push(values);
      return { where: () => Promise.resolve() };
    },
  }));
}

describe("webhook Stripe", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test"); });
  it("mapeia os estados do provedor para os estados aceitos pelo SaaS", () => {
    expect(stripeStatus("active")).toBe("active");
    expect(stripeStatus("trialing")).toBe("trialing");
    expect(stripeStatus("past_due")).toBe("past_due");
    expect(stripeStatus("canceled")).toBe("cancelled");
    expect(stripeStatus("unpaid")).toBe("cancelled");
  });
  it("ativa assinatura e tenant quando o checkout é concluído", async () => {
    const updates: Array<Record<string, unknown>> = [];
    getDb.mockResolvedValue({
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 4 }]) }) }) })),
      update: updateRecorder(updates),
    });
    stripe.webhooks.constructEvent.mockReturnValue({
      id: "evt_live_checkout", type: "checkout.session.completed", created: 1,
      data: { object: { metadata: { tenant_id: "8", plan_code: "growth" }, customer: "cus_8", subscription: "sub_8" } },
    });
    const res = responseMock();
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") } as never, res as never);
    expect(updates).toContainEqual(expect.objectContaining({ planId: 4, providerCustomerId: "cus_8", providerSubscriptionId: "sub_8", status: "active" }));
    expect(updates).toContainEqual({ status: "active" });
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it("reativa uma assinatura quando a fatura correspondente é paga", async () => {
    const updates: Array<Record<string, unknown>> = [];
    getDb.mockResolvedValue({ update: updateRecorder(updates) });
    stripe.webhooks.constructEvent.mockReturnValue({ id: "evt_live_invoice", type: "invoice.paid", created: 1, data: { object: { subscription: "sub_paid" } } });
    const res = responseMock();
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") } as never, res as never);
    expect(updates).toContainEqual({ status: "active" });
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});
