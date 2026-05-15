import { pgTable, serial, varchar, text, integer, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
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

export const artTemplatesTable = pgTable("art_templates", {
  id: serial("id").primaryKey(),
  tipo: varchar("tipo", { length: 100 }).notNull().unique(),
  config: jsonb("config").notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  updated_by: integer("updated_by").references(() => usersTable.id),
});

export type ArtTemplateRow = typeof artTemplatesTable.$inferSelect;

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
