# Guia de publicação e operação segura

## Antes de publicar

1. Revise o `todo.md` e conclua os itens que forem necessários para o primeiro cliente piloto.
2. Confirme que a chave `TENANT_SECRETS_KEY` está configurada; ela cifra as credenciais de Dify, canais de WhatsApp e ERP personalizado por tenant.
3. No painel de pagamentos, reivindique o sandbox Stripe e configure os produtos de produção somente após a validação do checkout de teste.
4. Verifique no banco que os planos Starter, Growth e Scale foram criados ao concluir o primeiro onboarding.
5. Configure todas as variáveis obrigatórias do `.env.example`. Em produção, o processo encerra imediatamente se faltar banco, segredos de sessão/cofre, código de ativação ou Stripe.
6. Execute `pnpm check`, `pnpm test` e `pnpm build` antes de publicar.

## Health check e encerramento

- O endpoint `GET /healthz` retorna `200` somente quando o processo consegue consultar o banco; em caso de indisponibilidade retorna `503` sem expor detalhes ou segredos.
- O servidor trata `SIGTERM` e `SIGINT` para encerrar o listener de forma graciosa durante deploy, restart ou escala horizontal.
- Configure o load balancer, container platform ou monitor para consultar `/healthz` e retirar instâncias que retornarem `503`.

## Configuração por tenant

| Integração | Dados necessários | Validação no Flow One |
|---|---|---|
| Dify | URL base da instância, chave da aplicação, tipo de agente, regras de handoff. | O administrador cria o perfil, informa a chave no cofre e só ativa o agente após a validação. |
| Z-API | A plataforma precisa de um `ZAPI_PARTNER_CLIENT_TOKEN` de uma conta integradora/parceira. | O Flow One cria a instância, ativa o webhook e mostra o QR Code; o cliente não informa nenhum ID ou token e só conecta o WhatsApp pelo celular. |
| Evolution API | `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` no servidor. | Modo de protótipo self-hosted: o Flow One cria a instância e mostra o QR Code. Não é uma integração oficial da Meta e não deve ser usada como garantia comercial. |
| WhatsApp Cloud API | Phone Number ID, token de sistema, App Secret e versão Graph API. | O Flow One gera URL e token de verificação, valida a conexão e só processa webhooks assinados. |
| ERP personalizado | URL HTTPS pública, caminho de saúde, caminho de consulta e token de API. | O botão de teste valida a conexão; destinos locais são bloqueados e a configuração só é ativada em caso de sucesso. |
| Stripe | Configuração gerenciada pela plataforma, sem inserção de chave pelo tenant. | Checkout para cartão, boleto ou método automático; portal, faturas e webhook usam a assinatura associada ao tenant. |

## Boas práticas de operação

- Não envie chaves de integração em mensagens, planilhas ou capturas de tela. O painel só apresenta indicação de credencial configurada e impressão digital, nunca o valor da chave.
- Configure `ZAPI_PARTNER_CLIENT_TOKEN` no servidor com uma conta integradora/parceira da Z-API. No painel, o cliente clica em **Criar e conectar WhatsApp** e lê o QR Code; a criação da instância, os tokens e o webhook ficam sob responsabilidade do Flow One.
- Para a WhatsApp Cloud API, registre no painel da Meta a URL e o token de verificação gerados pelo Flow One e assine o campo de webhook `messages`.
- Use um agente por finalidade operacional e configure palavras-chave de transferência antes de automatizar fluxos de suporte, vendas, agendamento, pós-venda ou qualquer outra jornada do cliente.
- Valide a API do ERP do cliente em ambiente de homologação antes de permitir consultas em produção; essa integração é opcional e o contrato de referência é adaptado ao processo de cada empresa.
- Para acompanhar custos internos, use a tabela `tenant_cost_events` e o endpoint administrativo `platform.costSummary`. O resultado separa custo por cliente e calcula preço sugerido/lucro com `PLATFORM_PROFIT_MARGIN_PERCENT`; essa informação nunca é exibida ao tenant.
- Para documentos privados, mantenha a regra de acesso por tenant e use apenas URLs assinadas de curta duração emitidas pelo servidor.

## Após publicar

1. Clique em **Publish** na interface de gerenciamento para disponibilizar a versão criada pelo checkpoint.
2. Configure domínio próprio e e-mail transacional antes de convidar clientes reais.
3. Mantenha alertas de e-mail e rotinas recorrentes desativados até a validação do domínio remetente e a decisão operacional da plataforma.
4. Faça o piloto com um tenant interno, um canal WhatsApp de teste, um agente Dify de homologação e os meios de pagamento habilitados no sandbox Stripe.

## Ativação futura do e-mail transacional

O código já prepara alertas de conversas sem responsável, risco de primeira resposta e expiração de trial, mas **não envia nenhuma mensagem** enquanto `RESEND_API_KEY` e `RESEND_FROM` não estiverem configuradas. Quando o domínio remetente estiver validado no provedor, informe os dois valores de forma segura nas configurações do projeto. Somente depois da publicação, crie os callbacks periódicos autenticados para avaliar alertas e o resumo semanal; cada execução deve ser idempotente e registrar sua própria evidência de entrega para não repetir notificações em caso de nova tentativa.

> O SaaS aplica isolamento e limites na camada do servidor, mas integrações externas só ficam operacionais após cada tenant inserir e validar suas próprias credenciais.
