import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess, requireTenantAdmin, recordTenantAudit } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn(), requireTenantAdmin: vi.fn(), recordTenantAudit: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess, requireTenantAdmin }));
vi.mock("../audit", () => ({ recordTenantAudit }));
vi.mock("../planLimits", () => ({ assertTenantQuota: vi.fn() }));
import { integrationRouter } from "./integrations";

const context = { user: { id: 3, openId: "admin", name: "Admin", email: null, loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", get: () => "flow-one.test", header: () => undefined } as never, res: {} as never };
const chain = (value: unknown) => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(value) }) }) });

describe("integrations.whatsappChannels", () => {
  beforeEach(() => { vi.clearAllMocks(); requireTenantAccess.mockResolvedValue({ membershipId: 1 }); requireTenantAdmin.mockResolvedValue({ membershipId: 1 }); recordTenantAudit.mockResolvedValue(undefined); });
  it("agrega métricas por conexão e marca o canal padrão", async () => {
    getDb.mockResolvedValue({ select: vi.fn(() => chain([{ defaultWhatsAppIntegrationId: 21 }])), execute: vi.fn().mockResolvedValue([{ id: 21, provider: "meta", name: "Vendas", channelIdentifier: "+55 11 99999-0000", channelPurpose: "sales", status: "active", lastVerifiedAt: new Date("2026-08-01"), lastError: null, totalConversations: "12", pendingConversations: "3", avgFirstResponseMinutes: "4.5", lastActivityAt: new Date("2026-08-16") }]) });
    const result = await integrationRouter.createCaller(context).whatsappChannels({ tenantId: 7 });
    expect(result.defaultIntegrationId).toBe(21);
    expect(result.channels[0]).toMatchObject({ id: 21, name: "Vendas", channelIdentifier: "+55 11 99999-0000", channelPurpose: "sales", isDefault: true, totalConversations: 12, pendingConversations: 3, avgFirstResponseMinutes: 4.5 });
  });
  it("aceita somente um canal ativo do tenant como padrão", async () => {
    const insert = vi.fn(() => ({ values: () => ({ onDuplicateKeyUpdate: vi.fn().mockResolvedValue(undefined) }) }));
    getDb.mockResolvedValue({ select: vi.fn(() => chain([{ id: 22, name: "Suporte", provider: "zapi" }])), insert });
    await expect(integrationRouter.createCaller(context).setDefaultWhatsAppChannel({ tenantId: 7, integrationId: 22 })).resolves.toMatchObject({ success: true, integrationId: 22 });
    expect(recordTenantAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "integration.whatsapp_default_changed", tenantId: 7, entityId: 22 }));
  });
  it("atualiza identificador e finalidade somente para o canal do tenant", async () => {
    const update = vi.fn(() => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }));
    getDb.mockResolvedValue({ select: vi.fn(() => chain([{ id: 22, name: "Suporte", provider: "zapi" }])), update });
    await expect(integrationRouter.createCaller(context).updateWhatsAppChannelDetails({ tenantId: 7, integrationId: 22, channelIdentifier: "+55 11 98888-0000", channelPurpose: "support" })).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalled();
    expect(recordTenantAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "integration.whatsapp_details_updated", metadata: expect.objectContaining({ channelPurpose: "support" }) }));
  });
});
