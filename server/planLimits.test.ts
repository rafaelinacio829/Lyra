import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));

import { assertTenantQuota } from "./planLimits";

function queueRows(...rows: unknown[][]) {
  const queue = [...rows];
  const next = () => queue.shift() ?? [];
  const joined = { innerJoin: () => joined, where: () => ({ limit: () => Promise.resolve(next()) }) };
  const db = { select: vi.fn(() => ({ from: () => ({ innerJoin: () => joined, where: () => Promise.resolve(next()) }) })) };
  getDb.mockResolvedValue(db);
}

const activePlan = { status: "active", includedMembers: 5, includedAgents: 2, includedIntegrations: 2, includedConversations: 100, includedMessages: 500, includedStorageMb: 100, planName: "Starter" };

describe("limites de plano", () => {
  beforeEach(() => vi.clearAllMocks());
  it("permite operação que permanece dentro da quota do tenant", async () => {
    queueRows([activePlan], [{}], [{ value: 4 }]);
    await expect(assertTenantQuota(3, "members")).resolves.toBeUndefined();
  });
  it("bloqueia operação que ultrapassa a quota técnica do plano", async () => {
    queueRows([activePlan], [{}], [{ value: 5 }]);
    await expect(assertTenantQuota(3, "members")).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("limite de members") });
  });
  it("bloqueia novas operações quando a assinatura não está elegível", async () => {
    queueRows([{ ...activePlan, status: "cancelled" }]);
    await expect(assertTenantQuota(3, "messages")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("bloqueia operação quando o trial do tenant já terminou", async () => {
    queueRows([{ ...activePlan, status: "trialing", tenantStatus: "trial", trialEndsAt: new Date(Date.now() - 1_000) }]);
    await expect(assertTenantQuota(3, "messages")).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("trial") });
  });
});
