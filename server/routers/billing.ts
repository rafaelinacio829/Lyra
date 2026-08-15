import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { plans, subscriptions, tenants } from "../../drizzle/schema";
import { getDb } from "../db";
import { getBillingPlan } from "../billing/products";
import { stripe } from "../billing/stripe";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAdmin } from "../tenantAccess";

function originFromRequest(req: { headers: Record<string, string | string[] | undefined>; protocol: string; get: (header: string) => string | undefined }) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.startsWith("http")) return origin;
  const forwarded = req.headers["x-forwarded-proto"];
  const protocol = typeof forwarded === "string" ? forwarded.split(",")[0] : req.protocol || "https";
  return `${protocol}://${req.get("host")}`;
}

async function createStripePrice(planCode: "starter" | "growth" | "scale", interval: "monthly" | "annual") {
  const plan = getBillingPlan(planCode);
  const product = await stripe.products.create({ name: `Lyra ${plan.name}`, description: plan.description, metadata: { plan_code: planCode } });
  return stripe.prices.create({ currency: "brl", unit_amount: interval === "annual" ? plan.annualCents : plan.monthlyCents, recurring: { interval: interval === "annual" ? "year" : "month" }, product: product.id, metadata: { plan_code: planCode } });
}

export const billingRouter = router({
  overview: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [record] = await db.select({ tenantName: tenants.name, tenantStatus: tenants.status, trialEndsAt: tenants.trialEndsAt, planCode: plans.code, planName: plans.name, status: subscriptions.status, interval: subscriptions.billingInterval, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, currentPeriodEndsAt: subscriptions.currentPeriodEndsAt, providerCustomerId: subscriptions.providerCustomerId, providerSubscriptionId: subscriptions.providerSubscriptionId }).from(subscriptions).innerJoin(tenants, eq(subscriptions.tenantId, tenants.id)).innerJoin(plans, eq(subscriptions.planId, plans.id)).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura não encontrada." });
    return record;
  }),

  createCheckout: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), planCode: z.enum(["starter", "growth", "scale"]), interval: z.enum(["monthly", "annual"]) }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
      const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
      if (!tenant || !subscription) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa ou assinatura não encontrada." });
      const plan = getBillingPlan(input.planCode);
      let customerId = subscription.providerCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: tenant.primaryEmail, name: tenant.name, metadata: { tenant_id: String(tenant.id), owner_user_id: String(ctx.user.id) } });
        customerId = customer.id;
        await db.update(subscriptions).set({ providerCustomerId: customerId }).where(eq(subscriptions.id, subscription.id));
      }
      const amount = input.interval === "annual" ? plan.annualCents : plan.monthlyCents;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: String(ctx.user.id),
        allow_promotion_codes: true,
        line_items: [{ price_data: { currency: "brl", product_data: { name: `Lyra ${plan.name}`, description: plan.description }, unit_amount: amount, recurring: { interval: input.interval === "annual" ? "year" : "month" } }, quantity: 1 }],
        metadata: { tenant_id: String(input.tenantId), user_id: String(ctx.user.id), plan_code: input.planCode, customer_email: tenant.primaryEmail, customer_name: tenant.name },
        subscription_data: { metadata: { tenant_id: String(input.tenantId), plan_code: input.planCode } },
        success_url: `${originFromRequest(ctx.req)}/app/billing?success=1`,
        cancel_url: `${originFromRequest(ctx.req)}/app/billing?canceled=1`,
      });
      if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout não retornou URL." });
      return { url: session.url };
    }),

  createPortal: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [subscription] = await db.select({ providerCustomerId: subscriptions.providerCustomerId }).from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    if (!subscription?.providerCustomerId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Crie uma assinatura antes de abrir o portal de cobrança." });
    const session = await stripe.billingPortal.sessions.create({ customer: subscription.providerCustomerId, return_url: `${originFromRequest(ctx.req)}/app/billing` });
    return { url: session.url };
  }),

  changePlan: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), planCode: z.enum(["starter", "growth", "scale"]), interval: z.enum(["monthly", "annual"]) })).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    const [targetPlan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, input.planCode)).limit(1);
    if (!subscription || !targetPlan) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura ou plano não encontrado." });
    if (!subscription.providerSubscriptionId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Crie uma assinatura pelo checkout antes de alterar o plano." });
    try {
      const current = await stripe.subscriptions.retrieve(subscription.providerSubscriptionId);
      const item = current.items.data[0];
      if (!item) throw new Error("Item da assinatura ausente.");
      const price = await createStripePrice(input.planCode, input.interval);
      const changed = await stripe.subscriptions.update(current.id, { items: [{ id: item.id, price: price.id }], proration_behavior: "create_prorations", metadata: { tenant_id: String(input.tenantId), plan_code: input.planCode } });
      await db.update(subscriptions).set({ planId: targetPlan.id, billingInterval: input.interval, status: changed.status === "trialing" ? "trialing" : changed.status === "past_due" ? "past_due" : "active" }).where(eq(subscriptions.id, subscription.id));
      return { success: true };
    } catch {
      throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível alterar a assinatura agora. Revise o método de pagamento no portal e tente novamente." });
    }
  }),

  invoices: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [subscription] = await db.select({ providerCustomerId: subscriptions.providerCustomerId }).from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    if (!subscription?.providerCustomerId) return [];
    const invoices = await stripe.invoices.list({ customer: subscription.providerCustomerId, limit: 12 });
    return invoices.data.map(invoice => ({ id: invoice.id, status: invoice.status, amountPaid: invoice.amount_paid, currency: invoice.currency, createdAt: new Date(invoice.created * 1000), hostedInvoiceUrl: invoice.hosted_invoice_url, invoicePdf: invoice.invoice_pdf }));
  }),
});
