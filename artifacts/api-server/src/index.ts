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
  `CREATE INDEX IF NOT EXISTS "IDX_solicitacoes_created_at"       ON "solicitacoes" ("created_at" DESC)`,

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
