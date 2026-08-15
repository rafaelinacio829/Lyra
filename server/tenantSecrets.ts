import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const rawKey = process.env.TENANT_SECRETS_KEY;
  if (!rawKey || rawKey.length < 32) {
    throw new Error("TENANT_SECRETS_KEY não está configurada com segurança.");
  }
  return createHash("sha256").update(rawKey).digest();
}

export function encryptTenantSecret(plaintext: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64url"), authTag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptTenantSecret(ciphertext: string) {
  const [ivPart, tagPart, dataPart] = ciphertext.split(".");
  if (!ivPart || !tagPart || !dataPart) throw new Error("Formato de segredo cifrado inválido.");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]).toString("utf8");
}

export function fingerprintTenantSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex").slice(0, 20);
}
