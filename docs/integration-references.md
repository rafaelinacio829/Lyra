# Referências de Integração

## Z-API

A Z-API envia eventos para endpoints previamente configurados via POST. O SaaS deverá gerar e registrar um endpoint HTTPS por configuração de tenant, persistir o identificador de evento para idempotência e somente processar mensagens após resolver de forma segura a integração proprietária. A documentação informa que webhooks sem HTTPS não são aceitos e disponibiliza endpoints para configurar a URL de eventos recebidos ou todos os webhooks da instância. [1] [2] [3]

## Dify

A chave de API no Dify é associada a uma aplicação e as chamadas devem distinguir usuários finais por um identificador de usuário. A camada do Flow One guardará a chave de cada tenant no servidor, associará cada perfil a uma aplicação e tratará chat, streaming, workflow ou completion de acordo com o modo configurado. [4]

## WhatsApp Cloud API oficial

A WhatsApp Business Platform Cloud API permite mensagens programáticas e entrega mensagens recebidas e atualizações de status via webhook. O Flow One mantém Phone Number ID, token de sistema, App Secret e token de verificação separados por tenant, validando assinatura HMAC antes de processar qualquer evento. [5] [6]

## ERP personalizado

O conector de ERP do Flow One não é acoplado a fornecedor. Cada empresa informa uma base HTTPS pública, caminho de verificação, caminho de consulta e token de API; o servidor bloqueia destinos locais e mantém a credencial cifrada. O contrato de consulta aceita uma referência configurável, como cliente, pedido ou contrato, e normaliza a resposta para o painel e os arquivos privados.

## Referências

[1]: https://developer.z-api.io/en/webhooks/introduction — **Z-API: Webhooks Introduction**.
[2]: https://developer.z-api.io/en/webhooks/on-message-received — **Z-API: On Receive Webhook**.
[3]: https://developer.z-api.io/en/webhooks/update-every-webhooks — **Z-API: Update All Webhooks**.
[4]: https://docs.dify.ai/en/api-reference/guides/get-started — **Dify: Get Started with the API**.
[5]: https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform — **Meta: WhatsApp Business Platform**.
[6]: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview — **Meta: WhatsApp Webhooks**.
