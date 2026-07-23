import { db, solicitacoesTable, activityLogTable } from "@workspace/db";
import { and, eq, gte, lt, notInArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { logAtividade } from "./activity-log";

// Status terminais — não contam como "travado".
// "publicado" entrou depois que este monitor foi escrito: uma pagina de assessor
// no ar ha 10 dias vinha sendo logada como travada.
const STATUS_FINAIS = ["concluido", "publicado", "cancelado", "reprovado", "erro", "envio-assessor"];

// Dias (corridos) sem atualização para considerar uma solicitação parada.
const STUCK_DAYS = parseInt(process.env.STUCK_DAYS || "5", 10);
// Janela de deduplicação: não re-sinalizar a mesma solicitação dentro desse período.
const DEDUP_DAYS = parseInt(process.env.STUCK_DEDUP_DAYS || "7", 10);
// Intervalo entre verificações (default 6h).
const CHECK_INTERVAL_MS = parseInt(process.env.STUCK_CHECK_INTERVAL_MS || String(6 * 60 * 60 * 1000), 10);

/* interno */ async function checkStuckRequests(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - STUCK_DAYS * 86400000);

    const candidatos = await db
      .select({
        id: solicitacoesTable.id,
        status: solicitacoesTable.status,
        tipo: solicitacoesTable.tipo_solicitacao,
        titulo: solicitacoesTable.titulo,
        updated_at: solicitacoesTable.updated_at,
      })
      .from(solicitacoesTable)
      .where(and(notInArray(solicitacoesTable.status, STATUS_FINAIS), lt(solicitacoesTable.updated_at, cutoff)));

    if (candidatos.length === 0) return;

    // Dedup: ids já sinalizados como travados na janela recente.
    const since = new Date(Date.now() - DEDUP_DAYS * 86400000);
    const jaSinalizados = await db
      .select({ sid: activityLogTable.solicitacao_id })
      .from(activityLogTable)
      .where(and(eq(activityLogTable.tipo, "solicitacao_travada"), gte(activityLogTable.created_at, since)));
    const skip = new Set(jaSinalizados.map((r) => r.sid));

    let n = 0;
    for (const c of candidatos) {
      if (skip.has(c.id)) continue;
      const dias = Math.floor((Date.now() - new Date(c.updated_at).getTime()) / 86400000);
      await logAtividade({
        tipo: "solicitacao_travada",
        nivel: "warn",
        solicitacaoId: c.id,
        tipoSolicitacao: c.tipo,
        titulo: c.titulo || undefined,
        detalhe: `Solicitação #${c.id} parada há ${dias} dias no status "${c.status}".`,
        metadata: { dias, status: c.status },
      });
      n++;
    }
    if (n > 0) logger.info({ sinalizadas: n, candidatos: candidatos.length }, "stuck-monitor: solicitações travadas registradas");
  } catch (err) {
    logger.error({ err }, "stuck-monitor falhou");
  }
}

export function startStuckMonitor(): void {
  // primeira verificação 1 min após o boot, depois a cada CHECK_INTERVAL_MS
  setTimeout(() => { checkStuckRequests().catch(() => {}); }, 60 * 1000);
  setInterval(() => { checkStuckRequests().catch(() => {}); }, CHECK_INTERVAL_MS);
  logger.info({ stuckDays: STUCK_DAYS, intervalMs: CHECK_INTERVAL_MS }, "stuck-monitor iniciado");
}
