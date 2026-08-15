import { beforeEach, describe, expect, it, vi } from "vitest";
import { subscriptions, tenants } from "../../drizzle/schema";

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
  it("associa o checkout à assinatura sem ativar antecipadamente o tenant em trial", async () => {
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
    expect(updates).toContainEqual(expect.objectContaining({ planId: 4, providerCustomerId: "cus_8", providerSubscriptionId: "sub_8" }));
    expect(updates.some(update => "status" in update)).toBe(false);
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
  it("marca a assinatura como pendente quando a fatura recorrente falha", async () => {
    const updates: Array<Record<string, unknown>> = [];
    getDb.mockResolvedValue({ update: updateRecorder(updates) });
    stripe.webhooks.constructEvent.mockReturnValue({ id: "evt_live_failed_invoice", type: "invoice.payment_failed", created: 1, data: { object: { subscription: "sub_overdue" } } });
    const res = responseMock();
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") } as never, res as never);
    expect(updates).toContainEqual({ status: "past_due" });
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  it.each(["card", "boleto"])("converte trial em assinatura ativa após confirmação via %s", async paymentMethod => {
    const updates: Array<Record<string, unknown>> = [];
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 4 }]) }) }) })), update: updateRecorder(updates) });
    stripe.webhooks.constructEvent.mockReturnValue({ id: `evt_live_trial_${paymentMethod}`, type: "customer.subscription.updated", created: 1, data: { object: { id: "sub_trial", customer: "cus_trial", status: "active", metadata: { tenant_id: "8", plan_code: "starter", payment_method: paymentMethod }, items: { data: [{ price: { recurring: { interval: "month" } }, current_period_end: 1_800_000_000 }] }, cancel_at_period_end: false } } });
    const res = responseMock();
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") } as never, res as never);
    expect(updates).toContainEqual(expect.objectContaining({ status: "active", paymentMethod }));
    expect(updates).toContainEqual({ status: "active" });
  });
  it("mantém o estado persistido no ciclo mensal de boleto entre renovação paga e falha posterior", async () => {
    const state = { subscription: { status: "trialing", paymentMethod: "automatic" }, tenant: { status: "trial" } };
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 4 }]) }) }) })),
      update: vi.fn((table: unknown) => ({ set: (values: Record<string, unknown>) => ({ where: async () => { if (table === subscriptions) Object.assign(state.subscription, values); if (table === tenants) Object.assign(state.tenant, values); } }) })),
    };
    getDb.mockResolvedValue(db);
    const res = responseMock();
    stripe.webhooks.constructEvent.mockReturnValueOnce({ id: "evt_subscription_boleto", type: "customer.subscription.updated", created: 1, data: { object: { id: "sub_boleto", customer: "cus_boleto", status: "active", metadata: { tenant_id: "8", plan_code: "starter", payment_method: "boleto" }, items: { data: [{ price: { recurring: { interval: "month" } }, current_period_end: 1_800_000_000 }] }, cancel_at_period_end: false } } });
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") } as never, res as never);
    stripe.webhooks.constructEvent.mockReturnValueOnce({ id: "evt_invoice_renewal_paid", type: "invoice.paid", created: 2, data: { object: { subscription: "sub_boleto", metadata: { tenant_id: "8" } } } });
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") } as never, res as never);
    expect(state).toMatchObject({ subscription: { status: "active", paymentMethod: "boleto" }, tenant: { status: "active" } });
    stripe.webhooks.constructEvent.mockReturnValueOnce({ id: "evt_invoice_renewal_failed", type: "invoice.payment_failed", created: 3, data: { object: { subscription: "sub_boleto", metadata: { tenant_id: "8" } } } });
    await handleStripeWebhook({ headers: { "stripe-signature": "sig" }, body: Buffer.from("{}") } as never, res as never);
    expect(state).toMatchObject({ subscription: { status: "past_due", paymentMethod: "boleto" }, tenant: { status: "active" } });
  });
});
