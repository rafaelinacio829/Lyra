# Premissas de integração e cobrança

## WhatsApp Cloud API oficial

A integração com a **WhatsApp Business Platform Cloud API** será tratada como um provedor de canal alternativo à Z-API, configurado por tenant. A documentação da Meta confirma que a Cloud API suporta mensagens de texto, mídia e interações, e que mensagens recebidas e atualizações de status são entregues ao servidor por webhooks. O desenho do Flow One deverá, portanto, manter identificadores, token, segredo de verificação, número de telefone comercial e associação de webhook separados por tenant, sem expor credenciais ao navegador. [1]

O endpoint oficial precisa responder ao desafio de verificação da Meta e processar o campo de webhook `messages`; esse campo traz as mensagens recebidas e os status de entrega de mensagens enviadas. A Meta também exige a permissão `whatsapp_business_messaging` para webhooks de mensagens. [3]

## Cobrança recorrente e boleto

O fluxo de cobrança continuará usando páginas hospedadas do gateway, para que o Flow One não armazene dados de cartão. A documentação da Stripe informa que boleto no Brasil pode ser usado em pagamentos recorrentes, é apresentado em BRL e possui confirmação assíncrona após o pagamento do cliente. A operação precisa considerar que boleto não oferece reembolso pela própria modalidade, exigindo um processo de crédito separado quando aplicável. [2]

Em assinaturas pagas por boleto, o gateway requer a ativação prévia do método de pagamento e oferece dois modelos: envio de fatura, no qual o cliente escolhe cartão ou boleto em cada cobrança, e cobrança automática, apropriada quando o cliente já tem boleto configurado como método padrão e os dados exigidos foram coletados. O Flow One deve mostrar esse estado como pendente até o evento assinado de pagamento confirmar a fatura. [4]

> A implementação deve manter os estados de cobrança sincronizados exclusivamente por eventos autenticados do gateway; a criação de uma sessão de checkout não deve, por si só, liberar limites ou ativar uma assinatura.

## Referências

[1]: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform "Meta for Developers — WhatsApp Business Platform"
[2]: https://docs.stripe.com/payments/boleto "Stripe — Boleto payments"
[3]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview "Meta for Developers — WhatsApp Webhooks"
[4]: https://docs.stripe.com/payments/boleto/set-up-subscription "Stripe — Use Boleto with subscriptions"
