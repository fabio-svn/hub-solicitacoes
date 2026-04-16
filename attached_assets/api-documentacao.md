# Hub de Solicitações SVN — Documentação das APIs

**Versão:** Abril 2026  
**Stack:** Express 5 · TypeScript · PostgreSQL (Drizzle ORM) · Cloudflare R2 · ClickUp API · Microsoft MSAL

---

## Visão Geral

O backend é uma API REST servida por um único processo Express. Além das rotas de API, ele também serve os arquivos estáticos do frontend (HTML/CSS/JS) a partir da pasta `public/`. Toda comunicação entre frontend e backend ocorre pelo mesmo domínio, sem separação de subdomínio.

---

## Infraestrutura da Aplicação

### CORS
- **Origem permitida:** `ALLOWED_ORIGIN` (variável de ambiente) — padrão: `https://hub.portalsvn.com.br`
- Credenciais habilitadas (`credentials: true`) para permitir envio de cookies de sessão

### Sessões
- Armazenadas no PostgreSQL via `connect-pg-simple` (tabela `session`)
- Duração: **8 horas** por sessão
- Cookie com `httpOnly: true`, `sameSite: lax`, `secure: true` em produção

### Logging
- Pino HTTP com serialização customizada: loga método, URL (sem query string) e status code de cada requisição

---

## Grupos de Rotas

### 1. Configuração — `GET /api/config`

**Objetivo:** Fornecer ao frontend as URLs e configurações dinâmicas que podem variar entre ambientes (dev / prod).

**Autenticação:** Pública (sem autenticação)

**Cache:** `public, max-age=300` (5 minutos no browser)

**Resposta:**
```json
{
  "r2PublicUrl": "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev",
  "emailUpload": "gabriela.franca@svninvest.com.br",
  "urlVideoHero": "https://.../bg-eventos-2.mp4",
  "urlLogoBranca": "https://.../SVN-2.svg",
  "urlLogoPreta": "https://.../SVN-1.svg",
  "urlManual": "https://.../Manual-de-Eventos-SVN.pdf",
  "urlTutorialTransmissao": "https://drive.google.com/..."
}
```

Todos os campos possuem valores padrão hardcoded como fallback caso as variáveis de ambiente não estejam definidas.

---

### 2. Health Check — `GET /api/healthz`

**Objetivo:** Verificar se o servidor está no ar. Usado por monitoramentos externos e pelo sistema de deploy.

**Autenticação:** Pública

**Resposta:**
```json
{ "status": "ok" }
```

---

### 3. Autenticação — `/auth/*`

Implementada com **Microsoft MSAL** (OAuth 2.0 Authorization Code Flow). Somente contas do domínio `@svninvest.com.br` são aceitas.

#### `GET /auth/login`
Inicia o fluxo de autenticação. Redireciona o usuário para o login Microsoft com `prompt: select_account`.

**Query params:**
- `redirect` (opcional) — URL para onde redirecionar após login. Aceita apenas caminhos relativos (`/dashboard.html`, etc.) para prevenir open redirect.

**Segurança:** Gera um `nonce` aleatório armazenado na sessão para validação CSRF.

#### `GET /auth/callback`
Recebe o código de autorização da Microsoft e conclui o login.

**Fluxo:**
1. Valida o `state` contra o `nonce` da sessão (proteção CSRF)
2. Troca o código por token via MSAL
3. Verifica que o email termina em `@svninvest.com.br`
4. Upsert do usuário no banco: insere se novo, atualiza o nome se mudou
5. Preenche `req.session.user` com `{ email, name, role }`
6. Redireciona para a URL original solicitada

**Erros tratados:** `no_code`, `invalid_state`, `no_account`, `domain_not_allowed`, `auth_failed`

#### `GET /auth/logout`
Destrói a sessão no servidor e redireciona para `/`.

#### `GET /auth/me`
Retorna o estado de autenticação atual do usuário.

**Resposta (autenticado):**
```json
{
  "authenticated": true,
  "user": { "email": "nome@svninvest.com.br", "name": "Nome Sobrenome", "role": "colaborador" }
}
```

**Resposta (não autenticado):**
```json
{ "authenticated": false }
```

---

### 4. Solicitações — `/api/solicitacoes`

O coração do sistema. Gerencia o ciclo de vida completo das solicitações feitas pelos colaboradores.

#### `POST /api/solicitacoes`
Cria uma nova solicitação.

**Autenticação:** Requerida  
**Content-Type:** `multipart/form-data` (aceita arquivos de até 50 MB por upload)

