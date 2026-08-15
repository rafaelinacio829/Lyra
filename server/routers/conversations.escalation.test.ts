import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess, recordTenantAudit } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn(), recordTenantAudit: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess }));
vi.mock("../audit", () => ({ recordTenantAudit }));

import { conversationRouter } from "./conversations";

const context = { user: { id: 3, openId: "local_3", name: "Atendente", email: null, loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };

describe("conversations.acknowledgeEscalation", () => {
  beforeEach(() => { vi.clearAllMocks(); requireTenantAccess.mockResolvedValue({ membershipId: 19, role: "agent" }); });

  it("atribui o caso ao atendente, persiste a assunção e registra uma nota interna", async () => {
    const limit = vi.fn().mockResolvedValue([{ id: 44, conversationId: 81 }]);
    const where = vi.fn(() => ({ limit })); const from = vi.fn(() => ({ where })); const select = vi.fn(() => ({ from }));
    const updates: Array<Record<string, unknown>> = []; const update = vi.fn(() => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: vi.fn().mockResolvedValue(undefined) }; } }));
    const values = vi.fn().mockResolvedValue(undefined); const insert = vi.fn(() => ({ values }));
    getDb.mockResolvedValue({ select, update, insert });

    await expect(conversationRouter.createCaller(context).acknowledgeEscalation({ tenantId: 12, escalationId: 44 })).resolves.toEqual({ success: true, conversationId: 81 });
    expect(updates[0]).toMatchObject({ status: "acknowledged", acknowledgedMembershipId: 19 }); expect(updates[1]).toMatchObject({ queue: "human", assignedMembershipId: 19 }); expect(values).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 81, direction: "internal_note" })); expect(recordTenantAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "conversation.escalation_acknowledged", tenantId: 12 }));
  });
});
