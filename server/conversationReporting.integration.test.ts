import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConnection, type Connection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  requireTenantAccess: vi.fn(),
  assertTenantQuota: vi.fn(),
  validateZapiWebhook: vi.fn(),
  runDifyForInboundMessage: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./tenantAccess", () => ({ requireTenantAccess: mocks.requireTenantAccess }));
vi.mock("./planLimits", () => ({ assertTenantQuota: mocks.assertTenantQuota }));
vi.mock("./routers/integrations", () => ({ validateZapiWebhook: mocks.validateZapiWebhook }));
vi.mock("./services/difyAgent", () => ({ runDifyForInboundMessage: mocks.runDifyForInboundMessage }));

import { contacts, conversations, messages, tenants } from "../drizzle/schema";
import { conversationRouter } from "./routers/conversations";
import { reportRouter } from "./routers/reports";
import { handleZapiWebhook } from "./webhooks/zapi";

const describeIntegration = process.env.FLOW_ONE_DB_INTEGRATION_TESTS === "1" ? describe : describe.skip;

describeIntegration("conversation and reporting integration", () => {
  let connection: Connection;
  let db: ReturnType<typeof drizzle>;
  let tenantId: number;
  let contactId: number;
  let conversationId: number;

  const context = {
    user: { id: 1, openId: "integration-admin", name: "Integration Admin", email: "integration@flowone.test", loginMethod: "local", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as never,
    res: {} as never,
  };

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL é necessária para os testes de integração do banco.");
    vi.clearAllMocks();
    connection = await createConnection(process.env.DATABASE_URL);
    await connection.beginTransaction();
    db = drizzle(connection);
    mocks.getDb.mockResolvedValue(db);
    mocks.requireTenantAccess.mockResolvedValue({ membershipId: 1, role: "tenant_admin" });
    mocks.assertTenantQuota.mockResolvedValue(undefined);
    mocks.validateZapiWebhook.mockResolvedValue({ tenantId: 0 });
    mocks.runDifyForInboundMessage.mockResolvedValue({ replied: true });

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [tenant] = await db.insert(tenants).values({ name: `Integração ${suffix}`, slug: `integration-${suffix}`, primaryEmail: `integration-${suffix}@flowone.test`, status: "active" }).$returningId();
    tenantId = tenant.id;
    mocks.validateZapiWebhook.mockResolvedValue({ tenantId });
    const [contact] = await db.insert(contacts).values({ tenantId, name: "Contato de integração", phone: `5511${suffix.replace(/\D/g, "").slice(-8).padStart(8, "0")}` }).$returningId();
    contactId = contact.id;
    const [conversation] = await db.insert(conversations).values({ tenantId, contactId, queue: "resolved", latestMessagePreview: "Conversa resolvida", unreadCount: 0, resolvedAt: new Date() }).$returningId();
    conversationId = conversation.id;
  });

  afterEach(async () => {
    await connection.rollback();
    await connection.end();
  });

  it("persists reopenedAt through transfer and through Z-API before reporting the tenant queue", async () => {
    const conversationCaller = conversationRouter.createCaller(context);
    await conversationCaller.transfer({ tenantId, conversationId, queue: "ai" });

    let [stored] = await db.select({ queue: conversations.queue, resolvedAt: conversations.resolvedAt, reopenedAt: conversations.reopenedAt }).from(conversations).where(eq(conversations.id, conversationId));
    expect(stored).toMatchObject({ queue: "ai", resolvedAt: null });
    expect(stored.reopenedAt).toBeInstanceOf(Date);

    await db.update(conversations).set({ queue: "resolved", resolvedAt: new Date(), reopenedAt: null, unreadCount: 0 }).where(eq(conversations.id, conversationId));
    const json = vi.fn();
    const response = { json, status: vi.fn(() => ({ json })) } as never;
    const request = { params: { integrationId: "1", webhookKey: "test-key" }, body: { phone: (await db.select({ phone: contacts.phone }).from(contacts).where(eq(contacts.id, contactId)))[0]?.phone, messageId: `zapi-${conversationId}`, message: "Preciso de ajuda novamente" } } as never;

    await handleZapiWebhook(request, response);

    [stored] = await db.select({ queue: conversations.queue, resolvedAt: conversations.resolvedAt, reopenedAt: conversations.reopenedAt, unreadCount: conversations.unreadCount }).from(conversations).where(eq(conversations.id, conversationId));
    expect(stored).toMatchObject({ queue: "ai", resolvedAt: null, unreadCount: 1 });
    expect(stored.reopenedAt).toBeInstanceOf(Date);
    expect(await db.select({ id: messages.id, body: messages.body }).from(messages).where(eq(messages.conversationId, conversationId))).toEqual([expect.objectContaining({ body: "Preciso de ajuda novamente" })]);
    expect(json).toHaveBeenCalledWith({ ok: true });

    await db.insert(conversations).values({ tenantId, contactId, queue: "resolved", latestMessagePreview: "Referência resolvida", unreadCount: 0, resolvedAt: new Date() });

    const reportCaller = reportRouter.createCaller(context);
    const report = await reportCaller.overview({ tenantId, days: 7 });
    expect(report).toMatchObject({ total: 2, resolved: 1, reopenRate: 100, queueVolume: { ai: 1, human: 0, resolved: 1 } });
  });
});
