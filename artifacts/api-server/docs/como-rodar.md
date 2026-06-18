# Como Rodar

## Pré-requisitos

- **Node.js** 20+ (use `.nvmrc` ou o runtime configurado no Replit/Railway)
- **pnpm** 9+ (gerenciador de pacotes do monorepo)
- **PostgreSQL** 15+ acessível via `DATABASE_URL`

## Instalação

```bash
# Na raiz do monorepo
pnpm install
```

Isso instala as dependências de todos os pacotes do workspace (`api-server`, `db`, `api-zod`, `mockup-sandbox`).

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha os valores. Nunca commite `.env`.

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Opcional | Porta Express (Railway injeta automaticamente) |
| `NODE_ENV` | Sim | `development` ou `production` |
| `LOG_LEVEL` | Opcional | `trace`/`debug`/`info`/`warn`/`error`/`fatal` (padrão: `info`) |
| `ALLOWED_ORIGIN` | Sim | URL pública do app para CORS (sem barra final) |
| `DATABASE_URL` | Sim | Connection string PostgreSQL |
| `SESSION_SECRET` | Sim | Chave para assinar cookies de sessão (gere com `openssl rand -base64 48`) |
| `MSAL_TENANT_ID` | Sim | Tenant ID do Azure AD |
| `MSAL_CLIENT_ID` | Sim | Client ID do App Registration |
| `MSAL_CLIENT_SECRET` | Sim | Client Secret do App Registration |
| `MSAL_REDIRECT_URI` | Sim | URI de callback cadastrada no Azure (deve bater exatamente) |
| `R2_ACCOUNT_ID` | Sim | ID da conta Cloudflare |
| `R2_BUCKET` | Sim | Nome do bucket R2 |
| `R2_ACCESS_KEY` | Sim | Access Key do R2 |
| `R2_SECRET_KEY` | Sim | Secret Key do R2 |
| `R2_PUBLIC_URL` | Sim | URL pública base do bucket (sem barra final) |
| `CLICKUP_API_TOKEN` | Sim | Token de acesso do ClickUp |
| `CLICKUP_WEBHOOK_SECRET` | Opcional | HMAC secret do webhook ClickUp |
| `CLICKUP_LIST_GERAL` | Sim | ID da lista ClickUp para solicitações gerais |
| `CLICKUP_LIST_EVENTOS` | Sim | ID da lista ClickUp para eventos |
| `CLICKUP_LIST_BRINDES` | Sim | ID da lista ClickUp para brindes |
| `CLICKUP_LIST_PATROCINIO` | Sim | ID da lista ClickUp para patrocínio |
| `CLICKUP_ASSIGNEE_GERAL` | Sim | ID do usuário ClickUp responsável padrão |
| `CLICKUP_ASSIGNEE_EVENTOS` | Sim | ID do usuário ClickUp para eventos |
| `CLICKUP_ASSIGNEE_BRINDES` | Sim | ID do usuário ClickUp para brindes |
| `CLICKUP_ASSIGNEE_PATROCINIO` | Sim | ID do usuário ClickUp para patrocínio |
| `WEBHOOK_CARTAO_FISICO` | Sim | URL n8n para geração de cartão físico |
| `WEBHOOK_CARTAO_DIGITAL` | Sim | URL n8n para geração de cartão digital |
| `WEBHOOK_BOAS_VINDAS` | Sim | URL n8n para cartão de boas-vindas |
| `WEBHOOK_NPS` | Sim | URL n8n para arte NPS |
| `WEBHOOK_CONVITE_FP` | Sim | URL n8n para convite Financial Planning |
| `WEBHOOK_CERTIFICADO` | Sim | URL n8n para certificado |
| `WEBHOOK_COMEMORATIVO` | Sim | URL n8n para cartão comemorativo |
| `INTERNAL_API_SECRET` | Sim | Chave HMAC para chamadas internas (n8n → API) |
| `MYSQL_CONTATOS` | Opcional | `mysql://user:pass@host:3306/db` para perfis de assessores |
| `URL_LOGO_BRANCA` | Opcional | URL SVG do logo branco (fallback para CDN R2) |
| `URL_LOGO_PRETA` | Opcional | URL SVG do logo preto |
| `URL_MANUAL` | Opcional | URL do PDF do manual de eventos |
| `URL_TUTORIAL_TRANSMISSAO` | Opcional | URL do tutorial de transmissão |
| `URL_VIDEO_HERO` | Opcional | URL do vídeo de fundo da tela de eventos |
| `EMAIL_UPLOAD` | Opcional | E-mail de notificação de upload |

## Comandos de desenvolvimento

```bash
# Roda o build e sobe o servidor em modo desenvolvimento
pnpm --filter @workspace/api-server run dev

# Somente build (esbuild → dist/)
pnpm --filter @workspace/api-server run build

# Somente start (precisa que dist/ já exista)
pnpm --filter @workspace/api-server run start

# Type-check sem emit
pnpm --filter @workspace/api-server run typecheck
```

> O comando `dev` executa **build + start** em sequência. Não há watch mode — para recarregar, reinicie o processo manualmente (ou use o botão "Run" no Replit).

## Rodar no Replit

O Replit gerencia o processo via Workflow configurado:

```
pnpm --filter @workspace/api-server run dev
```

- O servidor escuta na porta injetada pela variável `PORT`.
- As variáveis de ambiente são configuradas em **Secrets** no painel do Replit.
- Para reiniciar: clique em **Run** na barra superior ou use o painel de Workflows.

## Deploy no Railway

1. Crie um projeto Railway e adicione um serviço **PostgreSQL** e um serviço **Node**.
2. Conecte o repositório Git ao serviço Node.
3. Configure o **Start Command**:
   ```
   pnpm --filter @workspace/api-server run start
   ```
4. Configure o **Build Command** (ou use o Nixpacks do Railway):
   ```
   pnpm install && pnpm --filter @workspace/api-server run build
   ```
5. Adicione todas as variáveis de ambiente em **Settings → Variables**.
6. O Railway injeta `DATABASE_URL` automaticamente quando o banco é vinculado ao serviço.

## Migrações de banco

O `src/index.ts` chama `db.execute(sql`CREATE TABLE IF NOT EXISTS ...`)` na inicialização — o schema é criado automaticamente na primeira subida. Para alterações de schema, edite `packages/db/src/schema/index.ts` e suba o servidor (Drizzle não executa migrações automáticas destrutivas).

> TODO: verificar se existe script de migração Drizzle (`drizzle-kit push` ou `migrate`) configurado no monorepo.

## Scripts one-off

```bash
# Migrar assignees de env vars para o banco (seguro re-rodar)
pnpm --filter @workspace/api-server run migrate-assignments

# Semear templates de arte padrão (idempotente)
pnpm --filter @workspace/api-server run seed-art-templates

# Importar histórico CSV de cartões físicos (dry-run por padrão)
pnpm tsx artifacts/api-server/src/scripts/import-cartoes.ts --csv caminho/arquivo.csv
# Para aplicar de verdade:
pnpm tsx artifacts/api-server/src/scripts/import-cartoes.ts --csv caminho/arquivo.csv --apply
```

Veja detalhes sobre cada script em [scripts.md](scripts.md).
