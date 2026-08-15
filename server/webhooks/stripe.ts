import type { Request, Response } from "express";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { capacityAddons, plans, subscriptions, tenants } from "../../drizzle/schema";
import { getDb } from "../db";
import { stripe } from "../billing/stripe";

export function stripeStatus(status: string) {
  if (status === "active") return "active" as const;
  if (status === "trialing") return "trialing" as const;
  if (status === "past_due") return "past_due" as const;
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") return "cancelled" as const;
  return "active" as const;
}

async function planIdFromCode(code: string | undefined) {
  const db = await getDb();
  if (!db || !code) return null;
  const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, code)).limit(1);
  return plan?.id ?? null;
}

export async function handleStripeWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string" || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).json({ error: "signature_missing" });
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET); } catch { return res.status(400).json({ error: "signature_invalid" }); }
  if (event.id.startsWith("evt_test_")) return res.json({ verified: true });
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = Number(session.metadata?.tenant_id);
      const addonId = Number(session.metadata?.capacity_addon_id);
      if (Number.isInteger(addonId) && addonId > 0) await db.update(capacityAddons).set({ providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : null }).where(eq(capacityAddons.id, addonId));
      const planId = await planIdFromCode(session.metadata?.plan_code);
      if (Number.isInteger(tenantId) && planId) {
        const paymentMethod = session.metadata?.payment_method;
        await db.update(subscriptions).set({ planId, providerCustomerId: typeof session.customer === "string" ? session.customer : null, providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : null, ...(paymentMethod === "card" || paymentMethod === "boleto" || paymentMethod === "automatic" ? { paymentMethod } : {}), cancelAtPeriodEnd: false }).where(eq(subscriptions.tenantId, tenantId));
      }
    }
    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = Number(subscription.metadata.tenant_id);
      const addonId = Number(subscription.metadata.capacity_addon_id);
      if (Number.isInteger(addonId) && addonId > 0) await db.update(capacityAddons).set({ status: subscription.status === "past_due" ? "past_due" : subscription.status === "canceled" ? "cancelled" : "active", providerSubscriptionId: subscription.id, endsAt: subscription.status === "canceled" ? new Date() : null }).where(eq(capacityAddons.id, addonId));
      if (Number.isInteger(tenantId)) {
        const planId = await planIdFromCode(subscription.metadata.plan_code);
        const paymentMethod = subscription.metadata.payment_method;
        await db.update(subscriptions).set({ ...(planId ? { planId } : {}), providerSubscriptionId: subscription.id, providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : null, status: stripeStatus(subscription.status), ...(paymentMethod === "card" || paymentMethod === "boleto" || paymentMethod === "automatic" ? { paymentMethod } : {}), billingInterval: subscription.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly", cancelAtPeriodEnd: subscription.cancel_at_period_end, currentPeriodEndsAt: subscription.items.data[0]?.current_period_end ? new Date(subscription.items.data[0].current_period_end * 1000) : null }).where(eq(subscriptions.tenantId, tenantId));
        if (subscription.status === "trialing") await db.update(tenants).set({ status: "trial" }).where(eq(tenants.id, tenantId));
        if (subscription.status === "active") await db.update(tenants).set({ status: "active" }).where(eq(tenants.id, tenantId));
        if (subscription.status === "canceled") await db.update(tenants).set({ status: "suspended" }).where(eq(tenants.id, tenantId));
      }
    }
    if (event.type === "invoice.paid") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription ?? null;
      if (subscriptionId) { await db.update(subscriptions).set({ status: "active" }).where(eq(subscriptions.providerSubscriptionId, subscriptionId)); await db.update(tenants).set({ status: "active" }).where(eq(tenants.id, Number(invoice.metadata?.tenant_id) || 0)); }
    }
    if (event.type === "invoice.payment_failed" || event.type === "invoice.voided" || event.type === "invoice.marked_uncollectible") {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = (invoice as unknown as { subscription?: string }).subscription ?? null;
      if (subscriptionId) await db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.providerSubscriptionId, subscriptionId));
    }
    console.info("[Stripe webhook]", { eventType: event.type, eventId: event.id, created: event.created });
    return res.json({ received: true });
  } catch (error) {
    console.error("[Stripe webhook] processing failed", { eventType: event.type, eventId: event.id });
    return res.status(500).json({ error: "processing_failed" });
  }
}
