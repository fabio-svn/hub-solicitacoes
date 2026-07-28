import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { startStuckMonitor } from "./services/stuck-monitor";
import { startHealthMonitor } from "./services/health-monitor";
import { sendAlert } from "./services/alert";
import { marcarDesligando } from "./routes/health";
import type { Server } from "http";

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

// Fica no escopo do modulo para que os guardas de processo la embaixo alcancem.
let servidor: Server | undefined;

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
  `ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "prazo" TIMESTAMP`,
  `ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "prazo_anterior" TIMESTAMP`,
  `ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "prazo_motivo" text`,
  `ALTER TABLE "solicitacoes" ADD COLUMN IF NOT EXISTS "prazo_alterado_em" TIMESTAMP`,

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
  `ALTER TABLE "cartao_aprovacoes" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP`,
  // Backfill único e idempotente: aproxima o "pendente há" dos cartões antigos
  // (só age em linhas com status_changed_at NULL; depois vira no-op barato).
  `UPDATE "cartao_aprovacoes" SET "status_changed_at" = "updated_at" WHERE "status_changed_at" IS NULL`,

  // Publicação de perfis de assessores (fila de validação do Capital Humano)
  `CREATE TABLE IF NOT EXISTS "assessor_publicacoes" (
    "id"               SERIAL PRIMARY KEY,
    "solicitacao_id"   INTEGER NOT NULL UNIQUE REFERENCES "solicitacoes" ("id") ON DELETE CASCADE,
    "nome"             VARCHAR(255),
    "codigo_assessor"  VARCHAR(40),
    "unidade"          VARCHAR(120),
    "contrato_social"  VARCHAR(60),
    "foto_url"         TEXT,
    "status"           VARCHAR(30) NOT NULL DEFAULT 'aguardando-validacao',
    "ajustes"          JSONB,
    "observacao"       TEXT,
    "dados_publicacao" JSONB,
    "editado_por_rh"   BOOLEAN NOT NULL DEFAULT FALSE,
    "decidido_por"     INTEGER,
    "decidido_em"      TIMESTAMPTZ,
    "publicado_por"    INTEGER,
    "publicado_em"     TIMESTAMPTZ,
    "ciclo"            INTEGER NOT NULL DEFAULT 1,
    "criado_em"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "atualizado_em"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "IDX_assessor_publicacoes_status" ON "assessor_publicacoes" ("status")`,

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

  // Tombamentos (geração em massa)
  `CREATE TABLE IF NOT EXISTS "tombamentos" (
    "id"                  SERIAL       PRIMARY KEY,
    "nome"                VARCHAR(255) NOT NULL,
    "marca"               VARCHAR(60)  NOT NULL,
    "status"              VARCHAR(30)  NOT NULL DEFAULT 'aberto',
    "linhas"              JSONB,
    "assinaturas_zip_url" TEXT,
    "cartoes_zip_url"     TEXT,
    "expires_at"          TIMESTAMP,
    "created_by"          VARCHAR(255),
    "created_at"          TIMESTAMP    NOT NULL DEFAULT NOW(),
    "updated_at"          TIMESTAMP    NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_tombamentos_created_at" ON "tombamentos" ("created_at" DESC)`,
  // fotos_zip_key: key do ZIP de fotos original no R2 (persistente). Antes o ZIP
  // so vivia num cache em memoria de 30 min — expirava e obrigava a re-subir.
  `ALTER TABLE "tombamentos" ADD COLUMN IF NOT EXISTS "fotos_zip_key" TEXT`,
  // descricao: observacao livre da solicitacao de tombamento (o unico campo do
  // form "Outros" que agrega para tombamento — os demais eram redundantes).
  `ALTER TABLE "tombamentos" ADD COLUMN IF NOT EXISTS "descricao" TEXT`,
  // solicitacao_id: liga o tombamento a solicitacao de MARKETING que ele gera
  // (arte, e-mail, outros materiais). Essa solicitacao dispara o ClickUp e
  // aparece em "Minhas solicitacoes". O tombamento em si segue na sua tabela.
  `ALTER TABLE "tombamentos" ADD COLUMN IF NOT EXISTS "solicitacao_id" INTEGER`,
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

  servidor = app.listen(port, () => {
    logger.info({ port }, "Server listening");
    startStuckMonitor();
    startHealthMonitor();
  });

  servidor.on('error', (err) => {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  });
}

start();

/* ── GUARDAS-DE-PROCESSO ────────────────────────────────────────────────────
   Faltavam as duas pontas do ciclo de vida do processo:

   1. Desligamento. A cada deploy o Railway manda SIGTERM e o processo morria na
      hora, cortando requisicoes em andamento. Com upload de ate 250 MB isso
      significa alguem perder minutos de envio porque voce publicou uma correcao.
      Agora o servidor para de aceitar conexoes novas, espera as abertas e so
      entao encerra o pool do banco.

   2. Erro fora de requisicao. Um `unhandledRejection` num monitor ou num
      logAtividadeBg derrubava o processo em silencio — o Railway reiniciava e o
      alerta que voces ja tem montado nao disparava.

   ATENCAO ao efeito colateral: desde o Node 15, promise rejeitada sem
   tratamento DERRUBA o processo por padrao. Ao registrar o listener abaixo, ela
   passa a ser registrada e o servidor CONTINUA de pe. E a troca certa para
   tarefa de fundo, mas significa que um bug assim nao aparece mais como queda —
   ele aparece no log e no alerta. Vale acompanhar o canal de alerta nas
   primeiras semanas. Ja o uncaughtException encerra mesmo: depois dele o estado
   do processo e incerto, e insistir e pior do que reiniciar. */

const LIMITE_DRENAGEM_MS = 25_000;
let encerrando = false;

function encerrar(codigo: number, motivo: string): void {
  if (encerrando) return;
  encerrando = true;
  marcarDesligando();
  logger.info({ motivo }, "Encerrando: parando de aceitar conexoes");

  // Teto: se alguma requisicao longa nao terminar, sai mesmo assim. O unref
  // evita que este timer sozinho segure o processo de pe.
  const forcar = setTimeout(() => {
    logger.warn({ motivo, limiteMs: LIMITE_DRENAGEM_MS }, "Encerramento forcado com requisicoes abertas");
    process.exit(codigo);
  }, LIMITE_DRENAGEM_MS);
  forcar.unref();

  const finalizar = () => {
    pool.end()
      .catch((err) => logger.warn({ err }, "Falha ao encerrar o pool do banco"))
      .finally(() => {
        clearTimeout(forcar);
        logger.info({ motivo }, "Encerrado com as requisicoes concluidas");
        process.exit(codigo);
      });
  };

  if (servidor) servidor.close(finalizar);
  else finalizar();
}

process.on("SIGTERM", () => encerrar(0, "SIGTERM"));
process.on("SIGINT", () => encerrar(0, "SIGINT"));

process.on("unhandledRejection", (motivo: unknown) => {
  logger.error({ err: motivo }, "Unhandled rejection");
  void sendAlert({
    service: "processo",
    level: "error",
    text: "Promise rejeitada sem tratamento",
    meta: { motivo: motivo instanceof Error ? motivo.message : String(motivo) },
  });
});

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  void sendAlert({
    service: "processo",
    level: "error",
    text: "Excecao nao tratada — reiniciando",
    meta: { erro: err.message },
  });
  encerrar(1, "uncaughtException");
});