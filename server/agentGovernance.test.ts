import { describe, expect, it } from "vitest";
import { presentAgentAudit } from "./agentGovernance";

describe("governança de agentes", () => {
  it("traduz eventos técnicos em histórico operacional sem incluir segredos", () => {
    const event = presentAgentAudit({ action: "agent.provider_configured", createdAt: new Date("2026-08-15T10:00:00Z"), actorName: "Rafael" });
    expect(event.label).toBe("Conexão do provedor atualizada"); expect(event.actor).toBe("Rafael"); expect(JSON.stringify(event)).not.toContain("apiKey");
  });
});
