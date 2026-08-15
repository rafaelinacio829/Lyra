import { describe, expect, it } from "vitest";
import { summarizeIntegrationHealth } from "./operationalHealth";

describe("saúde operacional de integrações", () => {
  it("prioriza falhas de conexão e informa que o canal ainda não está disponível", () => {
    const result = summarizeIntegrationHealth([{ provider: "meta", name: "Canal principal", status: "error", lastVerifiedAt: null, lastError: "Token inválido" }]);
    expect(result.status).toBe("attention"); expect(result.errors).toBe(1); expect(result.signals.map(signal => signal.id)).toEqual(expect.arrayContaining(["integration-errors", "channel-missing"]));
  });

  it("reconhece canais verificados sem expor detalhes sensíveis da integração", () => {
    const result = summarizeIntegrationHealth([{ provider: "zapi", name: "WhatsApp", status: "active", lastVerifiedAt: new Date(), lastError: null }]);
    expect(result.status).toBe("healthy"); expect(result.channelsReady).toBe(1); expect(result.signals).toHaveLength(1); expect(result.signals[0].id).toBe("integrations-healthy");
  });
});
