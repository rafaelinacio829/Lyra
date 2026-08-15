import { and, desc, eq } from "drizzle-orm";
import { agentProfiles, contacts, conversations, messages } from "../../drizzle/schema";
import { getDb } from "../db";
import { sendZapiText } from "./zapi";
import { assertTenantQuota } from "../planLimits";
import { invokeConfiguredAiAgent } from "./aiProvider";

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
  let result: Awaited<ReturnType<typeof invokeConfiguredAiAgent>>;
  try {
    result = await invokeConfiguredAiAgent(agent, { tenantId, conversationId, contactId, contactPhone, body, externalConversationId: conversation?.externalConversationId });
  } catch (primaryError) {
    if (!agent.fallbackAgentId) throw primaryError;
    const [fallback] = await db.select().from(agentProfiles).where(and(eq(agentProfiles.id, agent.fallbackAgentId), eq(agentProfiles.tenantId, tenantId), eq(agentProfiles.isActive, true), eq(agentProfiles.provider, "dify"))).limit(1);
    if (!fallback) throw primaryError;
    result = await invokeConfiguredAiAgent(fallback, { tenantId, conversationId, contactId, contactPhone, body, externalConversationId: conversation?.externalConversationId });
  }
  const answer = result.text;
  if (!answer) return { skipped: "empty_response" as const };
  const providerMessageId = await sendZapiText(tenantId, contactPhone, answer);
  await assertTenantQuota(tenantId, "messages");
  await db.insert(messages).values({ tenantId, conversationId, direction: "outbound", channel: "whatsapp", providerMessageId, body: answer });
  await db.update(conversations).set({ latestMessagePreview: answer, unreadCount: 0, externalConversationId: result.externalConversationId, firstResponseAt: new Date(), updatedAt: new Date() }).where(eq(conversations.id, conversationId));
  return { replied: true as const };
}
