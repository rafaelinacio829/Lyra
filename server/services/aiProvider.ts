import { agentProfiles } from "../../drizzle/schema";
import type { AiProviderId } from "../../shared/aiProviders";
import { aiProviderCatalog } from "../../shared/aiProviders";
import { decryptTenantSecret } from "../tenantSecrets";

export type AiInvocation = { tenantId: number; conversationId: number; contactId: number; contactPhone: string; body: string; externalConversationId?: string | null };
export type AiProviderResponse = { text: string | null; externalConversationId: string | null };
export type ConfiguredAiAgent = Pick<typeof agentProfiles.$inferSelect, "provider" | "apiBaseUrl" | "externalAppId" | "credentialCiphertext" | "mode" | "instructions">;

export function extractAiText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["output_text", "answer", "text", "content", "result", "output", "message"]) { const text = extractAiText(record[key]); if (text) return text; }
  for (const item of Object.values(record)) { const text = extractAiText(item); if (text) return text; }
  if (Array.isArray(value)) for (const item of value) { const text = extractAiText(item); if (text) return text; }
  return null;
}

function baseUrl(agent: ConfiguredAiAgent) { const fallback = aiProviderCatalog[agent.provider as AiProviderId]?.defaultBaseUrl ?? ""; return (agent.apiBaseUrl || fallback).replace(/\/+$/, ""); }
function token(agent: ConfiguredAiAgent) { if (!agent.credentialCiphertext) throw new Error("Configure a credencial do provedor antes de ativar este agente."); return decryptTenantSecret(agent.credentialCiphertext); }
function model(agent: ConfiguredAiAgent) { return agent.externalAppId || aiProviderCatalog[agent.provider as AiProviderId]?.defaultModel || ""; }

export function assertProviderConfiguration(provider: AiProviderId, apiBaseUrl: string | null | undefined, externalAppId: string | null | undefined) {
  if (["flowise", "langflow"].includes(provider) && !externalAppId?.trim()) throw new Error("Informe o ID do fluxo para este provedor.");
  if (["adk", "langgraph", "flowise", "langflow", "n8n", "native", "other"].includes(provider) && !apiBaseUrl?.trim()) throw new Error("Informe a URL do endpoint para este provedor.");
}

