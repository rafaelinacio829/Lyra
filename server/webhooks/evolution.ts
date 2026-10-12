import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { integrationConfigs } from "../../drizzle/schema";
import { decryptTenantSecret } from "../tenantSecrets";
import { getDb } from "../db";
import { handleProviderWebhook } from "./zapi";

export async function handleEvolutionWebhook(req: Request, res: Response) {
  const db = await getDb();
  if (!db) return res.status(503).json({ error: "database_unavailable" });
  const key = req.params.webhookKey || "";
  const configs = await db.select().from(integrationConfigs).where(eq(integrationConfigs.provider, "evolution"));
  const config = configs.find(row => row.webhookSecretCiphertext && decryptTenantSecret(row.webhookSecretCiphertext) === key);
  if (!config) return res.status(403).json({ error: "webhook_forbidden" });
  const event = req.body as { event?: string; data?: { key?: { remoteJid?: string; fromMe?: boolean; id?: string }; message?: { conversation?: string; extendedTextMessage?: { text?: string } } } };
  if (event.event !== "MESSAGES_UPSERT") return res.json({ ok: true });
  const normalizedBody = { fromMe: event.data?.key?.fromMe, messageId: event.data?.key?.id, phone: event.data?.key?.remoteJid?.replace(/@.+$/, ""), text: { message: event.data?.message?.conversation || event.data?.message?.extendedTextMessage?.text || "" } };
  const syntheticRequest = Object.assign(req, { params: { integrationId: String(config.id), webhookKey: key }, body: normalizedBody }) as unknown as Request;
  return handleProviderWebhook(syntheticRequest, res, "evolution");
}
