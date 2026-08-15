export const aiProviderIds = ["dify", "openai", "anthropic", "gemini", "langgraph", "flowise", "langflow", "n8n", "native", "other"] as const;
export type AiProviderId = (typeof aiProviderIds)[number];

export const aiProviderCatalog: Record<AiProviderId, { label: string; kind: "direct" | "orchestrator" | "visual" | "custom"; defaultBaseUrl: string; defaultModel: string; credentialLabel: string; description: string }> = {
  dify: { label: "Dify", kind: "visual", defaultBaseUrl: "https://api.dify.ai/v1", defaultModel: "", credentialLabel: "Chave da aplicação Dify", description: "Workflow visual e RAG por API." },
  openai: { label: "OpenAI Agents / API", kind: "direct", defaultBaseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", credentialLabel: "API key da OpenAI", description: "Agentes nativos, ferramentas e respostas por API." },
  anthropic: { label: "Anthropic Claude API", kind: "direct", defaultBaseUrl: "https://api.anthropic.com", defaultModel: "claude-3-5-haiku-latest", credentialLabel: "API key da Anthropic", description: "Claude com ferramentas e respostas estruturadas." },
  gemini: { label: "Google Gemini + ADK", kind: "direct", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.0-flash", credentialLabel: "API key do Google AI", description: "Gemini direto ou endpoint publicado por ADK." },
  langgraph: { label: "LangGraph", kind: "orchestrator", defaultBaseUrl: "", defaultModel: "", credentialLabel: "Token do LangGraph", description: "Endpoint de agente persistente com execução e aprovação humana." },
  flowise: { label: "Flowise", kind: "visual", defaultBaseUrl: "", defaultModel: "", credentialLabel: "Chave da API do Flowise", description: "Chatflows visuais via API." },
  langflow: { label: "Langflow", kind: "visual", defaultBaseUrl: "", defaultModel: "", credentialLabel: "Chave da API do Langflow", description: "Fluxos visuais e componentes de IA via endpoint." },
  n8n: { label: "n8n", kind: "visual", defaultBaseUrl: "", defaultModel: "", credentialLabel: "Chave ou token do webhook n8n", description: "Webhook de automação que devolve a resposta do agente." },
  native: { label: "Agente nativo", kind: "direct", defaultBaseUrl: "", defaultModel: "", credentialLabel: "Credencial do provedor", description: "Implementação nativa do Lyra para evolução futura." },
  other: { label: "API compatível personalizada", kind: "custom", defaultBaseUrl: "", defaultModel: "", credentialLabel: "Token da API", description: "Endpoint HTTP compatível definido pelo tenant." },
};
