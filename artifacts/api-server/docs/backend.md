# Backend

## Montagem do servidor (`src/app.ts` / `src/index.ts`)

`src/index.ts` é o entry-point: inicializa o schema do banco (tabelas `CREATE TABLE IF NOT EXISTS`) e sobe o Express. `src/app.ts` monta os middlewares e rotas.

**Middlewares (em ordem):**

| Middleware | Finalidade |
|---|---|
| `helmet` | Headers de segurança HTTP |
| `compression` | GZIP |
| `cors` | Restringe origens a `ALLOWED_ORIGIN` |
| `express-rate-limit` | Limite separado para `/auth` e `/api` |
| `pino-http` | Logging estruturado de requisições |
| `express.json()` + `express.urlencoded()` | Parsers de body |
| `cookie-parser` | Parsing de cookies |
| `express-session` + `connect-pg-simple` | Sessões persistidas no PostgreSQL |
| `multer` | Upload de arquivos multipart (configurado em `forms.ts`) |

## Rotas

### `POST /api/solicitacoes` — criar solicitação

Fluxo completo:

1. **`requireAuth`** — verifica sessão ativa.
2. **Parse do FormData** — `multer` extrai arquivos; body JSON é parseado.
3. **`normalizeFormDados(tipo, dados)`** — normaliza chaves para snake_case via `KEY_MAP`, remove campos vazios, aplica transformações por tipo (ex.: `cd_ancord` do perfil, contagem de selos).
4. **`validateFormDados(tipo, dados)`** — verifica `REQUIRED_FIELDS[tipo]`; retorna 400 se faltarem campos.
5. **INSERT em `solicitacoes`** — status inicial `recebido`.
6. **Upload de arquivos para R2** — cada arquivo vai para `r2/<uuid>.<ext>`; URLs salvas em `arquivos`.
7. **`createClickUpTask(tipo, dados, solicitacaoId)`** — monta descrição estruturada e cria tarefa na lista ClickUp correta (configurada em `tipo_clickup_list` ou fallback para env vars).
8. **UPDATE `clickup_task_id`** no banco.
9. **Resposta 201** com `{ id, clickup_task_id }`.
10. **Background:** dispara `triggerArtGeneration(id, tipo, dados)` se for tipo de automação — não bloqueia a resposta.

### `GET /api/solicitacoes` — listar

- Colaboradores veem apenas as próprias. Admins/gestores veem todas.
- Filtros: `status`, `tipo`, `search` (título), `from`/`to` (data), `page`/`limit`.
- Retorna paginação + array de solicitações com status formatado.

### `GET /api/solicitacoes/:id` — detalhe

- Colaboradores só acessam as próprias (403 caso contrário).
- Retorna todos os campos, arquivos, `entrega_links` e `avaliacao`.

### `PATCH /api/solicitacoes/:id/aprovacao` — aprovar arte

- Disponível para o dono da solicitação.
- Marca a solicitação como aprovada e notifica o time via n8n.

### `GET /api/solicitacoes/:id/entrega` — links de entrega

- Retorna `{ links, status }` para que o frontend exiba o botão de download.

### `GET /api/form-schemas` — metadados dos formulários

- Não requer autenticação.
- Retorna `{ marcas, contratos, cargos, setores, tipos, labels }`.
- Usado pelo `config.js` do frontend na inicialização.

### `GET /api/config` — configuração de UI

- Não requer autenticação.
- Retorna URLs de recursos (logo, manual, vídeo hero, email de upload, lista de unidades).

---

## `normalizeFormDados` e `KEY_MAP`

`normalizeFormDados(tipo, dados)` é responsável por garantir que os dados cheguem ao banco e ao ClickUp sempre no formato canônico **snake_case**.

```
KEY_MAP = {
  // camelCase legado → snake_case canônico
  nomeCartao     → nome_cartao
  emailCorporativo → email_corporativo
  contratoSocial   → contrato_social
  isPrivateKey     → is_private_key
  modeloCartao     → modelo_cartao
  // ... (~20 mapeamentos)
}
```

A função percorre todas as chaves do objeto `dados`, renomeia via `KEY_MAP`, remove valores `null`/`undefined`/`""`, e aplica transformações específicas por tipo (ex.: injeta `cd_ancord` do perfil do usuário para tipos de assessor).

> O campo `dados` é armazenado como `jsonb` no PostgreSQL. A convenção snake_case é a forma canônica. Dados enviados antes da migração 8.3 usavam camelCase — o script `migrate-assignments.ts` e o `normalizeFormDados` tratam ambas as formas.

---

## Geração de artefatos

A geração automática ocorre após o `POST /api/solicitacoes` em background:

```
art-generator.ts
  └─ busca art_templates ativos para tipo + variant (marca/contrato)
  └─ template-renderer.ts (sharp)
       └─ baixa assets (logos, fotos) via fetch
       └─ compõe imagem PNG
  └─ pdf-renderer.ts (pdf-lib)        ← se o template gera PDF
  └─ gerar-cartao.ts (pdfkit)         ← para cartão físico (vetorizado)
  └─ uploadToR2()
  └─ UPDATE solicitacoes.entrega_links + status → concluido
       └─ notifications.ts dispara webhook n8n (notificação ao usuário)
```

Se a geração falhar, `status` é atualizado para `erro` e `erro_geracao` recebe a mensagem.

---

## Webhook do ClickUp (`POST /webhook/clickup`)

1. Valida assinatura HMAC-SHA256 no header `x-signature` usando `CLICKUP_WEBHOOK_SECRET`.
2. Extrai `task_id` e `status` do payload.
3. Busca `solicitacao` por `clickup_task_id`.
4. Mapeia o status ClickUp para status interno via `CLICKUP_STATUS_MAP`.
5. Atualiza `solicitacoes.status` no banco.
6. Se novo status for `em-aprovacao` ou `concluido`, dispara notificação via `notifications.ts`.

---

## Autenticação (`src/routes/auth.ts`)

Fluxo Microsoft MSAL (OAuth 2.0 Authorization Code + PKCE):

```
GET /auth/login
  └─ MSAL gera authorization URL → redireciona para Microsoft

GET /auth/callback
  └─ MSAL troca code por token
  └─ extrai email (@svninvest.com.br obrigatório)
  └─ busca/cria usuário em usersTable
  └─ busca perfil em MySQL Contatos (telefone, unidade, cargo, cd_ancord)
  └─ popula req.session.user e req.session.userProfile
  └─ redireciona para ?redirect= ou /

GET /auth/me          → { authenticated, user, profile, pendentes }
GET /auth/me-profile  → { profile }
GET /auth/logout      → destrói sessão, redireciona para /
```

---

## Middleware de autorização

```ts
// Verifica apenas autenticação
requireAuth

// Verifica autenticação + role
requireRole("admin")
requireRole("admin", "gestor")
requireRole("capital_humano", "gestor", "admin")
```

Roles disponíveis: `colaborador` (padrão), `gestor`, `admin`, `capital_humano`.
