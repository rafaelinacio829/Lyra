import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), validateZapiWebhook: vi.fn(), assertTenantQuota: vi.fn(), runDifyForInboundMessage: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../routers/integrations", () => ({ validateZapiWebhook: mocks.validateZapiWebhook }));
vi.mock("../planLimits", () => ({ assertTenantQuota: mocks.assertTenantQuota }));
vi.mock("../services/difyAgent", () => ({ runDifyForInboundMessage: mocks.runDifyForInboundMessage }));

import { handleZapiWebhook } from "./zapi";

function queryChain(value: unknown) {
  const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: () => Promise.resolve(value) };
  return chain;
}

describe("Z-API inbound webhook", () => {
  it("reopens and persists a resolved conversation before processing the inbound message", async () => {
    mocks.validateZapiWebhook.mockResolvedValue({ id: 1, tenantId: 8 });
    mocks.runDifyForInboundMessage.mockResolvedValue({ replied: true });
    const selectResponses = [[], [{ id: 12, phone: "5511999999999" }], [{ id: 55, queue: "resolved", unreadCount: 0 }], [{ id: 55, queue: "ai", unreadCount: 0 }]];
    const updates: Array<Record<string, unknown>> = [];
    mocks.getDb.mockResolvedValue({
      select: vi.fn(() => queryChain(selectResponses.shift())),
      update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: () => Promise.resolve() }; } })),
      insert: vi.fn(() => ({ values: () => Promise.resolve() })),
    });
    const json = vi.fn();
    const req = { params: { integrationId: "1", webhookKey: "valid" }, body: { phone: "5511999999999", messageId: "m-1", message: "Preciso de ajuda" } } as never;
    const res = { json, status: vi.fn(() => ({ json })) } as never;

    await handleZapiWebhook(req, res);

    expect(updates[0]).toMatchObject({ queue: "ai", resolvedAt: null, assignedMembershipId: null });
    expect(updates[0].reopenedAt).toBeInstanceOf(Date);
    expect(json).toHaveBeenCalledWith({ ok: true });
  });
});
