# Referências de Integração

## Z-API

A Z-API envia eventos para endpoints previamente configurados via POST. O SaaS deverá gerar e registrar um endpoint HTTPS por configuração de tenant, persistir o identificador de evento para idempotência e somente processar mensagens após resolver de forma segura a integração proprietária. A documentação informa que webhooks sem HTTPS não são aceitos e disponibiliza endpoints para configurar a URL de eventos recebidos ou todos os webhooks da instância. [1] [2] [3]

## Dify

A chave de API no Dify é associada a uma aplicação e as chamadas devem distinguir usuários finais por um identificador de usuário. A camada do Lyra guardará a chave de cada tenant no servidor, associará cada perfil a uma aplicação e tratará chat, streaming, workflow ou completion de acordo com o modo configurado. [4]

## NetSuite

O SuiteTalk REST permite operações sobre registros e consultas. A documentação oficial recomenda OAuth 2.0 como alternativa à autenticação baseada em token, eliminando a necessidade de armazenar credenciais de usuário; o conector do Lyra adotará uma configuração por tenant e guardará tokens exclusivamente no servidor. A fatura é exposta pelo registro REST `invoice`, condicionado aos recursos necessários da conta NetSuite. [5] [6] [7]

## Referências

[1]: https://developer.z-api.io/en/webhooks/introduction — **Z-API: Webhooks Introduction**.
[2]: https://developer.z-api.io/en/webhooks/on-message-received — **Z-API: On Receive Webhook**.
[3]: https://developer.z-api.io/en/webhooks/update-every-webhooks — **Z-API: Update All Webhooks**.
[4]: https://docs.dify.ai/en/api-reference/guides/get-started — **Dify: Get Started with the API**.
[5]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_1540391670.html — **Oracle NetSuite: SuiteTalk REST Web Services Overview**.
[6]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/chapter_157769826287.html — **Oracle NetSuite: OAuth 2.0**.
[7]: https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_161488248489.html — **Oracle NetSuite: Invoice Record**.
