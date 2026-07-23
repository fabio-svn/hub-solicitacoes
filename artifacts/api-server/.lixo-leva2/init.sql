-- =============================================================================
-- Hub de Solicitações SVN — Script de inicialização do banco de dados
-- =============================================================================
-- Execute este script uma única vez no banco PostgreSQL do Railway (ou qualquer
-- outro PostgreSQL) antes de iniciar o servidor pela primeira vez.
--
-- Uso via psql:
--   psql "$DATABASE_URL" -f scripts/init.sql
--
-- Uso via Railway CLI:
--   railway run psql "$DATABASE_URL" -f scripts/init.sql
-- =============================================================================

-- ── 1. Sessões (express-session / connect-pg-simple) ─────────────────────────
CREATE TABLE IF NOT EXISTS "session" (
  "sid"    VARCHAR      NOT NULL COLLATE "default",
  "sess"   JSON         NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS = FALSE);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- ── 2. Usuários ───────────────────────────────────────────────────────────────
-- Criados automaticamente no primeiro login via MSAL.
-- role: 'colaborador' | 'admin'
CREATE TABLE IF NOT EXISTS "users" (
  "id"         SERIAL       PRIMARY KEY,
  "email"      VARCHAR(255) NOT NULL UNIQUE,
  "name"       VARCHAR(255),
  "role"       VARCHAR(20)  NOT NULL DEFAULT 'colaborador',
  "created_at" TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── 3. Solicitações ───────────────────────────────────────────────────────────
-- Tabela principal. Cada linha = uma solicitação de material/serviço.
-- dados: campos do formulário (JSONB flexível por tipo)
-- entrega_links: [{label, url}] — links gerados automaticamente (ex: assinatura PNG)
-- avaliacao: {nota, comentario} — avaliação do usuário após conclusão
CREATE TABLE IF NOT EXISTS "solicitacoes" (
  "id"               SERIAL       PRIMARY KEY,
  "user_email"       VARCHAR(255) NOT NULL REFERENCES "users" ("email"),
  "tipo_solicitacao" VARCHAR(50)  NOT NULL,
  "subtipo"          VARCHAR(50),
  "maturidade"       INTEGER,
  "dados"            JSONB        NOT NULL,
  "clickup_task_id"  VARCHAR(100),
  "titulo"           TEXT,
  "clickup_url"      TEXT,
  "avaliacao"        JSONB,
  "entrega_links"    JSONB,
  "status"           VARCHAR(30)  NOT NULL DEFAULT 'recebido',
  "responsavel"      TEXT,
  "created_at"       TIMESTAMP    NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_user_email"       ON "solicitacoes" ("user_email");
CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_tipo_solicitacao" ON "solicitacoes" ("tipo_solicitacao");
CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_status"           ON "solicitacoes" ("status");
CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_created_at"       ON "solicitacoes" ("created_at" DESC);

-- ── 4. Arquivos ───────────────────────────────────────────────────────────────
-- Uploads vinculados a uma solicitação, armazenados no Cloudflare R2.
CREATE TABLE IF NOT EXISTS "arquivos" (
  "id"             SERIAL       PRIMARY KEY,
  "solicitacao_id" INTEGER      NOT NULL REFERENCES "solicitacoes" ("id"),
  "campo"          VARCHAR(100),
  "url_r2"         TEXT         NOT NULL,
  "nome_original"  VARCHAR(255),
  "created_at"     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "IDX_arquivos_solicitacao_id" ON "arquivos" ("solicitacao_id");

-- ── 5. Log de atividades ──────────────────────────────────────────────────────
-- Registro de ações relevantes: criação de solicitação, mudanças de status,
-- uploads, erros, etc.
-- nivel: 'info' | 'warn' | 'error'
CREATE TABLE IF NOT EXISTS "activity_log" (
  "id"               SERIAL      PRIMARY KEY,
  "created_at"       TIMESTAMP   NOT NULL DEFAULT NOW(),
  "user_email"       TEXT,
  "user_name"        TEXT,
  "tipo"             TEXT        NOT NULL,
  "nivel"            VARCHAR(10) NOT NULL DEFAULT 'info',
  "solicitacao_id"   INTEGER,
  "tipo_solicitacao" TEXT,
  "titulo"           TEXT,
  "detalhe"          TEXT        NOT NULL,
  "metadata"         JSONB
);

CREATE INDEX IF NOT EXISTS "IDX_activity_log_created_at"     ON "activity_log" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "IDX_activity_log_solicitacao_id" ON "activity_log" ("solicitacao_id");

-- =============================================================================
-- Fim do script. Todas as tabelas criadas com IF NOT EXISTS — seguro re-executar.
-- =============================================================================
