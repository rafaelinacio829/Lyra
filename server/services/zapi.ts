import { and, eq } from "drizzle-orm";
import { integrationConfigs } from "../../drizzle/schema";
import { getDb } from "../db";
import { decryptTenantSecret } from "../tenantSecrets";

async function sendZapiConfig(zapi: typeof integrationConfigs.$inferSelect, phone: string, message: string) {
  if (!zapi.secretCiphertext || !zapi.publicConfig) throw new Error("Integração Z-API ativa não encontrada.");
  const config = zapi.publicConfig as { instanceId?: string };
  const secrets = JSON.parse(decryptTenantSecret(zapi.secretCiphertext)) as { instanceToken: string; clientToken: string };
  if (!config.instanceId) throw new Error("A integração Z-API não possui instância configurada.");
  const response = await fetch(`https://api.z-api.io/instances/${encodeURIComponent(config.instanceId)}/token/${encodeURIComponent(secrets.instanceToken)}/send-text`, {
    method: "POST", headers: { "Client-Token": secrets.clientToken, "Content-Type": "application/json" }, body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
  });
  if (!response.ok) throw new Error(`Z-API respondeu ${response.status}`);
  const payload = (await response.json().catch(() => ({}))) as { messageId?: string; zaapId?: string; id?: string };
  return payload.messageId ?? payload.zaapId ?? payload.id ?? null;
}

async function sendMetaConfig(meta: typeof integrationConfigs.$inferSelect, phone: string, message: string) {
  if (!meta.secretCiphertext || !meta.publicConfig) throw new Error("Integração Meta ativa não encontrada.");
  const config = meta.publicConfig as { phoneNumberId?: string; graphApiVersion?: string };
  const secrets = JSON.parse(decryptTenantSecret(meta.secretCiphertext)) as { accessToken?: string };
  if (!config.phoneNumberId || !secrets.accessToken) throw new Error("A integração Meta não possui número ou token configurado.");
  const response = await fetch(`https://graph.facebook.com/${config.graphApiVersion || "v23.0"}/${encodeURIComponent(config.phoneNumberId)}/messages`, {
    method: "POST", headers: { Authorization: `Bearer ${secrets.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: phone.replace(/\D/g, ""), type: "text", text: { body: message } }),
  });
  if (!response.ok) throw new Error(`Meta respondeu ${response.status}`);
  const payload = (await response.json().catch(() => ({}))) as { messages?: Array<{ id?: string }> };
  return payload.messages?.[0]?.id ?? null;
}

export async function sendWhatsAppText(tenantId: number, integrationId: number, phone: string, message: string) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [config] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.id, integrationId), eq(integrationConfigs.tenantId, tenantId), eq(integrationConfigs.status, "active"))).limit(1);
  if (!config || (config.provider !== "zapi" && config.provider !== "meta")) throw new Error("Conexão de WhatsApp ativa não encontrada para este tenant.");
  return config.provider === "zapi" ? sendZapiConfig(config, phone, message) : sendMetaConfig(config, phone, message);
}

export async function sendZapiText(tenantId: number, phone: string, message: string) {
  const db = await getDb(); if (!db) throw new Error("Banco de dados indisponível.");
  const [zapi] = await db.select().from(integrationConfigs).where(and(eq(integrationConfigs.tenantId, tenantId), eq(integrationConfigs.provider, "zapi"), eq(integrationConfigs.status, "active"))).limit(1);
  if (!zapi) throw new Error("Integração Z-API ativa não encontrada.");
  return sendZapiConfig(zapi, phone, message);
}
