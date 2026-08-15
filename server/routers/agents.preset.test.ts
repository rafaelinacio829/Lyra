import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess, requireTenantAdmin, assertTenantQuota, recordTenantAudit } = vi.hoisted(() => ({
  getDb: vi.fn(),
  requireTenantAccess: vi.fn(),
  requireTenantAdmin: vi.fn(),
  assertTenantQuota: vi.fn(),
  recordTenantAudit: vi.fn(),
}));

vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess, requireTenantAdmin }));
vi.mock("../planLimits", () => ({ assertTenantQuota }));
vi.mock("../audit", () => ({ recordTenantAudit }));

import { presetAgents } from "../agents/presetAgents";
import { agentRouter } from "./agents";

const context = {
  user: { id: 4, openId: "tenant-admin", name: "Tenant Admin", email: "admin@flowone.test", loginMethod: "local", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as never,
  res: {} as never,
};

function createDb(selectResults: unknown[][]) {
  const insert = vi.fn(() => ({
    values: vi.fn(() => ({
      $returningId: vi.fn(() => Promise.resolve([{ id: 77 }])),
    })),
  }));
  const select = vi.fn(() => {
    const rows = selectResults.shift() ?? [];
    const terminal = {
      limit: vi.fn(() => Promise.resolve(rows)),
      then: <TResult1 = unknown, TResult2 = never>(onfulfilled?: ((value: unknown[]) => TResult1 | PromiseLike<TResult1>) | null, onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null) => Promise.resolve(rows).then(onfulfilled, onrejected),
    };
    return { from: vi.fn(() => ({ where: vi.fn(() => terminal) })) };
  });
  return { select, insert };
}

describe("agents presets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireTenantAccess.mockResolvedValue({ membershipId: 1, role: "tenant_admin" });
    requireTenantAdmin.mockResolvedValue({ membershipId: 1, role: "tenant_admin" });
    assertTenantQuota.mockResolvedValue(undefined);
    recordTenantAudit.mockResolvedValue(undefined);
  });

  it("exposes six curated test agents with safe handoff instructions", () => {
    expect(presetAgents).toHaveLength(6);
    expect(presetAgents.map(agent => agent.id)).toEqual(["general_triage", "technical_support", "sales_qualification", "customer_care", "technical_echo", "welcome"]);
    expect(presetAgents.every(agent => agent.instructions.length > 100 && agent.handoffKeywords.length > 0)).toBe(true);
  });

  it("installs a preset as an inactive tenant-scoped draft and records the audit event", async () => {
    const db = createDb([[], [{ value: 0 }]]);
    getDb.mockResolvedValue(db);
    const caller = agentRouter.createCaller(context);

    const result = await caller.installPreset({ tenantId: 12, presetId: "general_triage" });

    expect(result).toMatchObject({ id: 77, alreadyInstalled: false });
    expect(assertTenantQuota).toHaveBeenCalledWith(12, "agents");
    expect(db.insert).toHaveBeenCalledTimes(1);
    const inserted = db.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    expect(inserted).toMatchObject({ tenantId: 12, name: "Triagem Geral", provider: "openai", isActive: false, isDefault: true });
    expect(recordTenantAudit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 12, actorUserId: 4, action: "agent.preset_installed", entityId: 77, metadata: expect.objectContaining({ presetId: "general_triage" }) }));
  });

  it("does not consume quota or duplicate a preset already installed in the same tenant", async () => {
    const db = createDb([[{ id: 18 }]]);
    getDb.mockResolvedValue(db);
    const caller = agentRouter.createCaller(context);

    await expect(caller.installPreset({ tenantId: 12, presetId: "technical_echo" })).resolves.toMatchObject({ id: 18, alreadyInstalled: true });
    expect(assertTenantQuota).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(recordTenantAudit).not.toHaveBeenCalled();
  });

  it("stops installation before persistence when the plan quota is exhausted", async () => {
    const db = createDb([[]]);
    getDb.mockResolvedValue(db);
    assertTenantQuota.mockRejectedValueOnce(new Error("O limite de agents do plano foi atingido."));
    const caller = agentRouter.createCaller(context);

    await expect(caller.installPreset({ tenantId: 12, presetId: "sales_qualification" })).rejects.toThrow("O limite de agents do plano foi atingido.");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("marks only the templates whose matching name is installed for the current tenant", async () => {
    const db = createDb([[{ id: 9, name: "Triagem Geral" }, { id: 10, name: "Agente personalizado" }]]);
    getDb.mockResolvedValue(db);
    const caller = agentRouter.createCaller(context);

    const presets = await caller.listPresets({ tenantId: 12 });

    expect(presets.find(preset => preset.id === "general_triage")).toMatchObject({ isInstalled: true, installedAgentId: 9 });
    expect(presets.find(preset => preset.id === "welcome")).toMatchObject({ isInstalled: false, installedAgentId: null });
  });
});
