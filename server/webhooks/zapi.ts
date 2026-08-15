import type { Request, Response } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import { contacts, conversations, messages } from "../../drizzle/schema";
import { getDb } from "../db";
import { validateZapiWebhook } from "../routers/integrations";
import { runDifyForInboundMessage } from "../services/difyAgent";
import { assertTenantQuota } from "../planLimits";
import { shouldReopenConversation } from "../metricsRules";
import { transitionConversation } from "../conversationLifecycle";

function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function messageText(payload: Record<string, unknown>) {
  const text = payload.text;
  if (text && typeof text === "object") {
    const message = stringValue((text as Record<string, unknown>).message) || stringValue((text as Record<string, unknown>).body);
    if (message) return message;
  }
  return stringValue(payload.message) || stringValue(payload.body) || stringValue(payload.caption) || "[Mídia recebida]";
}

export async function handleZapiWebhook(req: Request, res: Response) {
  try {
    const integrationId = Number(req.params.integrationId);
    const webhookKey = req.params.webhookKey;
    if (!Number.isInteger(integrationId) || !webhookKey) return res.status(404).json({ error: "webhook_not_found" });
    const config = await validateZapiWebhook(integrationId, webhookKey);
    if (!config) return res.status(403).json({ error: "webhook_forbidden" });
    const payload = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    if (payload.fromMe === true) return res.json({ ok: true, skipped: "outbound_event" });
    const providerMessageId = stringValue(payload.messageId) || stringValue(payload.id) || stringValue(payload.message_id);
    const phone = stringValue(payload.phone) || stringValue(payload.chatId).replace(/@.+$/, "") || stringValue(payload.from).replace(/@.+$/, "");
    if (!phone) return res.status(400).json({ error: "phone_missing" });
    const db = await getDb();
    if (!db) return res.status(503).json({ error: "database_unavailable" });
    if (providerMessageId) {
      const existing = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.tenantId, config.tenantId), eq(messages.providerMessageId, providerMessageId))).limit(1);
      if (existing.length) return res.json({ ok: true, skipped: "duplicate" });
    }
    let [contact] = await db.select().from(contacts).where(and(eq(contacts.tenantId, config.tenantId), eq(contacts.phone, phone))).limit(1);
    if (!contact) {
      const name = stringValue(payload.senderName) || stringValue(payload.chatName) || phone;
      const [created] = await db.insert(contacts).values({ tenantId: config.tenantId, name, phone }).$returningId();
      [contact] = await db.select().from(contacts).where(eq(contacts.id, created.id)).limit(1);
    }
    let [conversation] = await db.select().from(conversations).where(and(eq(conversations.tenantId, config.tenantId), eq(conversations.contactId, contact.id), inArray(conversations.queue, ["ai", "human", "resolved"]))).orderBy(desc(conversations.updatedAt)).limit(1);
    if (!conversation) {
      await assertTenantQuota(config.tenantId, "conversations");
      const [created] = await db.insert(conversations).values({ tenantId: config.tenantId, contactId: contact.id, queue: "ai", latestMessagePreview: messageText(payload), unreadCount: 1 }).$returningId();
      [conversation] = await db.select().from(conversations).where(eq(conversations.id, created.id)).limit(1);
    } else if (shouldReopenConversation(conversation.queue)) {
      await db.update(conversations).set({ ...transitionConversation(conversation.queue, "ai", new Date()), assignedMembershipId: null, updatedAt: new Date() }).where(eq(conversations.id, conversation.id));
      [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversation.id)).limit(1);
    }
    const body = messageText(payload);
    await assertTenantQuota(config.tenantId, "messages");
    await db.insert(messages).values({ tenantId: config.tenantId, conversationId: conversation.id, direction: "inbound", channel: "whatsapp", providerMessageId: providerMessageId || null, body });
    await db.update(conversations).set({ latestMessagePreview: body, unreadCount: conversation.unreadCount + 1, updatedAt: new Date() }).where(eq(conversations.id, conversation.id));
    if (conversation.queue === "ai") {
      try {
        await runDifyForInboundMessage({ tenantId: config.tenantId, conversationId: conversation.id, contactId: contact.id, contactPhone: contact.phone, body });
      } catch (agentError) {
        console.error("[Dify agent]", agentError);
        await assertTenantQuota(config.tenantId, "messages");
        await db.insert(messages).values({ tenantId: config.tenantId, conversationId: conversation.id, direction: "internal_note", channel: "internal", body: "O agente não respondeu automaticamente. A conversa permanece disponível para atendimento humano." });
      }
    }
    res.json({ ok: true });
  } catch (error) {
    console.error("[Z-API webhook]", error);
    res.status(500).json({ error: "webhook_processing_failed" });
  }
}
