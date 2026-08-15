import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess }));

import { conversationRouter } from "./conversations";

describe("conversations.transfer", () => {
  beforeEach(() => {
    requireTenantAccess.mockResolvedValue({ membershipId: 9, role: "tenant_admin" });
    const updates: Array<Record<string, unknown>> = [];
    getDb.mockResolvedValue({
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 55, queue: "resolved" }]) }) }) })),
      update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: () => Promise.resolve() }; } })),
      __updates: updates,
    });
  });

  it("persists reopenedAt when a resolved conversation is moved back to AI", async () => {
    const db = await getDb();
    const caller = conversationRouter.createCaller({ user: { id: 1, openId: "owner", name: "Owner", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never });
    await caller.transfer({ tenantId: 8, conversationId: 55, queue: "ai" });
    expect(db.__updates[0]).toMatchObject({ queue: "ai", resolvedAt: null });
    expect(db.__updates[0].reopenedAt).toBeInstanceOf(Date);
  });
});
