# Arquitetura do Lyra Omnichannel SaaS

## Objetivo do produto

O Lyra é uma plataforma SaaS de atendimento omnichannel para empresas de qualquer segmento que utilizam canais de conversa como parte crítica de relacionamento, vendas, suporte, agendamento, operações e pós-venda. Cada empresa será um **tenant isolado**, com usuários, conversas, contatos, agentes de IA, integrações, documentos, métricas e assinatura próprios.

> A regra central do produto é simples: nenhum dado operacional, segredo ou arquivo de um tenant pode ser listado, modificado, processado ou baixado por outro tenant.

## Estratégia de agentes de IA

O produto terá uma camada de provedores de IA. Na primeira versão comercial, o provedor suportado será o **Dify**, mas a interface do SaaS não ficará acoplada a ele. Administradores de cada tenant configurarão perfis de agentes dentro do Lyra, com nome, finalidade, canal, modo de execução, regras de transferência, palavras-chave, horário de funcionamento, inputs aceitos e agente ativo.

| Caminho | Como funciona para o cliente | Vantagens | Limitações | Indicação |
|---|---|---|---|---|
| **Perfis de agente no Lyra conectados ao Dify** | O cliente cria e controla os perfis, regras e ativação no Lyra; cada perfil aponta para uma aplicação Dify por meio de chave de API isolada. | Entrada rápida no mercado, aproveita fluxos, RAG e ferramentas já montadas no Dify. | A criação visual completa do fluxo ainda ocorre no Dify Studio. | Primeira versão comercial. |
| **Construtor nativo de agentes no Lyra** | O cliente monta prompts, fluxos, fontes de conhecimento e automações diretamente no Lyra. | Experiência totalmente proprietária e sem painel externo para o cliente. | Requer motor de workflow, RAG, observabilidade e infraestrutura de IA próprios. | Evolução de produto após validação comercial. |

A integração inicial tratará a chave do Dify como credencial de uma aplicação, respeitando o modelo da API oficial: cada chave é associada a um app e as chamadas distinguem cada contato pelo identificador `user`. O adaptador aceitará bases Dify Cloud e auto-hospedadas, além de modos chat, streaming, workflow e completion quando compatíveis com o perfil selecionado. [1]

## Isolamento multiempresa

Todas as entidades de domínio devem conter `tenantId`, exceto as entidades de plataforma. Os acessos do tenant serão resolvidos por uma associação entre usuário, tenant e papel. Toda procedure protegida deverá descobrir o tenant ativo no servidor e compor o filtro `tenantId` antes de consultar ou modificar qualquer recurso.

| Camada | Responsabilidade de isolamento |
|---|---|
| Banco de dados | Chaves estrangeiras para tenant, índices compostos e unicidade por tenant quando aplicável. |
| API do servidor | Verificação de associação, papel e tenant ativo antes da operação. Nunca confiar em um `tenantId` enviado pelo cliente sem autorização. |
| Arquivos privados | Metadados com tenant, proprietário e classificação; acesso só após autorização e geração de URL assinada curta. |
| Integrações | Uma configuração e uma credencial por tenant, com credenciais mascaradas na interface e chamadas executadas somente no servidor. |
| Eventos externos | Webhooks vinculados a um tenant por endpoint/segredo próprio, validação de assinatura, registro idempotente e auditoria. |

## Papéis e responsabilidades

| Papel | Escopo | Permissões principais |
|---|---|---|
| Super-admin | Plataforma | Gerenciar tenants, planos, limites, suporte, auditoria e indicadores globais. |
| Admin do tenant | Empresa contratante | Gerenciar equipe, agentes, integrações, cobrança, regras de fila e dados da própria empresa. |
| Atendente | Empresa contratante | Trabalhar conversas autorizadas, contatos, notas internas e perfil de presença. |

## Planos e limites técnicos

Os planos não serão apenas elementos de marketing. Cada plano terá limites aplicáveis no servidor para membros ativos, conversas mensais, mensagens, agentes, integrações, armazenamento e retenção de histórico. Antes de criar recursos de alto custo, o servidor calculará o consumo do período do tenant e bloqueará a operação quando o limite estiver esgotado, mantendo uma trilha de auditoria.

## Arquivos e documentos privados

Mídias, documentos de atendimento, comprovantes, arquivos de ERP e exportações de conversa serão armazenados em armazenamento privado. O banco manterá apenas chave, metadados, tamanho, tipo, tenant, remetente, classificação e período de retenção. O cliente receberá URL assinada de curta duração somente depois que a autorização do tenant for confirmada. Nenhum documento privado será salvo no diretório público do aplicativo.

## Integrações e eventos

| Integração | Escopo do tenant | Padrão de segurança |
|---|---|---|
| Z-API | Instância, token, token de cliente, segredo de webhook e configurações de leitura. | Webhook por tenant, validação obrigatória, idempotência por mensagem e segredos server-side. |
| Dify | Base URL, chave da aplicação, tipo de app, perfil, regras de handoff e política de fallback. | Chave mascarada, nunca retornada pelo endpoint, execução somente no servidor e log sem payload sensível. |
| NetSuite | Conta, credencial OAuth ou API e mapeamento de documento. | Segredo por tenant, TLS obrigatório, resposta sanitizada e arquivos privados. |
| Pagamentos | Cliente, preços, assinatura e estado de cobrança. | Webhook assinado, idempotência por evento e limites sincronizados por estado de assinatura. |

## Entregas da primeira versão comercial

A primeira versão comercial prioriza aquisição e operação: landing page, onboarding, tenant, membros, papéis, planos, agentes configuráveis, painel de conversas, filas, equipe, métricas, configuração segura de integrações e billing. As integrações reais serão conectadas a partir das credenciais do tenant, sem valores de exemplo ou segredos fixos no código.

## Referências

[1]: https://docs.dify.ai/en/api-reference/guides/get-started — **Dify Docs: Get Started with the API**.