**Campos obrigatórios do body:**
| Campo | Tipo | Descrição |
|---|---|---|
| `tipo_solicitacao` | string | Tipo da solicitação (ver lista abaixo) |
| `dados` | JSON string | Objeto com todos os campos do formulário |
| `subtipo` | string (opcional) | Subtipo (ex: `presencial`, `nova`, `informativo`) |
| `maturidade` | `1`, `2` ou `3` (opcional) | Nível de maturidade do evento |

**Tipos válidos (`tipo_solicitacao`):**
- `eventos`
- `artes-divulgacao`
- `atualizacao-material`
- `conteudo-pdf-informativo`
- `conteudo-pdf-ebook`
- `apresentacao-nova`
- `apresentacao-atualizar`
- `pagina-assessores-dados`
- `pagina-assessores-atualizacao`

**Campos obrigatórios por tipo (validados no servidor):**
| Tipo | Campos obrigatórios |
|---|---|
| `eventos` | `nome` |
| `artes-divulgacao` | `nome`, `titulo` |
| `atualizacao-material` | `nome`, `titulo` |
| `conteudo-pdf-*` | `nome`, `titulo` |
| `apresentacao-*` | `nome`, `titulo` |
| `pagina-assessores-dados` | `nome`, `nomeCompleto` |
| `pagina-assessores-atualizacao` | `nome` |

**Arquivos aceitos (campos do formulário):**
`logoFile`, `imgFile`, `demaisFile`, `arquivoApoio`, `arquivoBase`, `arquivoBaseNova`, `materialAtual`, `fotoPerfil`, `palFoto1`–`palFoto4`

**Fluxo de processamento:**
1. Valida `tipo_solicitacao` e campos obrigatórios
2. Insere a solicitação no banco com `status: "recebido"`
3. Faz upload de cada arquivo para o **Cloudflare R2** (continua mesmo se falhar)
4. Cria uma task no **ClickUp** na lista correta (continua mesmo se falhar)
5. Salva o `clickup_task_id` na solicitação

**Resposta:**
```json
{ "success": true, "id": 42, "clickup_task_id": "abc123xyz" }
```

---

#### `GET /api/solicitacoes`
Lista solicitações com filtros e paginação.

**Autenticação:** Requerida  
**Visibilidade:** Colaboradores veem apenas as próprias. Admins e gestores veem todas.

**Query params:**
| Parâmetro | Tipo | Descrição |
|---|---|---|
| `tipo_solicitacao` | string | Filtra por tipo exato, ou `eventos` / `geral` |
| `subtipo` | string | Filtra por subtipo |
| `status` | string | `recebido`, `em-analise`, `em-producao`, `aguardando`, `concluido`, `cancelado` |
| `maturidade` | `1`–`3` | Nível de maturidade |
| `busca` | string | Busca textual no campo `dados` (ILIKE) |
| `periodo` | string | `hoje`, `7dias`, `30dias`, `mes` |
| `page` | número | Página atual (padrão: 1) |
| `limit` | número | Itens por página (padrão: 20, máximo: 100) |

