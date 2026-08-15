import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb }));

import { platformRouter } from "./platform";

const userContext = { user: { id: 4, openId: "user", name: "Usuário", email: null, loginMethod: "manus", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };
const adminContext = { ...userContext, user: { ...userContext.user, role: "admin" as const } };

describe("procedures de plataforma", () => {
  beforeEach(() => vi.clearAllMocks());
  it("nega a listagem de tenants para usuário que não é super-admin", async () => {
    await expect(platformRouter.createCaller(userContext).tenants()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });
  it("nega a visão comercial para usuário que não é super-admin", async () => {
    await expect(platformRouter.createCaller(userContext).overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getDb).not.toHaveBeenCalled();
  });
  it("permite a procedure ao super-admin", async () => {
    getDb.mockResolvedValue({
      select: vi.fn(() => ({
        from: () => ({ leftJoin: () => ({ leftJoin: () => ({ orderBy: () => Promise.resolve([]) }) }) }),
      })),
    });
    await expect(platformRouter.createCaller(adminContext).tenants()).resolves.toEqual([]);
  });
  it("retorna clientes e métricas comerciais ao super-admin", async () => {
    const rows = [{ id: 1, name: "Acme", primaryEmail: "admin@acme.test", tenantStatus: "active", trialEndsAt: null, createdAt: new Date(), planName: "Starter", monthlyPriceCents: 29900, annualPriceCents: 299000, subscriptionStatus: "active", billingInterval: "monthly", currentPeriodEndsAt: null, cancelAtPeriodEnd: false }];
    const select = vi.fn()
      .mockReturnValueOnce({ from: () => ({ leftJoin: () => ({ leftJoin: () => ({ orderBy: () => Promise.resolve(rows) }) }) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });
    getDb.mockResolvedValue({
      select,
    });
    await expect(platformRouter.createCaller(adminContext).overview()).resolves.toMatchObject({ customers: [expect.objectContaining(rows[0])], metrics: { totalCustomers: 1, activeCustomers: 1, mrrCents: 29900 }, health: { attention: 1 } });
  });
});
