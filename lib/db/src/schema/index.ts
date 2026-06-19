import { pgTable, serial, varchar, text, integer, bigint, jsonb, timestamp, unique, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 }).default("colaborador").notNull(),
  telefone: varchar("telefone", { length: 30 }),
  clickup_user_id: varchar("clickup_user_id", { length: 100 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, created_at: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const solicitacoesTable = pgTable("solicitacoes", {
  id: serial("id").primaryKey(),
  user_email: varchar("user_email", { length: 255 }).notNull().references(() => usersTable.email),
  tipo_solicitacao: varchar("tipo_solicitacao", { length: 50 }).notNull(),
  subtipo: varchar("subtipo", { length: 50 }),
  maturidade: integer("maturidade"),
  dados: jsonb("dados").notNull(),
  clickup_task_id: varchar("clickup_task_id", { length: 100 }),
  titulo: text("titulo"),
  clickup_url: text("clickup_url"),
  avaliacao: jsonb("avaliacao"),
  entrega_links: jsonb("entrega_links"),
  status: varchar("status", { length: 30 }).default("recebido").notNull(),
  responsavel: text("responsavel"),
  prazo: timestamp("prazo"),
  prazo_anterior: timestamp("prazo_anterior"),
  prazo_motivo: text("prazo_motivo"),
  prazo_alterado_em: timestamp("prazo_alterado_em"),
  erro_geracao: text("erro_geracao"),
  notifications_sent: jsonb("notifications_sent").$type<Record<string, string>>().notNull().default({}),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSolicitacaoSchema = createInsertSchema(solicitacoesTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertSolicitacao = z.infer<typeof insertSolicitacaoSchema>;
export type Solicitacao = typeof solicitacoesTable.$inferSelect;

export const arquivosTable = pgTable("arquivos", {
  id: serial("id").primaryKey(),
  solicitacao_id: integer("solicitacao_id").notNull().references(() => solicitacoesTable.id),
  campo: varchar("campo", { length: 100 }),
  url_r2: text("url_r2").notNull(),
  nome_original: varchar("nome_original", { length: 255 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export const insertArquivoSchema = createInsertSchema(arquivosTable).omit({ id: true, created_at: true });
export type InsertArquivo = z.infer<typeof insertArquivoSchema>;
export type Arquivo = typeof arquivosTable.$inferSelect;

export const userTipoAssignmentsTable = pgTable("user_tipo_assignments", {
  id: serial("id").primaryKey(),
  user_id: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 50 }).notNull(),
}, (t) => [unique().on(t.user_id, t.tipo)]);

export type UserTipoAssignment = typeof userTipoAssignmentsTable.$inferSelect;

export const tipoClickupListTable = pgTable("tipo_clickup_list", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 100 }).notNull().unique(),
  list_id: varchar("list_id", { length: 50 }).notNull(),
  list_name: varchar("list_name", { length: 255 }),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
export type TipoClickupList = typeof tipoClickupListTable.$inferSelect;

export const clickupListsTable = pgTable("clickup_lists", {
  id: serial("id").primaryKey(),
  list_id: varchar("list_id", { length: 50 }).notNull().unique(),
  list_name: varchar("list_name", { length: 255 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
});
export type ClickupList = typeof clickupListsTable.$inferSelect;

export const artTemplatesTable = pgTable("art_templates", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 100 }).notNull(),
  variant_value: varchar("variant_value", { length: 100 }),
  name: varchar("name", { length: 200 }).notNull().default(""),
  config: jsonb("config").notNull(),
  is_active: boolean("is_active").notNull().default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  updated_by: integer("updated_by").references(() => usersTable.id),
});

export type ArtTemplateRow = typeof artTemplatesTable.$inferSelect;

export const artAssetsTable = pgTable("art_assets", {
  id: serial("id").primaryKey(),
  filename: varchar("filename", { length: 300 }).notNull(),
  storage_key: varchar("storage_key", { length: 500 }).notNull().unique(),
  url: varchar("url", { length: 500 }).notNull(),
  mime_type: varchar("mime_type", { length: 100 }).notNull(),
  size_bytes: bigint("size_bytes", { mode: "number" }).notNull(),
  width: integer("width"),
  height: integer("height"),
  uploaded_by: integer("uploaded_by").references(() => usersTable.id),
  uploaded_at: timestamp("uploaded_at").defaultNow().notNull(),
  used_in_template_ids: integer("used_in_template_ids").array().default([]),
  last_used_at: timestamp("last_used_at"),
});

export type ArtAssetRow = typeof artAssetsTable.$inferSelect;

export const cartaoAprovacoesTable = pgTable("cartao_aprovacoes", {
  id: serial("id").primaryKey(),
  solicitacao_id: integer("solicitacao_id").notNull().unique(),
  data_pedido: varchar("data_pedido", { length: 20 }),
  nome: varchar("nome", { length: 255 }),
  whatsapp: varchar("whatsapp", { length: 50 }),
  email: varchar("email", { length: 255 }),
  unidade: varchar("unidade", { length: 120 }),
  contrato_social: varchar("contrato_social", { length: 60 }),
  envio_para: varchar("envio_para", { length: 255 }),
  custo: varchar("custo", { length: 20 }),
  status: varchar("status", { length: 40 }).notNull().default("aguardando-validacao"),
  observacao: text("observacao"),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
});

export type CartaoAprovacao = typeof cartaoAprovacoesTable.$inferSelect;

export const eventosSolicitacaoTable = pgTable("eventos_solicitacao", {
  id: serial("id").primaryKey(),
  solicitacao_id: integer("solicitacao_id").notNull().references(() => solicitacoesTable.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 16 }).notNull().$type<"info" | "warning" | "error">(),
  origem: varchar("origem", { length: 32 }).notNull(),
  mensagem: text("mensagem").notNull(),
  detalhes: jsonb("detalhes").$type<Record<string, any> | null>(),
  user_email: varchar("user_email", { length: 255 }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EventoSolicitacao = typeof eventosSolicitacaoTable.$inferSelect;

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  user_email: text("user_email"),
  user_name: text("user_name"),
  tipo: text("tipo").notNull(),
  nivel: varchar("nivel", { length: 10 }).default("info").notNull(),
  solicitacao_id: integer("solicitacao_id"),
  tipo_solicitacao: text("tipo_solicitacao"),
  titulo: text("titulo"),
  detalhe: text("detalhe").notNull(),
  metadata: jsonb("metadata"),
});


export const tombamentosTable = pgTable("tombamentos", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  marca: varchar("marca", { length: 60 }).notNull(),
  status: varchar("status", { length: 30 }).default("aberto").notNull(),
  linhas: jsonb("linhas"),
  assinaturas_zip_url: text("assinaturas_zip_url"),
  cartoes_zip_url: text("cartoes_zip_url"),
  expires_at: timestamp("expires_at"),
  created_by: varchar("created_by", { length: 255 }),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
export type Tombamento = typeof tombamentosTable.$inferSelect;