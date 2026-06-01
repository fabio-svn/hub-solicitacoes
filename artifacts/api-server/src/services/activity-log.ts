import { db, eventosSolicitacaoTable } from "@workspace/db";
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

export async function logEvento(solicitacaoId: number, evento: EventoInput): Promise<void> {
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
