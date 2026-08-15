# Estratégia de provedores de IA do Lyra

O Lyra deve manter o Dify como opção visual, mas tratar todos os provedores como conectores por tenant atrás de um adaptador único. Essa abordagem preserva o controle de credenciais, ferramentas, auditoria e regras de handoff dentro do SaaS.

| Prioridade | Provedor ou camada | Papel recomendado no Lyra |
|---|---|---|
| 1 | OpenAI Agents SDK / API | Agentes nativos em TypeScript, ferramentas, handoffs, guardrails e tracing. |
| 2 | Anthropic Claude API | Casos analíticos e uso estruturado de ferramentas sob controle server-side. |
| 3 | Google Gemini + ADK | Gemini é conectado diretamente; um agente ADK é conectado pelo endpoint HTTP publicado pelo tenant. |
| 4 | LangGraph | Orquestrações duráveis com etapas determinísticas e aprovação humana. |
| 5 | Dify, Flowise, Langflow e n8n | Conectores visuais ou endpoints externos opcionais, nunca fonte de autorização ou isolamento. |

As APIs de ferramenta do Claude permitem que a aplicação execute os próprios recursos sensíveis, o OpenAI Agents SDK disponibiliza ferramentas, handoffs, sessões e tracing, o Google ADK suporta múltiplos modelos e integrações, e o LangGraph combina passos determinísticos com etapas orientadas por modelo. Essas capacidades orientam a separação entre provedor e regras de negócio do Lyra. [1] [2] [3] [4]

Para Google ADK, o Lyra não executa o framework dentro do próprio processo: o tenant publica o agente em sua infraestrutura e informa a URL e o token no catálogo. O Lyra faz a chamada autenticada, conserva o contexto conversacional e mantém a autorização, o segredo e o handoff sob seu próprio controle.

## Referências

[1]: https://openai.github.io/openai-agents-js/ "OpenAI Agents SDK for TypeScript"
[2]: https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview "Anthropic Tool Use"
[3]: https://google.github.io/adk-docs/ "Google Agent Development Kit"
[4]: https://docs.langchain.com/oss/python/langgraph/overview "LangGraph Overview"
