# Integrações

## Autenticação — Microsoft MSAL (Azure AD)

**Biblioteca:** `@azure/msal-node`

O Hub usa OAuth 2.0 Authorization Code com PKCE via Microsoft Azure AD. Apenas contas do domínio `@svninvest.com.br` são aceitas.

**Configuração necessária:**
- App Registration no Azure AD com redirect URI `<APP_URL>/auth/callback`
- Variáveis: `MSAL_TENANT_ID`, `MSAL_CLIENT_ID`, `MSAL_CLIENT_SECRET`, `MSAL_REDIRECT_URI`

**Fluxo:**
```
Usuário → GET /auth/login
  → MSAL gera authorization URL → Microsoft login
  → GET /auth/callback (code troca por token)
  → valida domínio @svninvest.com.br
  → upsert em usersTable (cria se não existe, role padrão: colaborador)
  → busca perfil em MySQL Contatos
  → popula req.session.user + req.session.userProfile
  → redireciona para destino original
```

**Sessão:**
- Sessão armazenada no PostgreSQL via `connect-pg-simple`
- Cookie `connect.sid` assinado com `SESSION_SECRET`
- Expiração da sessão: configurada no `express-session`

**Perfis e permissões:**
- Role é armazenada em `users.role` e lida em cada requisição via `req.session.user.role`
- Roles: `colaborador`, `gestor`, `admin`, `capital_humano`
- Middleware `requireRole(...roles)` verifica a role antes de cada rota protegida

---

## ClickUp

**Biblioteca:** chamadas HTTP diretas via `fetch` (sem SDK)

**Token:** `CLICKUP_API_TOKEN` (personal ou service token)

### Criação de tarefas

Ao criar uma solicitação, `createClickUpTask` em `src/routes/clickup.ts`:
1. Determina a lista destino: consulta `tipo_clickup_list` no banco; fallback para variáveis `CLICKUP_LIST_*`.
2. Monta descrição estruturada em markdown com os dados do formulário.
3. Cria a tarefa via `POST https://api.clickup.com/api/v2/list/<list_id>/task`.
4. Define assignees conforme `user_tipo_assignments` ou variáveis `CLICKUP_ASSIGNEE_*`.

### Recebimento de status (webhook)

```
POST /webhook/clickup
  ← ClickUp dispara ao alterar status de uma tarefa
  → valida HMAC-SHA256 no header x-signature
  → mapeia status ClickUp → status interno via CLICKUP_STATUS_MAP
  → UPDATE solicitacoes.status
```

**`CLICKUP_STATUS_MAP`** em `src/config/clickup-status.ts` normaliza variações de capitalização e nomes alternativos para os slugs canônicos do Hub (ex.: `"in progress"` → `"em-andamento"`, `"waiting on rh"` → `"aguardando-rh"`).

### Configuração de listas via admin

Admins podem configurar qual lista ClickUp recebe cada tipo de solicitação pelo painel `/admin-clickup-lists.html`. Isso salva em `tipo_clickup_list` e sobrepõe as variáveis de ambiente.

---

## Cloudflare R2 (armazenamento de arquivos)

**Biblioteca:** `@aws-sdk/client-s3` (R2 é compatível com S3)

**Credenciais:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`, `R2_BUCKET`

**Endpoint:** `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`

**`src/lib/r2-client.ts`** exporta um singleton `S3Client`. Retorna `null` se as credenciais não estiverem configuradas (funcionalidade de upload degradada graciosamente).

### Uso

| Onde | Operação | Chave no R2 |
|---|---|---|
| Upload de anexos de formulário | PUT | `uploads/<uuid>.<ext>` |
| Artes geradas automaticamente | PUT | `artes/<uuid>.<ext>` |
| Assets de templates (admin) | PUT | `assets/<uuid>.<ext>` |
| Tombamentos (ZIPs) | PUT | `tombamentos/<uuid>.zip` |

Todas as URLs públicas têm base `R2_PUBLIC_URL`. Arquivos são servidos diretamente pelo CDN da Cloudflare.

---

## n8n / Webhooks

**Chamadas HTTP diretas** para URLs configuradas em variáveis de ambiente.

`src/services/notifications.ts` é o ponto central de disparo.

| Evento | Webhook disparado |
|---|---|
| Cartão de visita físico criado | `WEBHOOK_CARTAO_FISICO` |
| Cartão de visita digital criado | `WEBHOOK_CARTAO_DIGITAL` |
| Cartão de boas-vindas criado | `WEBHOOK_BOAS_VINDAS` |
| Arte NPS criada | `WEBHOOK_NPS` |
| Convite FP criado | `WEBHOOK_CONVITE_FP` |
| Cartão comemorativo criado | `WEBHOOK_COMEMORATIVO` |
| Certificado criado | `WEBHOOK_CERTIFICADO` |

O payload enviado ao n8n contém o `id` da solicitação e os `dados` do formulário. O n8n processa (gera arte, envia notificação, aciona gráfica etc.) e pode chamar de volta a API do Hub via `INTERNAL_API_SECRET` para atualizar `entrega_links`.

### Chamadas internas (n8n → Hub)

Rotas que recebem chamadas do n8n exigem o header `Authorization: Bearer <INTERNAL_API_SECRET>` verificado por middleware.

---

## MySQL Contatos (integração legada)

**Biblioteca:** `mysql2`

**Conexão:** pool configurado por `MYSQL_CONTATOS` (string de conexão MySQL). Se a variável estiver ausente ou vazia, a integração é desativada silenciosamente — o login ainda funciona, mas os campos de perfil (telefone, unidade, cargo, cd_ancord) chegam vazios.

**Uso:** em `/auth/callback` e `GET /auth/me-profile`, o sistema busca o contato pelo e-mail via `buscarContato(email)` em `src/lib/mysqlContatos.ts` e popula `req.session.userProfile`.

Campos retornados: `telefone`, `unidade`, `cargo`, `cd_ancord`, `encontrado` (boolean).

---

## Chamadas internas entre serviços

Chamadas de serviços externos (n8n, scripts) para a API interna usam:
```
Authorization: Bearer <INTERNAL_API_SECRET>
```

Esse header é verificado por middleware nas rotas internas. Gere a chave com `openssl rand -hex 32`.
