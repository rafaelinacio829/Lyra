import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, requireTenantAccess } = vi.hoisted(() => ({ getDb: vi.fn(), requireTenantAccess: vi.fn() }));

vi.mock("../db", () => ({ getDb }));
vi.mock("../tenantAccess", () => ({ requireTenantAccess }));

import { reportRouter } from "./reports";

function chain(value: unknown) {
  const fluent = {
    from: () => fluent,
    innerJoin: () => fluent,
    leftJoin: () => fluent,
    where: () => fluent,
    groupBy: () => fluent,
    orderBy: () => fluent,
    then: (resolve: (result: unknown) => unknown) => Promise.resolve(value).then(resolve),
  };
  return fluent;
}

describe("reports.overview", () => {
  beforeEach(() => {
    requireTenantAccess.mockResolvedValue({ membershipId: 7, role: "tenant_admin" });
    const responses = [
      [{ total: 20, resolved: 12, reopened: 3, responded: 18, avgFirstResponseSeconds: 210 }],
      [{ queue: "ai", value: 5 }, { queue: "human", value: 4 }, { queue: "resolved", value: 11 }],
      [{ membershipId: 7, name: "Ana", assigned: 8, resolved: 6, avgFirstResponseSeconds: 180 }],
    ];
    getDb.mockResolvedValue({ select: vi.fn(() => chain(responses.shift())) });
  });

  it("returns the final tenant KPIs including reopens and queue volume", async () => {
    const caller = reportRouter.createCaller({ user: { id: 1, openId: "owner", name: "Owner", email: "owner@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never });
    const result = await caller.overview({ tenantId: 42, days: 30 });

    expect(requireTenantAccess).toHaveBeenCalledWith(1, 42);
    expect(result).toMatchObject({ total: 20, resolved: 12, resolutionRate: 60, reopenRate: 25, firstResponseMinutes: 4, queueVolume: { ai: 5, human: 4, resolved: 11 } });
    expect(result.productivity[0]).toMatchObject({ name: "Ana", assigned: 8, resolved: 6, firstResponseMinutes: 3 });
  });
});
