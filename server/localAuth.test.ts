import { describe, expect, it } from "vitest";
import { createSessionToken, hashPassword, normalizeEmail, tokenHash, verifyPassword } from "./localAuth";

describe("autenticação local", () => {
  it("normaliza e-mails e não guarda a senha em texto puro", async () => {
    const password = "Senha-local-segura-2026"; const hash = await hashPassword(password);
    expect(normalizeEmail("  Rafael@EXAMPLE.COM ")).toBe("rafael@example.com");
    expect(hash).toMatch(/^scrypt\$/); expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("outra-senha", hash)).resolves.toBe(false);
  });
  it("gera tokens de sessão aleatórios e armazena apenas seu hash", () => {
    const token = createSessionToken(); const another = createSessionToken();
    expect(token).not.toBe(another); expect(tokenHash(token)).toHaveLength(64); expect(tokenHash(token)).not.toBe(token);
  });
});
