# Evolution API no Render

Este deployment é destinado exclusivamente a testes e protótipos. A Evolution API usa o protocolo do WhatsApp Web e não é uma integração oficial da Meta.

## Deploy

1. No Render, abra **New → Blueprint** e conecte este repositório.
2. O Render detectará o `render.yaml` na raiz. A cópia em `deploy/render/evolution-api.yaml` fica como referência organizada.
3. No serviço criado, configure `SERVER_URL` com a URL pública HTTPS do próprio serviço, por exemplo `https://lyra-evolution-api.onrender.com`.
4. Copie o valor gerado de `AUTHENTICATION_API_KEY`.
5. No ambiente do Lyra, configure:

```env
EVOLUTION_API_URL=https://lyra-evolution-api.onrender.com
EVOLUTION_API_KEY=<o-valor-de-AUTHENTICATION_API_KEY>
```

6. Reinicie o Lyra e abra **Integrações → WhatsApp via Evolution API → Criar instância de teste**.

## Limitações do plano gratuito

- O serviço pode dormir quando não houver tráfego.
- Sem banco e volume persistentes, uma reinicialização ou novo deploy pode exigir novo QR Code.
- Não use número pessoal, número principal da empresa ou dados de clientes nesse ambiente.
- O serviço gratuito não é adequado para SLA, produção ou múltiplos clientes reais.

Para um teste mais estável, habilite PostgreSQL, Redis e armazenamento persistente em um plano pago e ajuste as variáveis oficiais da versão da Evolution API utilizada.
