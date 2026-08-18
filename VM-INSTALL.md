# Implantação do Lyra em uma VM

Este pacote contém o código-fonte do Lyra e os arquivos auxiliares para execução em uma VM Linux. A aplicação é uma aplicação Node.js/TypeScript com frontend Vite/React, backend Express/tRPC e camada de persistência Drizzle.

## Observação importante sobre o banco `.db`

A versão presente neste repositório **não utiliza SQLite**. O arquivo `server/db.ts`, o schema `drizzle/schema.ts` e as migrações foram definidos para **MySQL/MariaDB**, usando `mysql2`. Portanto, um arquivo SQLite `lyra.db` não é compatível com esta versão sem uma migração adicional da camada de dados. O pacote não cria um `.db` falso nem altera silenciosamente o banco, para evitar perda de dados ou uma implantação que falhe em produção.

Se “banco `.db`” significar um banco de arquivo SQLite, será necessário converter o schema, os tipos de data/JSON, as migrações e a conexão antes da publicação. Se a intenção for apenas manter o banco na própria VM, instale MySQL/MariaDB localmente e mantenha o arquivo `.env` apontando para `127.0.0.1`; essa é a configuração suportada pelo pacote.

## Instalação

Copie o diretório para a VM e execute:

```bash
cd lyra
git clone não é necessário quando o ZIP já foi transferido
cp .env.example .env
nano .env
./deploy/install-vm.sh
./deploy/start-vm.sh
```

Antes de executar a instalação, crie o banco e o usuário no MySQL/MariaDB e ajuste `DATABASE_URL`. O script instala as dependências travadas pelo `pnpm-lock.yaml`, gera o build de produção e aplica o schema com o comando de migração existente no projeto.

## Execução como serviço

Para uma instalação simples, use o `systemd` e substitua `lyra` pelo usuário Linux responsável pela aplicação:

```ini
[Unit]
Description=Lyra
After=network.target mysql.service

[Service]
Type=simple
User=lyra
WorkingDirectory=/home/lyra/lyra
ExecStart=/home/lyra/lyra/deploy/start-vm.sh
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Salve como `/etc/systemd/system/lyra.service`, execute `sudo systemctl daemon-reload`, `sudo systemctl enable --now lyra` e verifique os logs com `journalctl -u lyra -f`. O servidor inicia na porta definida por `PORT`, cujo valor padrão é `3000`.

## Backup

O script `deploy/backup-db.sh` gera um dump lógico do MySQL/MariaDB no diretório `backups/`. Antes do primeiro uso, confirme que `mysqldump` está instalado e configure uma política de retenção externa.
