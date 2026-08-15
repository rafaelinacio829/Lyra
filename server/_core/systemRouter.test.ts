import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("../db", () => ({ getDb }));
import { systemRouter } from "./systemRouter";

describe("system.health", () => {
  beforeEach(() => vi.clearAllMocks());
  it("informa disponibilidade quando a leitura mínima do banco é bem-sucedida", async () => {
    getDb.mockResolvedValue({ select: vi.fn(() => ({ from: () => ({ limit: vi.fn().mockResolvedValue([]) }) })) });
    await expect(systemRouter.createCaller({ user: null, req: {} as never, res: {} as never }).health({})).resolves.toMatchObject({ ok: true, database: "available" });
  });
  it("não expõe detalhes internos quando o banco está indisponível", async () => {
    getDb.mockResolvedValue(null);
    await expect(systemRouter.createCaller({ user: null, req: {} as never, res: {} as never }).health({})).resolves.toMatchObject({ ok: false, database: "unavailable" });
  });
});
