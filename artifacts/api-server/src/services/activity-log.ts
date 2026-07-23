import { db, eventosSolicitacaoTable, activityLogTable } from "@workspace/db";
import { logger } from "../lib/logger";

export type TipoEvento = "info" | "warning" | "error";
export type OrigemEvento =
  | "clickup"
  | "n8n"
  | "art-generator"
  | "r2"
  | "usuario"
  | "capital-humano"
  | "admin"
  | "sistema";

export interface EventoInput {
  tipo: TipoEvento;
  origem: OrigemEvento;
  mensagem: string;
  detalhes?: Record<string, any>;
  user_email?: string;
}

/* interno */ async function logEvento(solicitacaoId: number, evento: EventoInput): Promise<void> {
  try {
    await db.insert(eventosSolicitacaoTable).values({
      solicitacao_id: solicitacaoId,
      tipo: evento.tipo,
      origem: evento.origem,
      mensagem: evento.mensagem.slice(0, 500),
      detalhes: evento.detalhes ?? null,
      user_email: evento.user_email ?? null,
    });
  } catch (err) {
    logger.error({ err, solicitacaoId, evento }, "logEvento falhou ao gravar");
  }
}

export function logEventoBg(solicitacaoId: number, evento: EventoInput): void {
  logEvento(solicitacaoId, evento).catch(() => {});
}

// ─────────────────────────────────────────────────────────────
// Log de Atividades global (activityLogTable) — alimenta admin-log.html
// ─────────────────────────────────────────────────────────────
export interface AtividadeInput {
  userEmail?: string;
  userName?: string;
  tipo: string;
  nivel?: "info" | "warn" | "error" | string;
  solicitacaoId?: number;
  tipoSolicitacao?: string;
  titulo?: string;
  detalhe: string;
  metadata?: Record<string, unknown>;
}

export async function logAtividade(params: AtividadeInput): Promise<void> {
  try {
    await db.insert(activityLogTable).values({
      user_email: params.userEmail,
      user_name: params.userName,
      tipo: params.tipo,
      nivel: (params.nivel || "info") as any,
      solicitacao_id: params.solicitacaoId,
      tipo_solicitacao: params.tipoSolicitacao,
      titulo: params.titulo,
      detalhe: params.detalhe,
      metadata: params.metadata as any,
    });
  } catch (err) {
    logger.error({ err, tipo: params.tipo }, "logAtividade falhou ao gravar");
  }
}

export function logAtividadeBg(params: AtividadeInput): void {
  logAtividade(params).catch(() => {});
}