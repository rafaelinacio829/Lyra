import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));

import { requirePlatformAdmin, requireTenantAccess, requireTenantAdmin } from "./tenantAccess";

function chain(value: unknown) {
  const fluent = { from: () => fluent, innerJoin: () => fluent, where: () => fluent, limit: () => Promise.resolve(value) };
  return fluent;
}

describe("tenant access control", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a user without an active association to the requested tenant", async () => {
    getDb.mockResolvedValue({ select: vi.fn(() => chain([])) });
    await expect(requireTenantAccess(10, 999)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects an agent attempting a tenant-admin action", async () => {
    getDb.mockResolvedValue({ select: vi.fn(() => chain([{ membershipId: 4, tenantId: 1, tenantName: "Tenant", tenantSlug: "tenant", role: "agent" }])) });
    await expect(requireTenantAdmin(10, 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a regular platform user from super-admin actions", () => {
    expect(() => requirePlatformAdmin("user")).toThrow(/super-administradores/);
  });
});
