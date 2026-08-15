import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { agentProfiles, conversations, integrationConfigs, messages, plans, privateFiles, subscriptions, tenantMemberships, tenants, usageCounters } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAccess } from "../tenantAccess";

const defaultPlans = [
  {
    code: "starter",
    name: "Starter",
    description: "Para equipes que desejam centralizar o atendimento com IA.",
    monthlyPriceCents: 29900,
    annualPriceCents: 23920,
    includedMembers: 3,
    includedConversations: 1500,
    includedMessages: 6000,
    includedAgents: 2,
    includedStorageMb: 2048,
    includedIntegrations: 2,
  },
  {
    code: "growth",
    name: "Growth",
    description: "Para operações em crescimento com automação e gestão de equipes.",
    monthlyPriceCents: 69900,
    annualPriceCents: 55920,
    includedMembers: 10,
    includedConversations: 7000,
    includedMessages: 28000,
    includedAgents: 6,
    includedStorageMb: 10240,
    includedIntegrations: 4,
  },
  {
    code: "scale",
    name: "Scale",
    description: "Para operações críticas com maior volume, governança e prioridade.",
    monthlyPriceCents: 149900,
    annualPriceCents: 119920,
    includedMembers: 30,
    includedConversations: 30000,
    includedMessages: 120000,
    includedAgents: 20,
    includedStorageMb: 51200,
    includedIntegrations: 8,
  },
];

function periodKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

async function ensureDefaultPlans() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

  const rows = await db.select().from(plans).where(inArray(plans.code, defaultPlans.map(plan => plan.code)));
  if (rows.length === defaultPlans.length) return rows;

  for (const plan of defaultPlans) {
    await db.insert(plans).values(plan).onDuplicateKeyUpdate({
      set: {
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.monthlyPriceCents,
        annualPriceCents: plan.annualPriceCents,
        includedMembers: plan.includedMembers,
        includedConversations: plan.includedConversations,
        includedMessages: plan.includedMessages,
        includedAgents: plan.includedAgents,
        includedStorageMb: plan.includedStorageMb,
        includedIntegrations: plan.includedIntegrations,
        isPublic: true,
        isActive: true,
      },
    });
  }

  return db.select().from(plans).where(inArray(plans.code, defaultPlans.map(plan => plan.code)));
}

