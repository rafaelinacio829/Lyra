# Operação recorrente do Lyra

## Pré-requisito de publicação

Os alertas recorrentes não devem usar temporizadores dentro do servidor. A plataforma opera em infraestrutura elástica e processos inativos podem ser suspensos. Depois da publicação, os trabalhos devem ser registrados como callbacks HTTP autenticados sob o prefixo `/api/scheduled/`, usando o mecanismo gerenciado de Heartbeat.

| Trabalho | Frequência proposta (UTC) | Regra idempotente | Destinatário |
|---|---:|---|---|
| Monitor de SLA | A cada 15 minutos | Notificar apenas ao criar ou agravar um alerta ainda aberto. | Administradores do tenant. |
| Trial próximo do fim | Diariamente, 12:00 | Enviar no máximo uma vez por janela de 24 horas e por tenant. | Administradores do tenant. |
| Relatório de produtividade | Segunda-feira, 12:00 | Gerar uma única entrega para a semana encerrada por tenant. | Administradores do tenant. |
| Revisão de uso do plano | Diariamente, 12:15 | Alertar nos marcos de 80%, 90% e 100%, sem repetir o mesmo marco. | Administradores do tenant. |

## E-mail transacional

O SaaS ainda não contém uma credencial de provedor de e-mail transacional. Antes de habilitar esses trabalhos em produção, deve ser configurado um provedor dedicado e verificado, como Resend, Postmark ou Amazon SES. A integração deverá manter apenas a credencial server-side e um registro mínimo de entrega; nunca deve persistir o conteúdo completo de conversas ou documentos financeiros no provedor de e-mail.

## Procedimento seguro de ativação

Após criar um checkpoint e publicar o projeto, o administrador deverá configurar o provedor de e-mail, validar o domínio remetente e registrar os trabalhos Heartbeat. Cada callback deve validar a identidade do cron, localizar a regra por `taskUid` armazenado no banco e retornar uma resposta de sucesso para eventos órfãos, evitando tentativas desnecessárias.
