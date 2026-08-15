import { describe, expect, it } from "vitest";
import { decryptTenantSecret, encryptTenantSecret, fingerprintTenantSecret } from "./tenantSecrets";

describe("tenant secret vault", () => {
  it("uses the configured master key to encrypt and decrypt a tenant integration credential", () => {
    expect(process.env.TENANT_SECRETS_KEY?.length).toBeGreaterThanOrEqual(32);
    const plaintext = "tenant-dify-token-for-test";
    const ciphertext = encryptTenantSecret(plaintext);

    expect(ciphertext).not.toContain(plaintext);
    expect(decryptTenantSecret(ciphertext)).toBe(plaintext);
    expect(fingerprintTenantSecret(plaintext)).toHaveLength(20);
  });
});
