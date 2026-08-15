import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getMetaWebhookConfig: vi.fn(), decryptTenantSecret: vi.fn(), assertTenantQuota: vi.fn(), runDifyForInboundMessage: vi.fn() }));
vi.mock("../db", () => ({ getDb: mocks.getDb }));
vi.mock("../routers/integrations", () => ({ getMetaWebhookConfig: mocks.getMetaWebhookConfig }));
vi.mock("../tenantSecrets", () => ({ decryptTenantSecret: mocks.decryptTenantSecret }));
vi.mock("../planLimits", () => ({ assertTenantQuota: mocks.assertTenantQuota }));
vi.mock("../services/difyAgent", () => ({ runDifyForInboundMessage: mocks.runDifyForInboundMessage }));

import { handleMetaWebhook, verifyMetaWebhook } from "./meta";

function queryChain(value: unknown) {
  const chain = { from: () => chain, where: () => chain, orderBy: () => chain, limit: () => Promise.resolve(value) };
  return chain;
}

describe("WhatsApp Cloud API webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("responde ao desafio da Meta somente com o token de verificação correto", async () => {
    mocks.getMetaWebhookConfig.mockResolvedValue({ webhookSecretCiphertext: "cipher" });
    mocks.decryptTenantSecret.mockReturnValue("verify-secret");
    const send = vi.fn(); const status = vi.fn(() => ({ send }));
    await verifyMetaWebhook({ params: { integrationId: "4" }, query: { "hub.mode": "subscribe", "hub.verify_token": "verify-secret", "hub.challenge": "challenge-123" } } as never, { send, status } as never);
    expect(send).toHaveBeenCalledWith("challenge-123");
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejeita payload cujo HMAC não corresponde ao App Secret do tenant", async () => {
    mocks.getMetaWebhookConfig.mockResolvedValue({ tenantId: 8, secretCiphertext: "cipher" });
    mocks.decryptTenantSecret.mockReturnValue(JSON.stringify({ appSecret: "app-secret" }));
    const json = vi.fn(); const status = vi.fn(() => ({ json }));
    await handleMetaWebhook({ params: { integrationId: "4" }, body: Buffer.from('{"entry":[]}'), header: () => "sha256=invalida" } as never, { json, status } as never);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: "signature_invalid" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("aceita evento assinado que não contém mensagem sem criar registros", async () => {
    const raw = Buffer.from('{"entry":[]}'); const secret = "app-secret"; const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    mocks.getMetaWebhookConfig.mockResolvedValue({ tenantId: 8, secretCiphertext: "cipher" });
    mocks.decryptTenantSecret.mockReturnValue(JSON.stringify({ appSecret: secret }));
    const json = vi.fn(); const status = vi.fn(() => ({ json }));
    await handleMetaWebhook({ params: { integrationId: "4" }, body: raw, header: () => signature } as never, { json, status } as never);
    expect(json).toHaveBeenCalledWith({ ok: true, skipped: "non_message_event" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("processa mensagem assinada no tenant correto e reabre uma conversa resolvida", async () => {
    const secret = "app-secret";
    const payload = { entry: [{ changes: [{ field: "messages", value: { contacts: [{ profile: { name: "Ana" } }], messages: [{ id: "wamid.1", from: "5511999999999", text: { body: "Preciso falar com alguém" } }] } }] }] };
    const raw = Buffer.from(JSON.stringify(payload)); const signature = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
    mocks.getMetaWebhookConfig.mockResolvedValue({ tenantId: 8, secretCiphertext: "cipher" });
    mocks.decryptTenantSecret.mockReturnValue(JSON.stringify({ appSecret: secret }));
    mocks.runDifyForInboundMessage.mockResolvedValue({ replied: true });
    const selectResponses = [[], [{ id: 12, phone: "5511999999999" }], [{ id: 55, queue: "resolved", unreadCount: 0 }], [{ id: 55, queue: "ai", unreadCount: 0 }]];
    const updates: Array<Record<string, unknown>> = [];
    mocks.getDb.mockResolvedValue({ select: vi.fn(() => queryChain(selectResponses.shift())), update: vi.fn(() => ({ set: (values: Record<string, unknown>) => { updates.push(values); return { where: () => Promise.resolve() }; } })), insert: vi.fn(() => ({ values: () => Promise.resolve() })) });
    const json = vi.fn(); const status = vi.fn(() => ({ json }));
    await handleMetaWebhook({ params: { integrationId: "4" }, body: raw, header: () => signature } as never, { json, status } as never);
    expect(mocks.assertTenantQuota).toHaveBeenCalledWith(8, "messages");
    expect(updates[0]).toMatchObject({ queue: "ai", assignedMembershipId: null, resolvedAt: null });
    expect(updates[0].reopenedAt).toBeInstanceOf(Date);
    expect(json).toHaveBeenCalledWith({ ok: true });
  });
});