**Resposta:**
```json
{
  "data": [...],
  "total": 87,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

---

#### `GET /api/solicitacoes/stats`
Retorna contadores para o dashboard.

**Autenticação:** Requerida  
**Visibilidade:** Mesma regra de colaborador/admin.

**Resposta:**
```json
{
  "active": 12,
  "completed": 45,
  "total": 60,
  "thisMonth": 8
}
```

`active` inclui os status: `recebido`, `em-analise`, `em-producao`, `aguardando`.

---

#### `GET /api/solicitacoes/:id`
Retorna uma solicitação específica com seus arquivos anexados.

**Autenticação:** Requerida  
**Visibilidade:** Colaborador só acessa as próprias. Admin/gestor acessa qualquer uma.

**Resposta:**
```json
{
  "id": 42,
  "user_email": "nome@svninvest.com.br",
  "tipo_solicitacao": "eventos",
  "status": "em-producao",
  "dados": { ... },
  "clickup_task_id": "abc123",
  "created_at": "2026-04-10T14:30:00Z",
  "arquivos": [
    { "campo": "logoFile", "url_r2": "https://...", "nome_original": "logo.png" }
  ]
}
```

---

#### `GET /api/solicitacoes/:id/status`
Sincroniza o status da solicitação com o ClickUp em tempo real.

**Autenticação:** Requerida  
**Visibilidade:** Mesma regra do endpoint anterior.

**Comportamento:**
- Se a solicitação tem `clickup_task_id`, consulta a API do ClickUp
- Se o status do ClickUp for diferente do banco, atualiza o banco e retorna `updated: true`
- Se não há `clickup_task_id` ou a consulta falhar, retorna o status atual do banco

**Resposta:**
```json
{ "status": "em-producao", "updated": true }
```

---

### 5. Administração — `/api/admin/*`

Gerenciamento de usuários. Acesso restrito a usuários com `role: "admin"`.

#### `GET /api/admin/users`
Lista todos os usuários cadastrados no sistema.

**Autenticação:** Requerida (`admin`)

**Resposta:** Array com todos os registros da tabela `users`.

---

#### `PUT /api/admin/users/:id/role`
Altera o papel de um usuário.

**Autenticação:** Requerida (`admin`)

**Body:**
```json
{ "role": "gestor" }
```

**Roles válidas:** `colaborador`, `gestor`, `admin`

**Validações:**
- ID deve ser um número inteiro válido
- Role deve ser uma das três opções válidas
- Não é possível alterar a própria role
- Usuário deve existir

**Resposta:**
```json
{ "success": true }
```

---

## Integração ClickUp

### Objetivo
Criar uma task no ClickUp automaticamente a cada nova solicitação, para que o time de Marketing possa gerenciar as demandas.

### Mapeamento de Listas
| Tipo de Solicitação | Lista ClickUp |
|---|---|
| `eventos` | `CLICKUP_LIST_EVENTOS` (ID: `901303299333`) |
| Todos os outros tipos | `CLICKUP_LIST_GERAL` (ID: `901300673533`) |

### Nome da Task
Formato: `[tipo subtipo] titulo — Solicitante`  
Exemplo: `[eventos presencial] Jantar de Clientes — João Silva`

### Mapeamento de Status (ClickUp → Hub)
| Status ClickUp | Status Hub |
|---|---|
| `to do` | `recebido` |
| `in progress` | `em-producao` |
| `waiting` | `aguardando` |
| `waiting on rh` | `aguardando` |
| `complete` | `concluido` |
| `cancelled` | `cancelado` |

### Comportamento sem Configuração
Se `CLICKUP_API_TOKEN` não estiver definido, a criação de tasks é ignorada com um `warn` no log. O sistema continua funcionando normalmente.

---

## Integração Cloudflare R2

### Objetivo
Armazenar os arquivos enviados pelos colaboradores nos formulários (logos, imagens, PDFs, fotos de perfil, etc.).

### Caminho dos Arquivos
```
solicitacoes/{id_solicitacao}/{campo}/{uuid}.{ext}
```
Exemplo: `solicitacoes/42/logoFile/a1b2c3d4.png`

### Comportamento sem Configuração
Se as credenciais R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`) não estiverem definidas, o upload é ignorado com um `warn` no log. A solicitação é salva no banco normalmente.

---

## Controle de Acesso (Roles)

| Role | Permissões |
|---|---|
| `colaborador` | Criar solicitações · Ver apenas as próprias |
| `gestor` | Criar solicitações · Ver todas as solicitações |
| `admin` | Tudo do gestor + gerenciar roles de usuários |

Novos usuários são criados automaticamente com `role: "colaborador"` no primeiro login.

---

## Variáveis de Ambiente

| Variável | Obrigatório em Prod | Descrição |
|---|---|---|
| `SESSION_SECRET` | ✅ | Segredo para assinar o cookie de sessão |
| `MSAL_CLIENT_ID` | ✅ | ID do aplicativo Azure |
| `MSAL_TENANT_ID` | ✅ | ID do tenant Azure (`@svninvest.com.br`) |
| `MSAL_CLIENT_SECRET` | ✅ | Secret do aplicativo Azure |
| `MSAL_REDIRECT_URI` | ✅ | URL completa do callback (ex: `https://hub.portalsvn.com.br/auth/callback`) |
| `DATABASE_URL` | ✅ | Connection string do PostgreSQL |
| `ALLOWED_ORIGIN` | ✅ | Domínio permitido no CORS (ex: `https://hub.portalsvn.com.br`) |
| `CLICKUP_API_TOKEN` | Recomendado | Token de API do ClickUp |
| `CLICKUP_LIST_EVENTOS` | Opcional | ID da lista de eventos no ClickUp |
| `CLICKUP_LIST_GERAL` | Opcional | ID da lista geral no ClickUp |
| `R2_ACCOUNT_ID` | Recomendado | ID da conta Cloudflare |
| `R2_ACCESS_KEY` | Recomendado | Access key do R2 |
| `R2_SECRET_KEY` | Recomendado | Secret key do R2 |
| `R2_BUCKET` | Recomendado | Nome do bucket R2 |
| `R2_PUBLIC_URL` | Opcional | URL pública do bucket R2 |
| `EMAIL_UPLOAD` | Opcional | E-mail de destino para notificações de upload |
