import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, assertTenantQuota, invokeConfiguredAiAgent } = vi.hoisted(() => ({ getDb: vi.fn(), assertTenantQuota: vi.fn(), invokeConfiguredAiAgent: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
vi.mock("../planLimits", () => ({ assertTenantQuota }));
vi.mock("./aiProvider", () => ({ invokeConfiguredAiAgent }));
vi.mock("./zapi", () => ({ sendZapiText: vi.fn() }));

import { runAiForInboundMessage } from "./difyAgent";

describe("runtime de regras operacionais", () => {
  beforeEach(() => vi.clearAllMocks());

  it("encaminha a mensagem para a fila humana antes de invocar a IA quando a política do tenant é humana", async () => {
    const limit = vi.fn().mockResolvedValue([{ isEnabled: true, inboundRouting: "human_first", handoffOutsideBusinessHours: false, autoEscalateUnassigned: true, timezone: "America/Sao_Paulo", businessHours: [] }]);
    const where = vi.fn(() => ({ limit })); const from = vi.fn(() => ({ where })); const select = vi.fn(() => ({ from }));
    const updateWhere = vi.fn().mockResolvedValue(undefined); const updateSet = vi.fn(() => ({ where: updateWhere })); const update = vi.fn(() => ({ set: updateSet }));
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined); const values = vi.fn().mockReturnValueOnce({ onDuplicateKeyUpdate }).mockResolvedValueOnce(undefined); const insert = vi.fn(() => ({ values }));
    getDb.mockResolvedValue({ select, update, insert });

    const result = await runAiForInboundMessage({ tenantId: 17, conversationId: 31, contactId: 9, contactPhone: "5511999999999", body: "Preciso falar com alguém" });

    expect(result).toEqual({ skipped: "human_routing" });
    expect(update).toHaveBeenCalledTimes(1); expect(insert).toHaveBeenCalledTimes(2); expect(onDuplicateKeyUpdate).toHaveBeenCalledTimes(1); expect(values).toHaveBeenLastCalledWith(expect.objectContaining({ body: expect.stringContaining("Escalonamento automático registrado") })); expect(assertTenantQuota).toHaveBeenCalledWith(17, "messages"); expect(invokeConfiguredAiAgent).not.toHaveBeenCalled();
  });
});
