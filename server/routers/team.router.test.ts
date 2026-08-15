import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess, requireTenantAdmin } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn(), requireTenantAdmin: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess, requireTenantAdmin }));

import { teamRouter } from "./team";

const context = { user: { id: 6, openId: "admin", name: "Admin", email: null, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };

describe("gestão de equipe", () => {
  beforeEach(() => { vi.clearAllMocks(); requireTenantAccess.mockResolvedValue({ membershipId: 18, role: "tenant_admin" }); requireTenantAdmin.mockResolvedValue({ membershipId: 18, role: "tenant_admin" }); });
  it("atualiza a presença somente no vínculo do usuário autenticado", async () => {
    const updates: Array<Record<string, unknown>> = []; getDb.mockResolvedValue({ update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: () => Promise.resolve([{ affectedRows: 1 }]) }; } })) });
    await expect(teamRouter.createCaller(context).updatePresence({ tenantId: 4, presence: "busy" })).resolves.toEqual({ success: true });
    expect(requireTenantAccess).toHaveBeenCalledWith(6, 4); expect(updates).toContainEqual({ presence: "busy" });
  });
  it("edita time e exige correspondência entre time e tenant", async () => {
    const updates: Array<Record<string, unknown>> = []; getDb.mockResolvedValue({ update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: () => Promise.resolve([{ affectedRows: 1 }]) }; } })) });
    await expect(teamRouter.createCaller(context).updateTeam({ tenantId: 4, teamId: 10, name: "Financeiro", description: "Cobrança" })).resolves.toEqual({ success: true });
    expect(requireTenantAdmin).toHaveBeenCalledWith(6, 4); expect(updates).toContainEqual({ name: "Financeiro", description: "Cobrança" });
  });
  it("remove um vínculo de time somente depois de validar o time no tenant", async () => {
    const removals: unknown[] = []; getDb.mockResolvedValue({ select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 10 }]) }) }) })), delete: vi.fn(() => ({ where: (clause: unknown) => { removals.push(clause); return Promise.resolve([{ affectedRows: 1 }]); } })) });
    await expect(teamRouter.createCaller(context).removeMemberFromTeam({ tenantId: 4, teamId: 10, membershipId: 18 })).resolves.toEqual({ success: true });
    expect(requireTenantAdmin).toHaveBeenCalledWith(6, 4); expect(removals).toHaveLength(1);
  });
});
