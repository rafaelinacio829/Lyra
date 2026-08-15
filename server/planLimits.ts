import { and, count, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { agentProfiles, capacityAddons, conversations, integrationConfigs, messages, plans, privateFiles, subscriptions, tenantMemberships } from "../drizzle/schema";
import { getDb } from "./db";

export type TenantQuota = "members" | "agents" | "integrations" | "conversations" | "messages" | "storage";

function periodStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function tenantPlan(tenantId: number) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const [subscription] = await db
    .select({ status: subscriptions.status, includedMembers: plans.includedMembers, includedAgents: plans.includedAgents, includedIntegrations: plans.includedIntegrations, includedConversations: plans.includedConversations, includedMessages: plans.includedMessages, includedStorageMb: plans.includedStorageMb, planName: plans.name })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);
  if (!subscription) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "O tenant não possui plano ativo." });
  if (!["trialing", "active", "past_due"].includes(subscription.status)) throw new TRPCError({ code: "FORBIDDEN", message: "A assinatura deste tenant não permite novas operações." });
  const [addons] = await db.select({ members: sql<number>`coalesce(sum(case when ${capacityAddons.type} = 'members' then ${capacityAddons.quantity} else 0 end), 0)`, agents: sql<number>`coalesce(sum(case when ${capacityAddons.type} = 'agents' then ${capacityAddons.quantity} else 0 end), 0)`, messages: sql<number>`coalesce(sum(case when ${capacityAddons.type} = 'messages' then ${capacityAddons.quantity} * 10000 else 0 end), 0)` }).from(capacityAddons).where(and(eq(capacityAddons.tenantId, tenantId), eq(capacityAddons.status, "active")));
  return { ...subscription, addonMembers: Number(addons?.members ?? 0), addonAgents: Number(addons?.agents ?? 0), addonMessages: Number(addons?.messages ?? 0) };
}

async function currentUsage(tenantId: number, quota: TenantQuota) {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  if (quota === "members") {
    const [row] = await db.select({ value: count() }).from(tenantMemberships).where(and(eq(tenantMemberships.tenantId, tenantId), eq(tenantMemberships.isActive, true)));
    return row?.value ?? 0;
  }
  if (quota === "agents") {
    const [row] = await db.select({ value: count() }).from(agentProfiles).where(and(eq(agentProfiles.tenantId, tenantId), eq(agentProfiles.isActive, true)));
    return row?.value ?? 0;
  }
  if (quota === "integrations") {
    const [row] = await db.select({ value: count() }).from(integrationConfigs).where(eq(integrationConfigs.tenantId, tenantId));
    return row?.value ?? 0;
  }
  if (quota === "conversations") {
    const [row] = await db.select({ value: count() }).from(conversations).where(and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, periodStart())));
    return row?.value ?? 0;
  }
  if (quota === "messages") {
    const [row] = await db.select({ value: count() }).from(messages).where(and(eq(messages.tenantId, tenantId), gte(messages.createdAt, periodStart())));
    return row?.value ?? 0;
  }
  const [row] = await db.select({ value: sql<number>`coalesce(sum(${privateFiles.sizeBytes}), 0)` }).from(privateFiles).where(eq(privateFiles.tenantId, tenantId));
  return Number(row?.value ?? 0);
}

export async function assertTenantQuota(tenantId: number, quota: TenantQuota, increment = 1) {
  const plan = await tenantPlan(tenantId);
  const limits = { members: plan.includedMembers + plan.addonMembers, agents: plan.includedAgents + plan.addonAgents, integrations: plan.includedIntegrations, conversations: plan.includedConversations, messages: plan.includedMessages + plan.addonMessages, storage: plan.includedStorageMb * 1024 * 1024 };
  const current = await currentUsage(tenantId, quota);
  if (current + increment > limits[quota]) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `O limite de ${quota} do plano ${plan.planName} foi atingido. Escolha um plano com mais capacidade para continuar.` });
  }
}
