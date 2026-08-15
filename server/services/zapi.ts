import { and, eq } from "drizzle-orm";
import { integrationConfigs } from "../../drizzle/schema";
import { getDb } from "../db";
import { decryptTenantSecret } from "../tenantSecrets";

export async function sendZapiText(tenantId: number, phone: string, message: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [zapi] = await db
    .select()
    .from(integrationConfigs)
    .where(and(eq(integrationConfigs.tenantId, tenantId), eq(integrationConfigs.provider, "zapi"), eq(integrationConfigs.status, "active")))
    .limit(1);
  if (!zapi?.secretCiphertext || !zapi.publicConfig) throw new Error("Integração Z-API ativa não encontrada.");
  const config = zapi.publicConfig as { instanceId?: string };
  const secrets = JSON.parse(decryptTenantSecret(zapi.secretCiphertext)) as { instanceToken: string; clientToken: string };
  if (!config.instanceId) throw new Error("A integração Z-API não possui instância configurada.");
  const response = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(config.instanceId)}/token/${encodeURIComponent(secrets.instanceToken)}/send-text`, {
    method: "POST",
    headers: { "Client-Token": secrets.clientToken, "Content-Type": "application/json" },
    body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
  });
  if (!response.ok) throw new Error(`Z-API respondeu ${response.status}`);
  const payload = (await response.json().catch(() => ({}))) as { messageId?: string; zaapId?: string; id?: string };
  return payload.messageId ?? payload.zaapId ?? payload.id ?? null;
}
