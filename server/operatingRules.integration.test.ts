import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn(), requireTenantAdmin: vi.fn(), assertTenantQuota: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./tenantAccess", () => ({ requireTenantAccess: mocks.requireTenantAccess, requireTenantAdmin: mocks.requireTenantAdmin }));
vi.mock("./planLimits", () => ({ assertTenantQuota: mocks.assertTenantQuota }));
vi.mock("./services/zapi", () => ({ sendZapiText: vi.fn() }));

import { contacts, conversationEscalations, conversations, messages, tenantMemberships, tenantOperatingRules, tenants, users } from "../drizzle/schema";
import { operatingRulesRouter } from "./routers/operatingRules";
import { conversationRouter } from "./routers/conversations";
import { runAiForInboundMessage } from "./services/difyAgent";

const describeIntegration = process.env.FLOW_ONE_DB_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeIntegration("regras operacionais integradas", () => {
  let connection: Pool; let db: ReturnType<typeof drizzle>; let tenantId: number; let membershipId: number; let conversationId: number; let userId: number;

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é necessária para os testes de integração do banco.");
    vi.clearAllMocks(); connection = new Pool({ connectionString: process.env.DATABASE_URL }); await connection.query("BEGIN"); db = drizzle(connection); mocks.getDb.mockResolvedValue(db); mocks.assertTenantQuota.mockResolvedValue(undefined);
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const [user] = await db.insert(users).values({ openId: `operating-rules-${suffix}`, name: "Admin de integração", email: `rules-${suffix}@flowone.test`, loginMethod: "password" }).returning(); userId = user.id;
    const [tenant] = await db.insert(tenants).values({ name: `Regras ${suffix}`, slug: `rules-${suffix}`, primaryEmail: `rules-${suffix}@flowone.test`, status: "active" }).returning(); tenantId = tenant.id;
    const [membership] = await db.insert(tenantMemberships).values({ tenantId, userId, role: "tenant_admin", isActive: true }).returning(); membershipId = membership.id;
    const [contact] = await db.insert(contacts).values({ tenantId, name: "Contato escalado", phone: `5511${suffix.replace(/\D/g, "").slice(-8).padStart(8, "0")}` }).returning();
    const [conversation] = await db.insert(conversations).values({ tenantId, contactId: contact.id, queue: "ai", latestMessagePreview: "Preciso falar com uma pessoa", unreadCount: 1 }).returning(); conversationId = conversation.id;
    mocks.requireTenantAccess.mockResolvedValue({ membershipId, role: "tenant_admin" }); mocks.requireTenantAdmin.mockResolvedValue({ membershipId, role: "tenant_admin" });
  });

  afterEach(async () => { await connection.query("ROLLBACK"); await connection.end(); });

  it("persiste a política, roteia a entrada para humano, cria escalonamento e permite que o atendente assuma", async () => {
    const context = { user: { id: userId, openId: "integration", name: "Admin", email: null, loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };
    const rulesCaller = operatingRulesRouter.createCaller(context);
    await rulesCaller.update({ tenantId, isEnabled: true, timezone: "America/Sao_Paulo", businessHours: [{ day: 1, start: "09:00", end: "18:00" }], firstResponseSlaMinutes: 15, inboundRouting: "human_first", handoffOutsideBusinessHours: true, autoEscalateUnassigned: true });
    expect(await rulesCaller.get({ tenantId })).toMatchObject({ isDefault: false, inboundRouting: "human_first", firstResponseSlaMinutes: 15 });
    expect((await db.select().from(tenantOperatingRules).where(eq(tenantOperatingRules.tenantId, tenantId)))[0]).toMatchObject({ inboundRouting: "human_first", firstResponseSlaMinutes: 15 });

    await expect(runAiForInboundMessage({ tenantId, conversationId, contactId: (await db.select({ id: contacts.id }).from(contacts).where(eq(contacts.tenantId, tenantId)))[0].id, contactPhone: "5511999999999", body: "Quero uma pessoa" })).resolves.toEqual({ skipped: "human_routing" });
    expect((await db.select({ queue: conversations.queue, assignedMembershipId: conversations.assignedMembershipId }).from(conversations).where(eq(conversations.id, conversationId)))[0]).toMatchObject({ queue: "human", assignedMembershipId: null });
    const [escalation] = await db.select().from(conversationEscalations).where(and(eq(conversationEscalations.tenantId, tenantId), eq(conversationEscalations.conversationId, conversationId)));
    expect(escalation).toMatchObject({ status: "pending", reason: "human_routing" });
    expect(await db.select({ body: messages.body }).from(messages).where(eq(messages.conversationId, conversationId))).toEqual([expect.objectContaining({ body: expect.stringContaining("Escalonamento automático") })]);

    await expect(conversationRouter.createCaller(context).acknowledgeEscalation({ tenantId, escalationId: escalation.id })).resolves.toEqual({ success: true, conversationId });
    expect((await db.select().from(conversationEscalations).where(eq(conversationEscalations.id, escalation.id)))[0]).toMatchObject({ status: "acknowledged", acknowledgedMembershipId: membershipId });
    expect((await db.select({ queue: conversations.queue, assignedMembershipId: conversations.assignedMembershipId }).from(conversations).where(eq(conversations.id, conversationId)))[0]).toMatchObject({ queue: "human", assignedMembershipId: membershipId });
  });
});
