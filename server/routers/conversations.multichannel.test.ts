import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess, assertTenantQuota, sendWhatsAppText } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn(), assertTenantQuota: vi.fn(), sendWhatsAppText: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess }));
vi.mock("../planLimits", () => ({ assertTenantQuota }));
vi.mock("../services/zapi", () => ({ sendWhatsAppText }));
import { conversationRouter } from "./conversations";

const context = { user: { id: 7, openId: "user", name: "Usuário", email: null, loginMethod: "password", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };
const chain = (result: unknown) => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(result) }) }) });

describe("conversations.send multicanal", () => {
  beforeEach(() => { vi.clearAllMocks(); requireTenantAccess.mockResolvedValue({ membershipId: 3 }); assertTenantQuota.mockResolvedValue(undefined); sendWhatsAppText.mockResolvedValue("provider-1"); });
  it("envia pela conexão explicitamente selecionada e a registra na conversa", async () => {
    const select = vi.fn().mockReturnValueOnce(chain([{ id: 20, contactId: 9, integrationConfigId: null }])).mockReturnValueOnce(chain([{ phone: "5511999999999" }]));
    const updates: Array<Record<string, unknown>> = [];
    getDb.mockResolvedValue({ select, insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })), update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: vi.fn().mockResolvedValue(undefined) }; } })) });
    await expect(conversationRouter.createCaller(context).send({ tenantId: 12, conversationId: 20, body: "Olá", integrationId: 44 })).resolves.toEqual({ success: true });
    expect(sendWhatsAppText).toHaveBeenCalledWith(12, 44, "5511999999999", "Olá");
    expect(updates[0]).toMatchObject({ integrationConfigId: 44, latestMessagePreview: "Olá" });
  });
});
