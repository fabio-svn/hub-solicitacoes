import { db, solicitacoesTable } from "@workspace/db";
import { and, eq, gte, isNotNull, ne, notInArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getClickUpTaskSnapshot } from "../routes/clickup";
import { notificarMarco } from "./notifications";

/* RESPOSTA-MONITOR ───────────────────────────────────────────────────────────
   Dois avisos que ninguém dispara sozinho.

   1. RESPOSTA AO FEEDBACK. O time escreve no campo "Mensagem" da task e o Hub
      só descobre isso quando alguém abre a página da solicitação — o sync mora
      no GET /status, que é chamado pelo frontend. Se ninguém abrir, ninguém
      sabe. Aqui a varredura acontece de qualquer jeito.

   2. LEMBRETE DE APROVAÇÃO. Material pronto parado esperando aprovação é o
      gargalo mais caro do fluxo: o time já fez o trabalho e a entrega não anda.
      A contagem usa o timestamp do e-mail de aprovação (notifications_sent), e
      não o updated_at, que muda por qualquer motivo e zeraria a conta sozinho.

   Os dois passam pelo notificarMarco, então herdam log, dedup e o webhook do
   n8n. Nada de e-mail sendo montado em dois lugares diferentes.
──────────────────────────────────────────────────────────────────────────── */

const INTERVALO_MS = parseInt(process.env.RESPOSTA_CHECK_INTERVAL_MS || String(15 * 60 * 1000), 10);
const LEMBRETE_DIAS = parseInt(process.env.APROVACAO_LEMBRETE_DIAS || "3", 10);
// Teto por ciclo: a API do ClickUp limita 100 req/min por token, e este monitor
// divide esse orçamento com o resto do Hub.
const MAX_CONSULTAS = parseInt(process.env.RESPOSTA_MAX_CONSULTAS || "40", 10);
// Registro velho não recebe mais resposta; não gasta chamada de API com ele.
const JANELA_DIAS = parseInt(process.env.RESPOSTA_JANELA_DIAS || "90", 10);

const STATUS_FINAIS = ["concluido", "publicado", "cancelado", "reprovado", "erro", "envio-assessor"];

/* interno */ async function checarRespostasFeedback(): Promise<void> {
  const desde = new Date(Date.now() - JANELA_DIAS * 86400000);

  const abertos = await db
    .select({
      id: solicitacoesTable.id,
      dados: solicitacoesTable.dados,
      taskId: solicitacoesTable.clickup_task_id,
      sent: solicitacoesTable.notifications_sent,
    })
    .from(solicitacoesTable)
    .where(
      and(
        eq(solicitacoesTable.tipo_solicitacao, "feedback-hub"),
        notInArray(solicitacoesTable.status, STATUS_FINAIS),
        isNotNull(solicitacoesTable.clickup_task_id),
        gte(solicitacoesTable.created_at, desde),
      ),
    );

  // Quem marcou "não quero retorno" não recebe e-mail. A tela de sucesso promete
  // isso na cara da pessoa; quebrar a promessa no primeiro uso mataria o canal.
  const candidatos = abertos.filter((s) => {
    const d = (s.dados || {}) as Record<string, unknown>;
    return String(d.quer_retorno || "") === "sim";
  });

  let consultas = 0;
  for (const c of candidatos) {
    if (consultas >= MAX_CONSULTAS) {
      logger.info({ restantes: candidatos.length - consultas }, "resposta-monitor: teto de consultas do ciclo");
      break;
    }
    consultas++;

    const snap = await getClickUpTaskSnapshot(c.taskId as string);
    const mensagem = snap?.mensagem?.trim();
    if (!mensagem) continue;

    // Dedup por conteúdo: corrigir uma vírgula na resposta não dispara e-mail
    // de novo. O notificarMarco compara a marca gravada com esta.
    await notificarMarco(c.id, "respondida", { mensagem });
  }
}

/* interno */ async function checarAprovacoesPendentes(): Promise<void> {
  const pendentes = await db
    .select({
      id: solicitacoesTable.id,
      sent: solicitacoesTable.notifications_sent,
    })
    .from(solicitacoesTable)
    .where(and(eq(solicitacoesTable.status, "em-aprovacao"), ne(solicitacoesTable.tipo_solicitacao, "feedback-hub")));

  for (const p of pendentes) {
    const sent = (p.sent || {}) as Record<string, string>;
    // A referência é o e-mail de aprovação mais recente: quando o time manda uma
    // nova versão, a reaprovação reinicia a contagem naturalmente.
    const base = [sent.aprovacao, sent.reaprovacao].filter(Boolean).sort().pop();
    if (!base) continue;

    const dias = Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
    if (dias < LEMBRETE_DIAS) continue;

    await notificarMarco(p.id, "lembrete_aprovacao", { dias_parado: dias });
  }
}

/* interno */ async function checar(): Promise<void> {
  try {
    await checarRespostasFeedback();
  } catch (err) {
    logger.error({ err }, "resposta-monitor: falha ao checar respostas de feedback");
  }
  try {
    await checarAprovacoesPendentes();
  } catch (err) {
    logger.error({ err }, "resposta-monitor: falha ao checar aprovações pendentes");
  }
}

export function startRespostaMonitor(): void {
  // Espera 2 min do boot para não competir com a subida do processo.
  setTimeout(() => { checar().catch(() => {}); }, 2 * 60 * 1000);
  setInterval(() => { checar().catch(() => {}); }, INTERVALO_MS);
  logger.info({ intervalMs: INTERVALO_MS, lembreteDias: LEMBRETE_DIAS }, "resposta-monitor iniciado");
}