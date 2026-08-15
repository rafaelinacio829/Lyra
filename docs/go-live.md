# Guia de publicação e operação segura

## Antes de publicar

1. Revise o `todo.md` e conclua os itens que forem necessários para o primeiro cliente piloto.
2. Confirme que a chave `TENANT_SECRETS_KEY` está configurada; ela cifra as credenciais de Dify, canais de WhatsApp e ERP personalizado por tenant.
3. No painel de pagamentos, reivindique o sandbox Stripe e configure os produtos de produção somente após a validação do checkout de teste.
4. Verifique no banco que os planos Starter, Growth e Scale foram criados ao concluir o primeiro onboarding.
5. Execute `pnpm check` e `pnpm test` antes de criar um novo checkpoint.

## Configuração por tenant

| Integração | Dados necessários | Validação no Flow One |
|---|---|---|
| Dify | URL base da instância, chave da aplicação, tipo de agente, regras de handoff. | O administrador cria o perfil, informa a chave no cofre e só ativa o agente após a validação. |
| Z-API | ID da instância, token da instância e Client-Token. | O Flow One gera URL exclusiva de webhook; a ativação confirma a configuração no provedor. |
| WhatsApp Cloud API | Phone Number ID, token de sistema, App Secret e versão Graph API. | O Flow One gera URL e token de verificação, valida a conexão e só processa webhooks assinados. |
| ERP personalizado | URL HTTPS pública, caminho de saúde, caminho de consulta e token de API. | O botão de teste valida a conexão; destinos locais são bloqueados e a configuração só é ativada em caso de sucesso. |
| Stripe | Configuração gerenciada pela plataforma, sem inserção de chave pelo tenant. | Checkout para cartão, boleto ou método automático; portal, faturas e webhook usam a assinatura associada ao tenant. |

## Boas práticas de operação

- Não envie chaves de integração em mensagens, planilhas ou capturas de tela. O painel só apresenta indicação de credencial configurada e impressão digital, nunca o valor da chave.
- Ative uma instância Z-API por tenant e confirme que cada provedor aponta para o webhook único exibido no painel.
- Para a WhatsApp Cloud API, registre no painel da Meta a URL e o token de verificação gerados pelo Flow One e assine o campo de webhook `messages`.
- Use um agente por finalidade operacional e configure palavras-chave de transferência antes de automatizar fluxos de suporte, vendas, agendamento, pós-venda ou qualquer outra jornada do cliente.
- Valide a API do ERP do cliente em ambiente de homologação antes de permitir consultas em produção; essa integração é opcional e o contrato de referência é adaptado ao processo de cada empresa.
- Para documentos privados, mantenha a regra de acesso por tenant e use apenas URLs assinadas de curta duração emitidas pelo servidor.

## Após publicar

1. Clique em **Publish** na interface de gerenciamento para disponibilizar a versão criada pelo checkpoint.
2. Configure domínio próprio e e-mail transacional antes de convidar clientes reais.
3. Mantenha alertas de e-mail e rotinas recorrentes desativados até a validação do domínio remetente e a decisão operacional da plataforma.
4. Faça o piloto com um tenant interno, um canal WhatsApp de teste, um agente Dify de homologação e os meios de pagamento habilitados no sandbox Stripe.

## Ativação futura do e-mail transacional

O código já prepara alertas de conversas sem responsável, risco de primeira resposta e expiração de trial, mas **não envia nenhuma mensagem** enquanto `RESEND_API_KEY` e `RESEND_FROM` não estiverem configuradas. Quando o domínio remetente estiver validado no provedor, informe os dois valores de forma segura nas configurações do projeto. Somente depois da publicação, crie os callbacks periódicos autenticados para avaliar alertas e o resumo semanal; cada execução deve ser idempotente e registrar sua própria evidência de entrega para não repetir notificações em caso de nova tentativa.

> O SaaS aplica isolamento e limites na camada do servidor, mas integrações externas só ficam operacionais após cada tenant inserir e validar suas próprias credenciais.
