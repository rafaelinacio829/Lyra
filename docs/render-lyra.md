# Deploy do Lyra no Render

O `render.yaml` cria dois serviços independentes:

- `lyra`: aplicação web do SaaS;
- `lyra-evolution-api`: Evolution API usada para WhatsApp.

## Configuração

1. No Render, abra **New > Blueprint** e selecione o repositório do Lyra.
2. O Render vai detectar o `render.yaml` na raiz e criar os dois serviços.
3. No serviço `lyra`, preencha os segredos marcados como `sync: false`:
   - `DATABASE_URL`: URI MySQL/MariaDB acessível publicamente;
   - `OWNER_EMAIL`: e-mail do administrador inicial;
   - `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`;
   - `EVOLUTION_API_KEY`: o mesmo valor de `AUTHENTICATION_API_KEY` do serviço Evolution.
4. No serviço `lyra-evolution-api`, configure `DATABASE_CONNECTION_URI` com a URI PostgreSQL do Supabase e `SERVER_URL` com a URL pública do próprio serviço.
5. Faça o deploy do serviço `lyra`. O build instala dependências e compila o frontend/backend; o start aplica as migrações Drizzle e inicia o servidor.

## URLs e webhooks

Depois do deploy, a URL do Lyra será parecida com:

```text
https://lyra-xxxx.onrender.com
```

Use essa URL para acessar o sistema. O Lyra expõe:

```text
GET https://lyra-xxxx.onrender.com/healthz
POST https://lyra-xxxx.onrender.com/api/stripe/webhook
```

As instâncias Evolution criadas pelo Lyra recebem o webhook usando a URL pública do Lyra. Portanto, a aplicação precisa estar publicada no Render; `localhost` não pode ser usado para o webhook em produção.

## Banco do Lyra

O Lyra usa MySQL/MariaDB via `DATABASE_URL`; o PostgreSQL do serviço Evolution não substitui esse banco. A URI precisa apontar para um MySQL/MariaDB gerenciado, com acesso externo habilitado e TLS conforme o provedor.

## Primeiro acesso

Após o primeiro deploy, abra a URL do Lyra e use o fluxo de autenticação local. O código inicial é o valor gerado pelo Render em `LOCAL_AUTH_BOOTSTRAP_CODE`. Troque os segredos gerados e o código inicial antes de vender o sistema.
