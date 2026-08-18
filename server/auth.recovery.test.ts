import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb }));
import { appRouter } from "./routers";
import { tokenHash } from "./localAuth";

const context = { user: null, req: { protocol: "https", get: () => "flow-one.test" } as never, res: { clearCookie: vi.fn(), cookie: vi.fn() } as never };
const selected = (rows: unknown[]) => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }) });

describe("auth.resetPasswordWithRecoveryCode", () => {
  beforeEach(() => vi.clearAllMocks());
  it("consome o código, troca a senha e revoga as sessões ativas", async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const update = vi.fn(() => ({ set: () => ({ where: vi.fn().mockResolvedValue(undefined) }) }));
    const select = vi.fn().mockReturnValueOnce(selected([{ id: 12 }])).mockReturnValueOnce(selected([{ id: "recovery-12" }]));
    getDb.mockResolvedValue({ select, update, insert: vi.fn(() => ({ values })) });
    await expect(appRouter.createCaller(context).auth.resetPasswordWithRecoveryCode({ email: "cliente@acme.test", recoveryCode: "ABCD-EF12-3456-7890-ABCD", newPassword: "Nova-senha-segura-2026" })).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalledTimes(3);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ action: "account.password_recovered", actorUserId: 12 }));
  });
  it("não revela se o e-mail ou código não existe", async () => {
    getDb.mockResolvedValue({ select: vi.fn(() => selected([])) });
    await expect(appRouter.createCaller(context).auth.resetPasswordWithRecoveryCode({ email: "ausente@acme.test", recoveryCode: "ABCD-EF12-3456-7890-ABCD", newPassword: "Nova-senha-segura-2026" })).rejects.toThrow("Código de recuperação inválido ou expirado.");
  });
  it("usa o mesmo hash SHA-256 do código normalizado", () => {
    expect(tokenHash("ABCDEF1234567890ABCD")).toHaveLength(64);
  });
});
