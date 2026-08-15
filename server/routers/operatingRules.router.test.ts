import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess, requireTenantAdmin, recordTenantAudit } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn(), requireTenantAdmin: vi.fn(), recordTenantAudit: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess, requireTenantAdmin }));
vi.mock("../audit", () => ({ recordTenantAudit }));

import { operatingRulesRouter } from "./operatingRules";

const context = { user: { id: 7, openId: "local_7", name: "Admin", email: "admin@acme.test", loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };
const input = { tenantId: 12, isEnabled: true, timezone: "America/Sao_Paulo", businessHours: [{ day: 1, start: "09:00", end: "18:00" }], firstResponseSlaMinutes: 15, inboundRouting: "human_first" as const, handoffOutsideBusinessHours: true, autoEscalateUnassigned: true };

describe("roteador de regras operacionais", () => {
  beforeEach(() => { vi.clearAllMocks(); requireTenantAccess.mockResolvedValue({ role: "tenant_admin" }); requireTenantAdmin.mockResolvedValue({ role: "tenant_admin" }); });

  it("retorna uma política segura padrão quando o tenant ainda não configurou regras", async () => {
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) })) });
    const result = await operatingRulesRouter.createCaller(context).get({ tenantId: 12 });
    expect(requireTenantAccess).toHaveBeenCalledWith(7, 12); expect(result).toMatchObject({ isDefault: true, inboundRouting: "ai_first", firstResponseSlaMinutes: 20 });
  });

  it("persiste política por tenant e registra auditoria sem cruzar acesso", async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined); const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
    getDb.mockResolvedValue({ insert: vi.fn(() => ({ values })) });
    await expect(operatingRulesRouter.createCaller(context).update(input)).resolves.toEqual({ success: true });
    expect(requireTenantAdmin).toHaveBeenCalledWith(7, 12); expect(values).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 12, inboundRouting: "human_first" })); expect(recordTenantAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 12, action: "operating_rules.updated" }));
  });
});
