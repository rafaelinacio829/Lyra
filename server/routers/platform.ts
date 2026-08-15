import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { capacityAddons, integrationConfigs, plans, subscriptions, tenants, usageCounters } from "../../drizzle/schema";
import { getDb } from "../db";
import { platformAdminProcedure, router } from "../_core/trpc";
import { scoreCustomerHealth, summarizePlatformCustomers } from "../platformMetrics";
import { capacityAddonCatalog, type CapacityAddonType } from "../billing/addons";

const customerSelect = { id: tenants.id, name: tenants.name, primaryEmail: tenants.primaryEmail, tenantStatus: tenants.status, trialEndsAt: tenants.trialEndsAt, createdAt: tenants.createdAt, planCode: plans.code, planName: plans.name, monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents, subscriptionStatus: subscriptions.status, billingMethod: subscriptions.billingMethod, billingReference: subscriptions.billingReference, billingInterval: subscriptions.billingInterval, currentPeriodEndsAt: subscriptions.currentPeriodEndsAt, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd };

export const platformRouter = router({
  tenants: platformAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db.select(customerSelect).from(tenants).leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id)).leftJoin(plans, eq(subscriptions.planId, plans.id)).orderBy(desc(tenants.createdAt));
  }),
  overview: platformAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const customers = await db.select(customerSelect).from(tenants).leftJoin(subscriptions, eq(subscriptions.tenantId, tenants.id)).leftJoin(plans, eq(subscriptions.planId, plans.id)).orderBy(desc(tenants.createdAt));
    const periodKey = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit" }).format(new Date()).replace("/", "-");
    const usage = await db.select({ tenantId: usageCounters.tenantId, conversations: usageCounters.conversations, messages: usageCounters.messages }).from(usageCounters).where(eq(usageCounters.periodKey, periodKey));
    const usageByTenant = new Map(usage.map(item => [item.tenantId, item]));
    const customersWithHealth = customers.map(customer => { const activity = usageByTenant.get(customer.id); return { ...customer, conversations: activity?.conversations ?? 0, messages: activity?.messages ?? 0, health: scoreCustomerHealth({ ...customer, conversations: activity?.conversations ?? 0, messages: activity?.messages ?? 0 }) }; });
    const health = { critical: customersWithHealth.filter(customer => customer.health.level === "critical").length, attention: customersWithHealth.filter(customer => customer.health.level === "attention").length, healthy: customersWithHealth.filter(customer => customer.health.level === "healthy").length };
    return { metrics: summarizePlatformCustomers(customers), customers: customersWithHealth, health };
  }),
  operationalIncidents: platformAdminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    return db.select({ id: integrationConfigs.id, tenantId: integrationConfigs.tenantId, tenantName: tenants.name, provider: integrationConfigs.provider, name: integrationConfigs.name, lastError: integrationConfigs.lastError, updatedAt: integrationConfigs.updatedAt }).from(integrationConfigs).innerJoin(tenants, eq(integrationConfigs.tenantId, tenants.id)).where(eq(integrationConfigs.status, "error")).orderBy(desc(integrationConfigs.updatedAt)).limit(20);
  }),
  setTenantStatus: platformAdminProcedure.input(z.object({ tenantId: z.number().int().positive(), status: z.enum(["active", "suspended"]) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado." });
    await db.update(tenants).set({ status: input.status }).where(eq(tenants.id, tenant.id));
    return { success: true };
  }),
  updateSubscription: platformAdminProcedure.input(z.object({ tenantId: z.number().int().positive(), planCode: z.enum(["starter", "growth", "scale"]), status: z.enum(["trialing", "active", "past_due", "paused", "cancelled"]), billingMethod: z.enum(["stripe", "pix", "invoice", "bank_transfer", "manual"]), billingInterval: z.enum(["monthly", "annual"]), billingReference: z.string().max(255).optional().nullable() })).mutation(async ({ input }) => {
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.code, input.planCode)).limit(1); if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
    const [subscription] = await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.tenantId, input.tenantId)).limit(1); if (!subscription) throw new TRPCError({ code: "NOT_FOUND", message: "Assinatura não encontrada." });
    await db.update(subscriptions).set({ planId: plan.id, status: input.status, billingMethod: input.billingMethod, billingInterval: input.billingInterval, billingReference: input.billingReference ?? null }).where(eq(subscriptions.id, subscription.id));
    return { success: true };
  }),
  addCapacity: platformAdminProcedure.input(z.object({ tenantId: z.number().int().positive(), type: z.enum(["members", "agents", "messages"]), quantity: z.number().int().positive().max(100), billingMethod: z.enum(["pix", "invoice", "bank_transfer", "manual"]), status: z.enum(["active", "pending", "past_due", "cancelled"]).default("active") })).mutation(async ({ input }) => {
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." }); const item = capacityAddonCatalog[input.type as CapacityAddonType];
    const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, input.tenantId)).limit(1); if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado." });
    await db.insert(capacityAddons).values({ tenantId: input.tenantId, type: input.type, quantity: input.quantity, unitPriceCents: item.monthlyCents, billingMethod: input.billingMethod, status: input.status, startsAt: input.status === "active" ? new Date() : null }); return { success: true };
  }),
});
