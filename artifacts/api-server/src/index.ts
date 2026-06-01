import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const DB_STATEMENTS = [
  // Sessões (express-session)
  `CREATE TABLE IF NOT EXISTS "session" (
    "sid"    VARCHAR      NOT NULL COLLATE "default",
    "sess"   JSON         NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")`,

  // Usuários
  `CREATE TABLE IF NOT EXISTS "users" (
    "id"               SERIAL       PRIMARY KEY,
    "email"            VARCHAR(255) NOT NULL UNIQUE,
    "name"             VARCHAR(255),
    "role"             VARCHAR(20)  NOT NULL DEFAULT 'colaborador',
    "created_at"       TIMESTAMP    NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "telefone" VARCHAR(30)`,
  `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clickup_user_id" VARCHAR(100)`,

  // Solicitações
  `CREATE TABLE IF NOT EXISTS "solicitacoes" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_user_email"       ON "solicitacoes" ("user_email")`,
  `CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_tipo_solicitacao" ON "solicitacoes" ("tipo_solicitacao")`,
  `CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_status"           ON "solicitacoes" ("status")`,
  `ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "notifications_sent" JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_created_at"       ON "solicitacoes" ("created_at" DESC)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "idx_solicitacoes_clickup_task_id" ON "solicitacoes" ("clickup_task_id") WHERE "clickup_task_id" IS NOT NULL`,

  // Arquivos
  `CREATE TABLE IF NOT EXISTS "arquivos" (
    "id"             SERIAL       PRIMARY KEY,
    "solicitacao_id" INTEGER      NOT NULL REFERENCES "solicitacoes" ("id"),
    "campo"          VARCHAR(100),
    "url_r2"         TEXT         NOT NULL,
    "nome_original"  VARCHAR(255),
    "created_at"     TIMESTAMP    NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_arquivos_solicitacao_id" ON "arquivos" ("solicitacao_id")`,

  // Log de atividades
  `CREATE TABLE IF NOT EXISTS "activity_log" (
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
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_activity_log_created_at"     ON "activity_log" ("created_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "IDX_activity_log_solicitacao_id" ON "activity_log" ("solicitacao_id")`,

  // Art templates (templates de artes para solicitações)
  `CREATE TABLE IF NOT EXISTS "art_templates" (
    "id"         SERIAL        PRIMARY KEY,
    "tipo"       VARCHAR(100)  NOT NULL,
    "config"     JSONB         NOT NULL,
    "updated_at" TIMESTAMP     NOT NULL DEFAULT NOW(),
    "updated_by" INTEGER       REFERENCES "users" ("id")
  )`,
  // Remove UNIQUE(tipo) que existia na versão original — permite múltiplos templates por tipo
  `ALTER TABLE "art_templates" DROP CONSTRAINT IF EXISTS "art_templates_tipo_unique"`,
  `ALTER TABLE "art_templates" ADD COLUMN IF NOT EXISTS "name"       VARCHAR(200) NOT NULL DEFAULT ''`,
  `ALTER TABLE "art_templates" ADD COLUMN IF NOT EXISTS "is_active"  BOOLEAN      NOT NULL DEFAULT false`,
  `ALTER TABLE "art_templates" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP    NOT NULL DEFAULT NOW()`,
  `ALTER TABLE "art_templates" ADD COLUMN IF NOT EXISTS "variant_value" VARCHAR(100)`,

  // User-Tipo assignments
  `CREATE TABLE IF NOT EXISTS "user_tipo_assignments" (
    "id"      SERIAL       PRIMARY KEY,
    "user_id" INTEGER      NOT NULL REFERENCES "users" ("id") ON DELETE CASCADE,
    "tipo"    VARCHAR(50)  NOT NULL,
    UNIQUE ("user_id", "tipo")
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_user_tipo_assignments_user_id" ON "user_tipo_assignments" ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "IDX_user_tipo_assignments_tipo"    ON "user_tipo_assignments" ("tipo")`,

  // ClickUp list config por tipo de formulário
  `CREATE TABLE IF NOT EXISTS "tipo_clickup_list" (
    "id"         SERIAL       PRIMARY KEY,
    "tipo"       VARCHAR(100) NOT NULL UNIQUE,
    "list_id"    VARCHAR(50)  NOT NULL,
    "list_name"  VARCHAR(255),
    "updated_at" TIMESTAMP    NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_tipo_clickup_list_tipo" ON "tipo_clickup_list" ("tipo")`,

  `CREATE TABLE IF NOT EXISTS "clickup_lists" (
    "id"         SERIAL       PRIMARY KEY,
    "list_id"    VARCHAR(50)  NOT NULL UNIQUE,
    "list_name"  VARCHAR(255),
    "created_at" TIMESTAMP    NOT NULL DEFAULT now()
  )`,

  // Art assets (imagens da biblioteca de templates)
  `CREATE TABLE IF NOT EXISTS "art_assets" (
    "id"                    SERIAL        PRIMARY KEY,
    "filename"              VARCHAR(300)  NOT NULL,
    "storage_key"           VARCHAR(500)  NOT NULL UNIQUE,
    "url"                   VARCHAR(500)  NOT NULL,
    "mime_type"             VARCHAR(100)  NOT NULL,
    "size_bytes"            BIGINT        NOT NULL,
    "width"                 INTEGER,
    "height"                INTEGER,
    "uploaded_by"           INTEGER       REFERENCES "users" ("id"),
    "uploaded_at"           TIMESTAMP     NOT NULL DEFAULT NOW(),
    "used_in_template_ids"  INTEGER[]     NOT NULL DEFAULT '{}',
    "last_used_at"          TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_art_assets_uploaded_at"    ON "art_assets" ("uploaded_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "IDX_art_assets_used_template"  ON "art_assets" USING GIN ("used_in_template_ids")`,
  `ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "erro_geracao" text`,

  // Aprovação de cartões físicos
  `CREATE TABLE IF NOT EXISTS "cartao_aprovacoes" (
    "id"              SERIAL PRIMARY KEY,
    "solicitacao_id"  INTEGER NOT NULL UNIQUE REFERENCES "solicitacoes" ("id") ON DELETE CASCADE,
    "data_pedido"     VARCHAR(20),
    "nome"            VARCHAR(255),
    "whatsapp"        VARCHAR(50),
    "email"           VARCHAR(255),
    "unidade"         VARCHAR(120),
    "contrato_social" VARCHAR(60),
    "envio_para"      VARCHAR(255),
    "custo"           VARCHAR(20),
    "status"          VARCHAR(40) NOT NULL DEFAULT 'aguardando-validacao',
    "updated_at"      TIMESTAMP   NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_cartao_aprovacoes_solic" ON "cartao_aprovacoes" ("solicitacao_id")`,
  `ALTER TABLE "cartao_aprovacoes" ADD COLUMN IF NOT EXISTS "observacao" TEXT`,

  // Eventos estruturados por solicitação
  `CREATE TABLE IF NOT EXISTS "eventos_solicitacao" (
    "id"             SERIAL        PRIMARY KEY,
    "solicitacao_id" INTEGER       NOT NULL REFERENCES "solicitacoes" ("id") ON DELETE CASCADE,
    "tipo"           VARCHAR(16)   NOT NULL CHECK ("tipo" IN ('info','warning','error')),
    "origem"         VARCHAR(32)   NOT NULL,
    "mensagem"       TEXT          NOT NULL,
    "detalhes"       JSONB,
    "user_email"     VARCHAR(255),
    "created_at"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_eventos_sol"     ON "eventos_solicitacao" ("solicitacao_id", "created_at" DESC)`,
  `CREATE INDEX IF NOT EXISTS "idx_eventos_tipo_24h" ON "eventos_solicitacao" ("tipo", "created_at" DESC) WHERE "tipo" IN ('warning','error')`,
];

async function start() {
  for (const sql of DB_STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ errMessage: msg, sql: sql.slice(0, 80) }, "DB setup: statement skipped");
    }
  }
  logger.info("Database setup complete");

  const server = app.listen(port, () => {
    logger.info({ port }, "Server listening");
  });

  server.on('error', (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

start();
