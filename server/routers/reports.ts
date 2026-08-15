import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { conversations, messages, tenantMemberships, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { requireTenantAccess } from "../tenantAccess";
import { queueVolumeFromRows } from "../metricsRules";
import { summarizeTenantReport } from "../reportMetrics";

function periodStart(days: number) { return new Date(Date.now() - days * 24 * 60 * 60 * 1000); }

export const reportRouter = router({
  overview: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), days: z.number().int().min(7).max(90).default(30) })).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const since = periodStart(input.days);
    const [kpis] = await db.select({ total: countSql(), resolved: sql<number>`coalesce(sum(case when ${conversations.resolvedAt} is not null then 1 else 0 end), 0)`, reopened: sql<number>`coalesce(sum(case when ${conversations.reopenedAt} is not null then 1 else 0 end), 0)`, responded: sql<number>`coalesce(sum(case when ${conversations.firstResponseAt} is not null then 1 else 0 end), 0)`, avgFirstResponseSeconds: sql<number | null>`avg(case when ${conversations.firstResponseAt} is not null then timestampdiff(second, ${conversations.createdAt}, ${conversations.firstResponseAt}) else null end)` }).from(conversations).where(and(eq(conversations.tenantId, input.tenantId), gte(conversations.createdAt, since)));
    const queueRows = await db.select({ queue: conversations.queue, value: countSql() }).from(conversations).where(and(eq(conversations.tenantId, input.tenantId), gte(conversations.createdAt, since))).groupBy(conversations.queue);
    const summary = summarizeTenantReport({ total: kpis?.total ?? 0, resolved: kpis?.resolved ?? 0, reopened: kpis?.reopened ?? 0, avgFirstResponseSeconds: kpis?.avgFirstResponseSeconds ?? null, queueRows });
    const productivity = await db.select({ membershipId: tenantMemberships.id, name: users.name, assigned: countSql(conversations.id), resolved: sql<number>`coalesce(sum(case when ${conversations.resolvedAt} is not null then 1 else 0 end), 0)`, avgFirstResponseSeconds: sql<number | null>`avg(case when ${conversations.firstResponseAt} is not null then timestampdiff(second, ${conversations.createdAt}, ${conversations.firstResponseAt}) else null end)` }).from(tenantMemberships).innerJoin(users, eq(tenantMemberships.userId, users.id)).leftJoin(conversations, and(eq(conversations.assignedMembershipId, tenantMemberships.id), gte(conversations.createdAt, since))).where(and(eq(tenantMemberships.tenantId, input.tenantId), eq(tenantMemberships.isActive, true))).groupBy(tenantMemberships.id, users.id).orderBy(desc(sql<number>`coalesce(sum(case when ${conversations.resolvedAt} is not null then 1 else 0 end), 0)`));
    return { periodDays: input.days, ...summary, responded: Number(kpis?.responded ?? 0), productivity: productivity.map(row => ({ ...row, assigned: Number(row.assigned ?? 0), resolved: Number(row.resolved ?? 0), firstResponseMinutes: row.avgFirstResponseSeconds ? Math.round(Number(row.avgFirstResponseSeconds) / 60) : null })) };
  }),

  exportConversation: protectedProcedure.input(z.object({ tenantId: z.number().int().positive(), conversationId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    await requireTenantAccess(ctx.user.id, input.tenantId);
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const [conversation] = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.id, input.conversationId), eq(conversations.tenantId, input.tenantId))).limit(1);
    if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada nesta empresa." });
    return db.select({ date: messages.createdAt, direction: messages.direction, channel: messages.channel, body: messages.body, author: users.name }).from(messages).leftJoin(tenantMemberships, eq(messages.authorMembershipId, tenantMemberships.id)).leftJoin(users, eq(tenantMemberships.userId, users.id)).where(and(eq(messages.tenantId, input.tenantId), eq(messages.conversationId, input.conversationId))).orderBy(asc(messages.createdAt));
  }),
});

function countSql(column = conversations.id) { return sql<number>`count(${column})`; }
