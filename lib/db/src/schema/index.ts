import { pgTable, serial, varchar, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  role: varchar("role", { length: 20 }).default("colaborador").notNull(),
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
  status: varchar("status", { length: 30 }).default("recebido").notNull(),
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
