import { describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
import { platformRouter } from "./platform";

const context = { user: { id: 1, openId: "admin", name: "Admin", email: null, loginMethod: "password", role: "admin" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as never, res: {} as never };

describe("platform.operationalIncidents", () => {
  it("retorna somente falhas de integração para a central de super-admin", async () => {
    const rows = [{ id: 9, tenantId: 2, tenantName: "Acme", provider: "zapi", name: "WhatsApp", lastError: "Instância indisponível", updatedAt: new Date() }];
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: () => ({ innerJoin: () => ({ where: () => ({ orderBy: () => ({ limit: () => Promise.resolve(rows) }) }) }) }) })) });
    await expect(platformRouter.createCaller(context).operationalIncidents()).resolves.toEqual(rows);
  });
});
