import { afterEach, describe, expect, it, vi } from "vitest";

const { decryptTenantSecret } = vi.hoisted(() => ({ decryptTenantSecret: vi.fn(() => "tenant-secret") }));
vi.mock("../tenantSecrets", () => ({ decryptTenantSecret }));

import { assertProviderConfiguration, extractAiText, invokeConfiguredAiAgent, testConfiguredAiAgent } from "./aiProvider";

const input = { tenantId: 9, conversationId: 31, contactId: 14, contactPhone: "5511999999999", body: "Preciso de uma segunda via" };
const baseAgent = { apiBaseUrl: null, externalAppId: null, credentialCiphertext: "cipher", mode: "chat", instructions: "Atenda em português" } as const;

describe("adaptador de provedores de IA", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
  it("extrai texto de respostas estruturadas sem acoplar a orquestração ao provedor", () => {
    expect(extractAiText({ metadata: { answer: "Resposta configurada" } })).toBe("Resposta configurada");
    expect(extractAiText({ data: [] })).toBeNull();
  });
  it("envia agentes OpenAI pelo endpoint Responses com instruções do tenant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "resp_1", output_text: "Aqui está a segunda via." }) }); vi.stubGlobal("fetch", fetchMock);
    await expect(invokeConfiguredAiAgent({ ...baseAgent, provider: "openai", externalAppId: "gpt-4o-mini" }, input)).resolves.toEqual({ text: "Aqui está a segunda via.", externalConversationId: "resp_1" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tenant-secret" }) })); expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: "gpt-4o-mini", instructions: "Atenda em português", store: false });
  });
  it("envia Gemini pelo endpoint de geração com chave do tenant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: "Resposta Gemini" }] } }] }) }); vi.stubGlobal("fetch", fetchMock);
    await expect(invokeConfiguredAiAgent({ ...baseAgent, provider: "gemini", externalAppId: "gemini-2.0-flash" }, input)).resolves.toEqual({ text: "Resposta Gemini", externalConversationId: null });
    const url = new URL(fetchMock.mock.calls[0][0]); expect(url.pathname).toBe("/v1beta/models/gemini-2.0-flash:generateContent"); expect(url.searchParams.get("key")).toBe("tenant-secret");
  });
  it("envia conectores visuais por endpoint compatível sem expor o segredo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Resposta do fluxo" }) }); vi.stubGlobal("fetch", fetchMock);
    await expect(invokeConfiguredAiAgent({ ...baseAgent, provider: "flowise", apiBaseUrl: "https://flow.example", externalAppId: "flow_10" }, input)).resolves.toEqual({ text: "Resposta do fluxo", externalConversationId: null });
    expect(fetchMock).toHaveBeenCalledWith("https://flow.example/api/v1/prediction/flow_10", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tenant-secret" }) }));
  });
  it("envia Claude usando a API de mensagens e credencial do tenant", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ content: [{ type: "text", text: "Resposta Claude" }] }) }); vi.stubGlobal("fetch", fetchMock);
    await expect(invokeConfiguredAiAgent({ ...baseAgent, provider: "anthropic", externalAppId: "claude-3-5-haiku-latest" }, input)).resolves.toEqual({ text: "Resposta Claude", externalConversationId: null });
    expect(fetchMock).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.objectContaining({ headers: expect.objectContaining({ "x-api-key": "tenant-secret" }) }));
  });
  it("exige identificadores de fluxo e URLs nos provedores que dependem de endpoints publicados", () => {
    expect(() => assertProviderConfiguration("flowise", "https://flow.example", "")).toThrow("ID do fluxo");
    expect(() => assertProviderConfiguration("langflow", "", "flow_1")).toThrow("URL do endpoint");
    expect(() => assertProviderConfiguration("adk", "", "")).toThrow("URL do endpoint");
    expect(() => assertProviderConfiguration("langgraph", "https://graph.example", "agent_1")).not.toThrow();
  });
  it("valida conectividade contra endpoints LangGraph, Langflow e n8n usando a credencial cifrada", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output: "ok" }) }); vi.stubGlobal("fetch", fetchMock);
    for (const provider of ["langgraph", "langflow", "n8n"] as const) await expect(testConfiguredAiAgent({ ...baseAgent, provider, apiBaseUrl: "https://provider.example", externalAppId: provider === "langflow" ? "flow_1" : "" })).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(3); expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer tenant-secret");
  });
});