export const tenantRouter = router({
  availablePlans: protectedProcedure.query(async () => ensureDefaultPlans()),

  mine: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

    return db
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        trialEndsAt: tenants.trialEndsAt,
        brandColor: tenants.brandColor,
        role: tenantMemberships.role,
        presence: tenantMemberships.presence,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .where(and(eq(tenantMemberships.userId, ctx.user.id), eq(tenantMemberships.isActive, true)));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(180),
        primaryEmail: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      const allPlans = await ensureDefaultPlans();
      const starterPlan = allPlans.find(plan => plan.code === "starter");
      if (!starterPlan) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Plano inicial indisponível." });

      const baseSlug = slugify(input.name) || "empresa";
      let slug = baseSlug;
      let suffix = 1;
      while ((await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1)).length) {
        suffix += 1;
        slug = `${baseSlug}-${suffix}`;
      }

      const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const tenant = await db.transaction(async tx => {
        const [createdTenant] = await tx
          .insert(tenants)
          .values({
            name: input.name.trim(),
            slug,
            primaryEmail: input.primaryEmail.toLowerCase(),
            status: "trial",
            trialEndsAt,
          })
          .$returningId();

        await tx.insert(tenantMemberships).values({
          tenantId: createdTenant.id,
          userId: ctx.user.id,
          role: "tenant_admin",
          presence: "online",
        });
        await tx.insert(subscriptions).values({
          tenantId: createdTenant.id,
          planId: starterPlan.id,
          status: "trialing",
          currentPeriodEndsAt: trialEndsAt,
        });
        await tx.insert(usageCounters).values({ tenantId: createdTenant.id, periodKey: periodKey() });
        return createdTenant;
      });

      return { id: tenant.id, slug, trialEndsAt };
    }),

  overview: protectedProcedure
    .input(z.object({ tenantId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const access = await requireTenantAccess(ctx.user.id, input.tenantId);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      const [subscription] = await db
        .select({
          status: subscriptions.status,
          currentPeriodEndsAt: subscriptions.currentPeriodEndsAt,
          planCode: plans.code,
          planName: plans.name,
          includedMembers: plans.includedMembers,
          includedConversations: plans.includedConversations,
          includedMessages: plans.includedMessages,
          includedAgents: plans.includedAgents,
          includedStorageMb: plans.includedStorageMb,
          includedIntegrations: plans.includedIntegrations,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      const [usage] = await db
        .select()
        .from(usageCounters)
        .where(and(eq(usageCounters.tenantId, input.tenantId), eq(usageCounters.periodKey, periodKey())))
        .limit(1);

      const [memberCount] = await db
        .select({ value: count() })
        .from(tenantMemberships)
        .where(and(eq(tenantMemberships.tenantId, input.tenantId), eq(tenantMemberships.isActive, true)));

      const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
      const [conversationCount] = await db.select({ value: count() }).from(conversations).where(and(eq(conversations.tenantId, input.tenantId), gte(conversations.createdAt, monthStart)));
      const [messageCount] = await db.select({ value: count() }).from(messages).where(and(eq(messages.tenantId, input.tenantId), gte(messages.createdAt, monthStart)));
      const [agentCount] = await db.select({ value: count() }).from(agentProfiles).where(and(eq(agentProfiles.tenantId, input.tenantId), eq(agentProfiles.isActive, true)));
      const [integrationCount] = await db.select({ value: count() }).from(integrationConfigs).where(eq(integrationConfigs.tenantId, input.tenantId));
      const [storageCount] = await db.select({ value: sql<number>`coalesce(sum(${privateFiles.sizeBytes}), 0)` }).from(privateFiles).where(eq(privateFiles.tenantId, input.tenantId));
      const [unassignedHuman] = await db.select({ value: count() }).from(conversations).where(and(eq(conversations.tenantId, input.tenantId), eq(conversations.queue, "human"), sql`${conversations.assignedMembershipId} is null`));
      const slaThreshold = new Date(Date.now() - 20 * 60 * 1000);
      const [firstResponseRisk] = await db.select({ value: count() }).from(conversations).where(and(eq(conversations.tenantId, input.tenantId), eq(conversations.queue, "human"), sql`${conversations.firstResponseAt} is null`, gte(conversations.createdAt, new Date(0)), sql`${conversations.createdAt} <= ${slaThreshold}`));

      const actualUsage = {
        activeMembers: memberCount?.value ?? 0,
        conversations: conversationCount?.value ?? 0,
        messages: messageCount?.value ?? 0,
        activeAgents: agentCount?.value ?? 0,
        activeIntegrations: integrationCount?.value ?? 0,
        storageBytes: Number(storageCount?.value ?? 0),
      };
      const alerts: Array<{ id: string; tone: "warning" | "critical" | "info"; title: string; detail: string }> = [];
      if ((unassignedHuman?.value ?? 0) > 0) alerts.push({ id: "unassigned", tone: "warning", title: "Conversas sem atendente", detail: `${unassignedHuman?.value} conversa(s) aguardam responsável.` });
      if ((firstResponseRisk?.value ?? 0) > 0) alerts.push({ id: "sla", tone: "critical", title: "SLA próximo do limite", detail: `${firstResponseRisk?.value} conversa(s) humanas estão sem primeira resposta há mais de 20 minutos.` });
      if (subscription?.status === "trialing" && subscription.currentPeriodEndsAt && subscription.currentPeriodEndsAt.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000) alerts.push({ id: "trial", tone: "info", title: "Trial próximo do fim", detail: `O período de teste termina em ${subscription.currentPeriodEndsAt.toLocaleDateString("pt-BR")}.` });
      const usageChecks = [["conversas", actualUsage.conversations, subscription?.includedConversations], ["mensagens", actualUsage.messages, subscription?.includedMessages], ["armazenamento", actualUsage.storageBytes, (subscription?.includedStorageMb ?? 0) * 1024 * 1024]] as const;
      for (const [label, used, included] of usageChecks) if (included > 0 && used / included >= 0.8) alerts.push({ id: `quota-${label}`, tone: "warning", title: `Uso de ${label} elevado`, detail: `${Math.round((used / included) * 100)}% da franquia do plano já foi utilizada.` });

      const queueRows = await db
        .select({ queue: conversations.queue, value: count() })
        .from(conversations)
        .where(eq(conversations.tenantId, input.tenantId))
        .groupBy(conversations.queue);
      const queueCounts = { ai: 0, human: 0, resolved: 0 };
      for (const row of queueRows) queueCounts[row.queue] = row.value;

      return {
        access,
        subscription,
        usage: actualUsage,
        activeMembers: memberCount?.value ?? 0,
        queueCounts,
        alerts,
      };
    }),
});
