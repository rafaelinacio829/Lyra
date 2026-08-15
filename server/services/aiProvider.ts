import { agentProfiles } from "../../drizzle/schema";
import { decryptTenantSecret } from "../tenantSecrets";

export type AiInvocation = { tenantId: number; conversationId: number; contactId: number; contactPhone: string; body: string; externalConversationId?: string | null };
export type AiProviderResponse = { text: string | null; externalConversationId: string | null };
export type ConfiguredAiAgent = Pick<typeof agentProfiles.$inferSelect, "provider" | "apiBaseUrl" | "credentialCiphertext" | "mode">;

export function extractAiText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  for (const candidate of Object.values(value as Record<string, unknown>)) { const text = extractAiText(candidate); if (text) return text; }
  return null;
}

async function invokeDify(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  if (!agent.apiBaseUrl || !agent.credentialCiphertext) throw new Error("Agente Dify sem conexão válida.");
  const endpoint = agent.mode === "workflow" ? "/workflows/run" : agent.mode === "completion" ? "/completion-messages" : "/chat-messages";
  const user = `tenant-${input.tenantId}-contact-${input.contactId}`;
  const payload = agent.mode === "workflow" ? { inputs: { message: input.body, contact_phone: input.contactPhone, conversation_id: String(input.conversationId) }, response_mode: "blocking", user } : { inputs: {}, query: input.body, response_mode: "blocking", user, ...(input.externalConversationId ? { conversation_id: input.externalConversationId } : {}) };
  const response = await fetch(`${agent.apiBaseUrl.replace(/\/+$/, "")}${endpoint}`, { method: "POST", headers: { Authorization: `Bearer ${decryptTenantSecret(agent.credentialCiphertext)}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Dify respondeu ${response.status}`);
  const raw = await response.json() as Record<string, unknown>;
  return { text: extractAiText(raw.answer ?? raw.text ?? raw.result ?? raw.output), externalConversationId: typeof raw.conversation_id === "string" ? raw.conversation_id : input.externalConversationId ?? null };
}

export async function invokeConfiguredAiAgent(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  switch (agent.provider) { case "dify": return invokeDify(agent, input); default: throw new Error(`Provedor de IA não suportado: ${agent.provider}`); }
}
