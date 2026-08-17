import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contacts, conversations, messages } from "../../drizzle/schema";
import { getDb } from "../db";
import { getMetaWebhookConfig } from "../routers/integrations";
import { decryptTenantSecret } from "../tenantSecrets";
import { runDifyForInboundMessage } from "../services/difyAgent";
import { assertTenantQuota } from "../planLimits";
import { shouldReopenConversation } from "../metricsRules";
import { transitionConversation } from "../conversationLifecycle";

type MetaSecret = { appSecret?: string; verifyToken?: string };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function metaMessage(payload: Record<string, unknown>) {
  const message = payload.messages;
  if (!Array.isArray(message) || !message[0] || typeof message[0] !== "object") return null;
  const item = message[0] as Record<string, unknown>; const body = item.text && typeof item.text === "object" ? text((item.text as Record<string, unknown>).body) : "";
  return { id: text(item.id), phone: text(item.from), body: body || "[Mídia recebida]" };
}

function signatureValid(rawBody: Buffer, signature: string | undefined, appSecret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected); const receivedBuffer = Buffer.from(signature);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function verifyMetaWebhook(req: Request, res: Response) {
  const integrationId = Number(req.params.integrationId); if (!Number.isInteger(integrationId)) return res.status(404).send("not_found");
  const config = await getMetaWebhookConfig(integrationId, true); if (!config?.webhookSecretCiphertext) return res.status(403).send("forbidden");
  const verifyToken = decryptTenantSecret(config.webhookSecretCiphertext);
  const mode = text(req.query["hub.mode"]); const token = text(req.query["hub.verify_token"]); const challenge = text(req.query["hub.challenge"]);
  if (mode === "subscribe" && token && challenge && token.length === verifyToken.length && timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken))) return res.status(200).send(challenge);
  return res.status(403).send("forbidden");
}

export async function handleMetaWebhook(req: Request, res: Response) {
  try {
    const integrationId = Number(req.params.integrationId); if (!Number.isInteger(integrationId)) return res.status(404).json({ error: "webhook_not_found" });
    const config = await getMetaWebhookConfig(integrationId); if (!config?.secretCiphertext) return res.status(403).json({ error: "webhook_forbidden" });
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(""); const secrets = JSON.parse(decryptTenantSecret(config.secretCiphertext)) as MetaSecret;
    if (!secrets.appSecret || !signatureValid(rawBody, req.header("x-hub-signature-256"), secrets.appSecret)) return res.status(403).json({ error: "signature_invalid" });
    const payload = JSON.parse(rawBody.toString("utf8")) as { entry?: Array<{ changes?: Array<{ field?: string; value?: Record<string, unknown> }> }> };
    const change = payload.entry?.flatMap(entry => entry.changes || []).find(item => item.field === "messages" && item.value);
    if (!change?.value) return res.json({ ok: true, skipped: "non_message_event" });
    const incoming = metaMessage(change.value); if (!incoming?.phone) return res.json({ ok: true, skipped: "status_event" });
    const db = await getDb(); if (!db) return res.status(503).json({ error: "database_unavailable" });
    if (incoming.id) { const existing = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.tenantId, config.tenantId), eq(messages.providerMessageId, incoming.id))).limit(1); if (existing.length) return res.json({ ok: true, skipped: "duplicate" }); }
    const contactsData = change.value.contacts; const firstContact = Array.isArray(contactsData) && contactsData[0] && typeof contactsData[0] === "object" ? contactsData[0] as Record<string, unknown> : null;
    const profile = firstContact?.profile && typeof firstContact.profile === "object" ? firstContact.profile as Record<string, unknown> : null;
    let [contact] = await db.select().from(contacts).where(and(eq(contacts.tenantId, config.tenantId), eq(contacts.phone, incoming.phone))).limit(1);
    if (!contact) { const [created] = await db.insert(contacts).values({ tenantId: config.tenantId, name: text(profile?.name) || incoming.phone, phone: incoming.phone }).$returningId(); [contact] = await db.select().from(contacts).where(eq(contacts.id, created.id)).limit(1); }
    let [conversation] = await db.select().from(conversations).where(and(eq(conversations.tenantId, config.tenantId), eq(conversations.contactId, contact.id), eq(conversations.integrationConfigId, config.id), inArray(conversations.queue, ["ai", "human", "resolved"]))).orderBy(desc(conversations.updatedAt)).limit(1);
    if (!conversation) { await assertTenantQuota(config.tenantId, "conversations"); const [created] = await db.insert(conversations).values({ tenantId: config.tenantId, contactId: contact.id, integrationConfigId: config.id, queue: "ai", latestMessagePreview: incoming.body, unreadCount: 1 }).$returningId(); [conversation] = await db.select().from(conversations).where(eq(conversations.id, created.id)).limit(1); }
    else if (shouldReopenConversation(conversation.queue)) { await db.update(conversations).set({ ...transitionConversation(conversation.queue, "ai", new Date()), assignedMembershipId: null, updatedAt: new Date() }).where(eq(conversations.id, conversation.id)); [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversation.id)).limit(1); }
    await assertTenantQuota(config.tenantId, "messages"); await db.insert(messages).values({ tenantId: config.tenantId, conversationId: conversation.id, direction: "inbound", channel: "whatsapp", providerMessageId: incoming.id || null, body: incoming.body }); await db.update(conversations).set({ latestMessagePreview: incoming.body, unreadCount: conversation.unreadCount + 1, updatedAt: new Date() }).where(eq(conversations.id, conversation.id));
    if (conversation.queue === "ai") { try { await runDifyForInboundMessage({ tenantId: config.tenantId, conversationId: conversation.id, contactId: contact.id, contactPhone: contact.phone, body: incoming.body }); } catch { await assertTenantQuota(config.tenantId, "messages"); await db.insert(messages).values({ tenantId: config.tenantId, conversationId: conversation.id, direction: "internal_note", channel: "internal", body: "O agente não respondeu automaticamente. A conversa permanece disponível para atendimento humano." }); } }
    return res.json({ ok: true });
  } catch (error) { console.error("[Meta webhook]", error); return res.status(500).json({ error: "webhook_processing_failed" }); }
}
