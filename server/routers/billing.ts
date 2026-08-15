import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { capacityAddons, plans, subscriptions, tenants } from "../../drizzle/schema";
import { getDb } from "../db";
import { getBillingPlan } from "../billing/products";
import { stripe } from "../billing/stripe";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAdmin } from "../tenantAccess";
import { addonAmount, capacityAddonCatalog, type CapacityAddonType } from "../billing/addons";

function originFromRequest(req: { headers: Record<string, string | string[] | undefined>; protocol: string; get: (header: string) => string | undefined }) {
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.startsWith("http")) return origin;
  const forwarded = req.headers["x-forwarded-proto"];
  const protocol = typeof forwarded === "string" ? forwarded.split(",")[0] : req.protocol || "https";
  return `${protocol}://${req.get("host")}`;
}

async function createStripePrice(planCode: "starter" | "growth" | "scale", interval: "monthly" | "annual") {
  const plan = getBillingPlan(planCode);
  const product = await stripe.products.create({ name: `Flow One ${plan.name}`, description: plan.description, metadata: { plan_code: planCode } });
  return stripe.prices.create({ currency: "brl", unit_amount: interval === "annual" ? plan.annualCents : plan.monthlyCents, recurring: { interval: interval === "annual" ? "year" : "month" }, product: product.id, metadata: { plan_code: planCode } });
}

