import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAdmin, assertTenantQuota, recordTenantAudit } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAdmin: vi.fn(), assertTenantQuota: vi.fn(), recordTenantAudit: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAdmin }));
vi.mock("../planLimits", () => ({ assertTenantQuota }));
vi.mock("../audit", () => ({ recordTenantAudit }));
import { integrationRouter } from "./integrations";

const context = { user: { id: 5, openId: "admin", name: "Admin", email: null, loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", get: () => "flow-one.test", header: () => undefined } as never, res: {} as never };
const chain = (value: unknown) => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(value) }) }) });

describe("integrations.saveZapi multicanal", () => {
  beforeEach(() => { vi.clearAllMocks(); requireTenantAdmin.mockResolvedValue({ membershipId: 1 }); assertTenantQuota.mockResolvedValue(undefined); recordTenantAudit.mockResolvedValue(undefined); });
  it("salva duas conexões nomeadas no mesmo tenant sem misturar suas credenciais", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ id: 11 }])).mockReturnValueOnce(chain([])).mockReturnValueOnce(chain([{ id: 12 }]));
    const values = vi.fn();
    getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values: (value: unknown) => { values(value); return { onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined) }; } })) });
    const caller = integrationRouter.createCaller(context);
    await caller.saveZapi({ tenantId: 9, name: "Vendas", instanceId: "inst-vendas", instanceToken: "token-12345678", clientToken: "client-12345678" });
    await caller.saveZapi({ tenantId: 9, name: "Suporte", instanceId: "inst-suporte", instanceToken: "token-87654321", clientToken: "client-87654321" });
    expect(values.mock.calls.map(call => (call[0] as { name: string }).name)).toEqual(["Vendas", "Suporte"]);
    expect(assertTenantQuota).toHaveBeenCalledTimes(2);
    expect(recordTenantAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 9, action: "integration.zapi_configured" }));
  });
});