async function invokeDify(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  const endpoint = agent.mode === "workflow" ? "/workflows/run" : agent.mode === "completion" ? "/completion-messages" : "/chat-messages";
  const user = `tenant-${input.tenantId}-contact-${input.contactId}`;
  const payload = agent.mode === "workflow" ? { inputs: { message: input.body, contact_phone: input.contactPhone, conversation_id: String(input.conversationId) }, response_mode: "blocking", user } : { inputs: {}, query: input.body, response_mode: "blocking", user, ...(input.externalConversationId ? { conversation_id: input.externalConversationId } : {}) };
  const response = await fetch(`${baseUrl(agent)}${endpoint}`, { method: "POST", headers: { Authorization: `Bearer ${token(agent)}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Dify respondeu ${response.status}`);
  const raw = await response.json() as Record<string, unknown>;
  return { text: extractAiText(raw.answer ?? raw.text ?? raw.result ?? raw.output), externalConversationId: typeof raw.conversation_id === "string" ? raw.conversation_id : input.externalConversationId ?? null };
}

async function invokeOpenAi(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  const response = await fetch(`${baseUrl(agent)}/responses`, { method: "POST", headers: { Authorization: `Bearer ${token(agent)}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: model(agent), instructions: agent.instructions || undefined, input: input.body, store: false }) });
  if (!response.ok) throw new Error(`OpenAI respondeu ${response.status}`);
  const raw = await response.json() as Record<string, unknown>; return { text: extractAiText(raw), externalConversationId: typeof raw.id === "string" ? raw.id : input.externalConversationId ?? null };
}

async function invokeAnthropic(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  const response = await fetch(`${baseUrl(agent)}/v1/messages`, { method: "POST", headers: { "x-api-key": token(agent), "anthropic-version": "2023-06-01", "Content-Type": "application/json" }, body: JSON.stringify({ model: model(agent), max_tokens: 700, system: agent.instructions || undefined, messages: [{ role: "user", content: input.body }] }) });
  if (!response.ok) throw new Error(`Anthropic respondeu ${response.status}`);
  const raw = await response.json() as Record<string, unknown>; return { text: extractAiText(raw.content), externalConversationId: input.externalConversationId ?? null };
}

async function invokeGemini(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  const url = new URL(`${baseUrl(agent)}/models/${model(agent)}:generateContent`); url.searchParams.set("key", token(agent));
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ systemInstruction: agent.instructions ? { parts: [{ text: agent.instructions }] } : undefined, contents: [{ role: "user", parts: [{ text: input.body }] }] }) });
  if (!response.ok) throw new Error(`Gemini respondeu ${response.status}`);
  const raw = await response.json() as Record<string, unknown>; return { text: extractAiText(raw.candidates), externalConversationId: input.externalConversationId ?? null };
}

async function invokeCompatibleEndpoint(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  const provider = agent.provider as AiProviderId; const configuredBase = baseUrl(agent); const appId = agent.externalAppId || "";
  const endpoint = provider === "flowise" ? `${configuredBase}/api/v1/prediction/${appId}` : provider === "langflow" ? `${configuredBase}/api/v1/run/${appId}` : configuredBase;
  if (!endpoint) throw new Error("Configure a URL do endpoint externo.");
  const response = await fetch(endpoint, { method: "POST", headers: { Authorization: `Bearer ${token(agent)}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: input.body, question: input.body, input_value: input.body, inputs: { message: input.body, contact_phone: input.contactPhone, conversation_id: String(input.conversationId) }, session_id: input.externalConversationId || `tenant-${input.tenantId}-contact-${input.contactId}` }) });
  if (!response.ok) throw new Error(`${aiProviderCatalog[provider]?.label || "Endpoint"} respondeu ${response.status}`);
  const raw = await response.json() as Record<string, unknown>; return { text: extractAiText(raw), externalConversationId: typeof raw.session_id === "string" ? raw.session_id : input.externalConversationId ?? null };
}

export async function invokeConfiguredAiAgent(agent: ConfiguredAiAgent, input: AiInvocation): Promise<AiProviderResponse> {
  switch (agent.provider) { case "dify": return invokeDify(agent, input); case "openai": return invokeOpenAi(agent, input); case "anthropic": return invokeAnthropic(agent, input); case "gemini": return invokeGemini(agent, input); case "adk": case "langgraph": case "flowise": case "langflow": case "n8n": case "native": case "other": return invokeCompatibleEndpoint(agent, input); default: throw new Error(`Provedor de IA não suportado: ${agent.provider}`); }
}

export async function testConfiguredAiAgent(agent: ConfiguredAiAgent) {
  const provider = agent.provider as AiProviderId;
  if (provider === "dify") { const response = await fetch(`${baseUrl(agent)}/info`, { headers: { Authorization: `Bearer ${token(agent)}` } }); if (!response.ok) throw new Error(`Dify respondeu ${response.status}`); return; }
  if (provider === "openai") { const response = await fetch(`${baseUrl(agent)}/models`, { headers: { Authorization: `Bearer ${token(agent)}` } }); if (!response.ok) throw new Error(`OpenAI respondeu ${response.status}`); return; }
  if (provider === "gemini") { const url = new URL(`${baseUrl(agent)}/models`); url.searchParams.set("key", token(agent)); const response = await fetch(url); if (!response.ok) throw new Error(`Gemini respondeu ${response.status}`); return; }
  if (provider === "anthropic") { await invokeAnthropic(agent, { tenantId: 0, conversationId: 0, contactId: 0, contactPhone: "", body: "Responda somente: ok" }); return; }
  assertProviderConfiguration(provider, agent.apiBaseUrl, agent.externalAppId);
  await invokeCompatibleEndpoint(agent, { tenantId: 0, conversationId: 0, contactId: 0, contactPhone: "", body: "Teste de conectividade Flow One: responda somente ok." });
}
