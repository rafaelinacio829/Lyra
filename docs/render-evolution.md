# Evolution API no Render

Este deployment é destinado exclusivamente a testes e protótipos. A Evolution API usa o protocolo do WhatsApp Web e não é uma integração oficial da Meta.

## Deploy

1. No Render, abra **New → Blueprint** e conecte este repositório.
2. O Render detectará o `render.yaml` na raiz. A cópia em `deploy/render/evolution-api.yaml` fica como referência organizada.
3. No serviço criado, configure `SERVER_URL` com a URL pública HTTPS do próprio serviço, por exemplo `https://lyra-evolution-api.onrender.com`.
4. Configure `DATABASE_CONNECTION_URI` com uma URL PostgreSQL externa (Neon, Supabase ou outro PostgreSQL compatível). A versão atual da Evolution API exige `DATABASE_PROVIDER=postgresql`; deixar esse valor vazio causa `Database provider invalid`.
   - No Supabase, use o **Session Pooler** na porta `5432` para essa instalação, não o **Transaction Pooler** na porta `6543`. A Evolution executa `prisma migrate deploy` durante o boot, e o Transaction Pooler pode bloquear ou deixar essa etapa pendurada.
   - A URL deve ter este formato, com a senha real preenchida somente no Render: `postgresql://postgres.<project-ref>:<password>@aws-1-us-west-2.pooler.supabase.com:5432/postgres`
5. Copie o valor gerado de `AUTHENTICATION_API_KEY`.
6. Confirme também `SERVER_TYPE=http`, `SERVER_PORT=10000`, `PORT=10000` e `HOST=0.0.0.0`; o Render fornece a porta 10000 aos web services e a Evolution deve escutar essa porta. O health check usa `/`, uma rota disponível na API.
7. Mantenha `LOG_LEVEL=INFO` durante o primeiro deploy para que o log mostre `HTTP - ON: 10000`; depois ele pode ser reduzido para `ERROR`.
7. No ambiente do Lyra, configure:

```env
EVOLUTION_API_URL=https://lyra-evolution-api.onrender.com
EVOLUTION_API_KEY=<o-valor-de-AUTHENTICATION_API_KEY>
```

8. Reinicie o Lyra e abra **Integrações → WhatsApp via Evolution API → Criar instância de teste**.

## Limitações do plano gratuito

- O serviço pode dormir quando não houver tráfego.
- Sem banco e volume persistentes, uma reinicialização ou novo deploy pode exigir novo QR Code.
- Não use número pessoal, número principal da empresa ou dados de clientes nesse ambiente.
- O serviço gratuito não é adequado para SLA, produção ou múltiplos clientes reais.

Para um teste mais estável, habilite PostgreSQL, Redis e armazenamento persistente em um plano pago e ajuste as variáveis oficiais da versão da Evolution API utilizada.
