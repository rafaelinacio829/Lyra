import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));

import { revokeLocalSession, sessionTokenHashFromRequest, tokenHash } from "./localAuth";

describe("segurança de sessões locais", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deriva o hash da sessão somente quando o cookie de autenticação existe", () => {
    expect(sessionTokenHashFromRequest({ headers: { cookie: "lyra_session=token-seguro; theme=dark" } } as never)).toBe(tokenHash("token-seguro"));
    expect(sessionTokenHashFromRequest({ headers: {} } as never)).toBeNull();
  });

  it("revoga apenas a sessão representada pelo cookie, sem persistir o token bruto", async () => {
    const where = vi.fn(() => Promise.resolve());
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    getDb.mockResolvedValue({ update });

    await revokeLocalSession({ headers: { cookie: "lyra_session=token-de-sessao" } } as never);

    expect(update).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }));
    expect(where).toHaveBeenCalledTimes(1);
  });
});