export const billingRouter = router({
  overview: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [record] = await db.select({ tenantName: tenants.name, tenantStatus: tenants.status, trialEndsAt: tenants.trialEndsAt, planCode: plans.code, planName: plans.name, status: subscriptions.status, interval: subscriptions.billingInterval, billingMethod: subscriptions.billingMethod, paymentMethod: subscriptions.paymentMethod, billingReference: subscriptions.billingReference, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, currentPeriodEndsAt: subscriptions.currentPeriodEndsAt, providerCustomerId: subscriptions.providerCustomerId, providerSubscriptionId: subscriptions.providerSubscriptionId }).from(subscriptions).innerJoin(tenants, eq(subscriptions.tenantId, tenants.id)).innerJoin(plans, eq(subscriptions.planId, plans.id)).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura não encontrada." });
    return record;
  }),

  addonCatalog: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true }); return Object.entries(capacityAddonCatalog).map(([type, item]) => ({ type: type as CapacityAddonType, ...item }));
  }),

  addons: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true }); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db.select().from(capacityAddons).where(eq(capacityAddons.tenantId, input.tenantId)).orderBy(desc(capacityAddons.createdAt));
  }),

  createCheckout: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive(), planCode: z.enum(["starter", "growth", "scale"]), interval: z.enum(["monthly", "annual"]), paymentMethod: z.enum(["automatic", "card", "boleto"]).default("automatic") }))
    .mutation(async ({ ctx, input }) => {
      await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true });
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
      const trialEnd = tenant.status === "trial" && tenant.trialEndsAt && tenant.trialEndsAt.getTime() > Date.now() ? Math.floor(tenant.trialEndsAt.getTime() / 1000) : undefined;
      const paymentMethodTypes = input.paymentMethod === "automatic" ? undefined : [input.paymentMethod] as Array<"card" | "boleto">;
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        client_reference_id: String(ctx.user.id),
        allow_promotion_codes: true,
        ...(paymentMethodTypes ? { payment_method_types: paymentMethodTypes } : {}),
        ...(input.paymentMethod === "boleto" ? { billing_address_collection: "required" as const, tax_id_collection: { enabled: true } } : {}),
        line_items: [{ price_data: { currency: "brl", product_data: { name: `Flow One ${plan.name}`, description: plan.description }, unit_amount: amount, recurring: { interval: input.interval === "annual" ? "year" : "month" } }, quantity: 1 }],
        metadata: { tenant_id: String(input.tenantId), user_id: String(ctx.user.id), plan_code: input.planCode, payment_method: input.paymentMethod, customer_email: tenant.primaryEmail, customer_name: tenant.name },
        subscription_data: { metadata: { tenant_id: String(input.tenantId), plan_code: input.planCode, payment_method: input.paymentMethod }, ...(trialEnd ? { trial_end: trialEnd } : {}), ...(input.paymentMethod === "boleto" ? { collection_method: "charge_automatically" as const, payment_settings: { payment_method_types: ["boleto"] } } : {}) },
        success_url: `${originFromRequest(ctx.req)}/app/billing?success=1`,
        cancel_url: `${originFromRequest(ctx.req)}/app/billing?canceled=1`,
      });
      await db.update(subscriptions).set({ paymentMethod: input.paymentMethod }).where(eq(subscriptions.id, subscription.id));
      if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout não retornou URL." });
      return { url: session.url };
    }),

  createAddonCheckout: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), type: z.enum(["members", "agents", "messages"]), quantity: z.number().int().min(1).max(100) })).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true }); const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1); const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    if (!tenant || !subscription) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa ou assinatura não encontrada." });
    if (subscription.billingMethod !== "stripe") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Este tenant possui cobrança administrada pela plataforma. Solicite o pacote ao administrador." });
    const item = capacityAddonCatalog[input.type]; const result = await db.insert(capacityAddons).values({ tenantId: input.tenantId, type: input.type, quantity: input.quantity, unitPriceCents: item.monthlyCents, billingMethod: "stripe", status: "pending" }); const addonId = Number(result[0].insertId);
    let customerId = subscription.providerCustomerId;
    if (!customerId) { const customer = await stripe.customers.create({ email: tenant.primaryEmail, name: tenant.name, metadata: { tenant_id: String(tenant.id) } }); customerId = customer.id; await db.update(subscriptions).set({ providerCustomerId: customerId }).where(eq(subscriptions.id, subscription.id)); }
    const session = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId, allow_promotion_codes: true, line_items: [{ price_data: { currency: "brl", product_data: { name: `Flow One · ${item.label}`, description: item.description }, unit_amount: item.monthlyCents, recurring: { interval: "month" } }, quantity: input.quantity }], metadata: { tenant_id: String(input.tenantId), capacity_addon_id: String(addonId), addon_type: input.type }, subscription_data: { metadata: { tenant_id: String(input.tenantId), capacity_addon_id: String(addonId), addon_type: input.type } }, success_url: `${originFromRequest(ctx.req)}/app/billing?addon=success`, cancel_url: `${originFromRequest(ctx.req)}/app/billing?addon=canceled` });
    if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Checkout não retornou URL." }); await db.update(capacityAddons).set({ providerCheckoutSessionId: session.id }).where(eq(capacityAddons.id, addonId)); return { url: session.url, amountCents: addonAmount(input.type, input.quantity) };
  }),

  createPortal: protectedProcedure.input(z.object({ tenantId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [subscription] = await db.select({ providerCustomerId: subscriptions.providerCustomerId }).from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    if (!subscription?.providerCustomerId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Crie uma assinatura antes de abrir o portal de cobrança." });
    const session = await stripe.billingPortal.sessions.create({ customer: subscription.providerCustomerId, return_url: `${originFromRequest(ctx.req)}/app/billing` });
    return { url: session.url };
  }),

  changePlan: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), planCode: z.enum(["starter", "growth", "scale"]), interval: z.enum(["monthly", "annual"]) })).mutation(async ({ ctx, input }) => {
    await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true });
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
    await requireTenantAdmin(ctx.user.id, input.tenantId, { allowBillingAccess: true });
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [subscription] = await db.select({ providerCustomerId: subscriptions.providerCustomerId }).from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1);
    if (!subscription?.providerCustomerId) return [];
    const invoices = await stripe.invoices.list({ customer: subscription.providerCustomerId, limit: 12 });
    return invoices.data.map(invoice => ({ id: invoice.id, status: invoice.status, amountPaid: invoice.amount_paid, currency: invoice.currency, createdAt: new Date(invoice.created * 1000), hostedInvoiceUrl: invoice.hosted_invoice_url, invoicePdf: invoice.invoice_pdf }));
  }),
});
