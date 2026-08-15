import { afterEach, describe, expect, it, vi } from "vitest";
import { deliverOperationalEmail, prepareOperationalAlerts } from "./alerts";

describe("alertas operacionais", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("prepara alertas de fila, SLA e trial próximo do fim", () => {
    const alerts = prepareOperationalAlerts({ unassignedConversations: 2, slaRiskConversations: 1, trialEndsAt: new Date("2026-08-16T12:00:00Z"), now: new Date("2026-08-14T12:00:00Z") });
    expect(alerts.map(alert => alert.kind)).toEqual(["unassigned", "sla", "trial"]);
  });
  it("não realiza chamada externa enquanto o provedor não estiver configurado", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    await expect(deliverOperationalEmail({ to: "admin@tenant.test", alert: { kind: "sla", subject: "SLA", body: "Risco" } })).resolves.toEqual({ delivered: false, reason: "email_provider_not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
