import { and, desc, eq } from "drizzle-orm";
import { agentProfiles, contacts, conversations, messages } from "../../drizzle/schema";
import { getDb } from "../db";
import { decryptTenantSecret } from "../tenantSecrets";
import { sendZapiText } from "./zapi";
import { assertTenantQuota } from "../planLimits";

function textFromDify(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["answer", "text", "result", "output"]) {
    const found = textFromDify(record[key]);
    if (found) return found;
  }
  for (const item of Object.values(record)) {
    const found = textFromDify(item);
    if (found) return found;
  }
  return null;
}

export async function runDifyForInboundMessage({ tenantId, conversationId, contactId, contactPhone, body }: { tenantId: number; conversationId: number; contactId: number; contactPhone: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível.");
  const [agent] = await db
    .select()
    .from(agentProfiles)
    .where(and(eq(agentProfiles.tenantId, tenantId), eq(agentProfiles.isActive, true), eq(agentProfiles.provider, "dify")))
    .orderBy(desc(agentProfiles.isDefault), desc(agentProfiles.updatedAt))
    .limit(1);
  if (!agent?.apiBaseUrl || !agent.credentialCiphertext) return { skipped: "no_active_agent" as const };

  const handoffKeywords = Array.isArray(agent.handoffKeywords) ? agent.handoffKeywords.filter((item): item is string => typeof item === "string") : [];
  if (handoffKeywords.some(keyword => body.toLocaleLowerCase("pt-BR").includes(keyword.toLocaleLowerCase("pt-BR")))) {
    await db.update(conversations).set({ queue: "human", assignedMembershipId: null, updatedAt: new Date() }).where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)));
    await assertTenantQuota(tenantId, "messages");
    await db.insert(messages).values({ tenantId, conversationId, direction: "internal_note", channel: "internal", body: "Transferido para atendimento humano por regra de handoff do agente." });
    return { skipped: "handoff" as const };
  }

  const [conversation] = await db.select({ externalConversationId: conversations.externalConversationId }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId))).limit(1);
  const endpoint = agent.mode === "workflow" ? "/workflows/run" : agent.mode === "completion" ? "/completion-messages" : "/chat-messages";
  const payload = agent.mode === "workflow"
    ? { inputs: { message: body, contact_phone: contactPhone, conversation_id: String(conversationId) }, response_mode: "blocking", user: `tenant-${tenantId}-contact-${contactId}` }
    : { inputs: {}, query: body, response_mode: "blocking", user: `tenant-${tenantId}-contact-${contactId}`, ...(conversation?.externalConversationId ? { conversation_id: conversation.externalConversationId } : {}) };
  const response = await fetch(`${agent.apiBaseUrl.replace(/\/+$/, "")}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${decryptTenantSecret(agent.credentialCiphertext)}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Dify respondeu ${response.status}`);
  const result = await response.json() as Record<string, unknown>;
  const answer = textFromDify(result);
  if (!answer) return { skipped: "empty_response" as const };
  const providerMessageId = await sendZapiText(tenantId, contactPhone, answer);
  await assertTenantQuota(tenantId, "messages");
  await db.insert(messages).values({ tenantId, conversationId, direction: "outbound", channel: "whatsapp", providerMessageId, body: answer });
  await db.update(conversations).set({ latestMessagePreview: answer, unreadCount: 0, externalConversationId: typeof result.conversation_id === "string" ? result.conversation_id : conversation?.externalConversationId ?? null, firstResponseAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  return { replied: true as const };
}
