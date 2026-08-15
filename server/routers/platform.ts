import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { plans, subscriptions, tenants } from "../../drizzle/schema";
import { getDb } from "../db";
import { platformAdminProcedure, router } from "../_core/trpc";
import { summarizePlatformCustomers } from "../platformMetrics";

const customerSelect = { id: tenants.id, name: tenants.name, primaryEmail: tenants.primaryEmail, tenantStatus: tenants.status, trialEndsAt: tenants.trialEndsAt, createdAt: tenants.createdAt, planName: plans.name, monthlyPriceCents: plans.monthlyPriceCents, annualPriceCents: plans.annualPriceCents, subscriptionStatus: subscriptions.status, billingInterval: subscriptions.billingInterval, currentPeriodEndsAt: subscriptions.currentPeriodEndsAt, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd };

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
    return { metrics: summarizePlatformCustomers(customers), customers };
  }),
  setTenantStatus: platformAdminProcedure.input(z.object({ tenantId: z.number().int().positive(), status: z.enum(["active", "suspended"]) })).mutation(async ({ input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant não encontrado." });
    await db.update(tenants).set({ status: input.status }).where(eq(tenants.id, tenant.id));
    return { success: true };
  }),
});
