import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));
import { reportOperationalIncident, safeDetail } from "./operationalIncidents";

describe("operationalIncidents", () => {
  beforeEach(() => vi.clearAllMocks());
  it("remove segredos do detalhe antes de persistir um incidente deduplicado", async () => {
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
    getDb.mockResolvedValue({ insert: vi.fn(() => ({ values })) });
    await reportOperationalIncident({ tenantId: 8, integrationConfigId: 12, source: "meta.connection_test", severity: "critical", summary: "Falha na Meta", error: new Error("Bearer secret-token access_token=abc123 app_secret: supersecret") });
    const incident = values.mock.calls[0]?.[0];
    expect(incident).toMatchObject({ tenantId: 8, integrationConfigId: 12, source: "meta.connection_test", severity: "critical", status: "open" });
    expect(incident.detail).toContain("[REDACTED]");
    expect(incident.detail).not.toContain("secret-token");
    expect(incident.detail).not.toContain("abc123");
    expect(onDuplicateKeyUpdate).toHaveBeenCalled();
  });
  it("sanitiza parâmetros sensíveis de URLs e headers", () => {
    const detail = safeDetail("https://api.test/?token=123&key=xyz Bearer tok_abc");
    expect(detail).not.toContain("123");
    expect(detail).not.toContain("xyz");
    expect(detail).not.toContain("tok_abc");
  });
});
