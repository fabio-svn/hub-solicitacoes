import { db, solicitacoesTable } from "@workspace/db";
import { TIPOS_AUTOMACAO_SET } from "../config/tipos";
import { fetchWithTimeout } from "../lib/http";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { FORM_SCHEMAS, labelDoTipo } from "../config/form-schemas";
import { logEventoBg, logAtividadeBg } from "./activity-log";

const WEBHOOK_URL = process.env.N8N_NOTIFICATIONS_WEBHOOK_URL;
const HUB_URL = process.env.HUB_PUBLIC_URL || "https://hub.portalsvn.com.br";


// NOTIF-APROVACAO-EXCLUSAO: antes era uma lista de PERMISSAO que esquecia os
// tipos de Capital Humano (ch-*) — o e-mail de aprovacao nunca era enviado para
// eles. Agora e uma lista de EXCLUSAO, espelhando o backend (/entrega): todo
// tipo tem aprovacao, menos os que nao passam por aprovacao. Assim o e-mail sai
// para os CH, e tipos novos entram sozinhos.
/* interno */ const TIPOS_SEM_APROVACAO = new Set([
  "cartao-visita-fisico",
  "pagina-assessores-dados",
  "pagina-assessores-atualizacao",
]);

export type Marco =
  | "recebida"
  | "aprovacao"
  | "reaprovacao"
  | "concluida"
  | "prazo_alterado"
  | "publicada"
  // MARCOS-DE-DESTRAVAMENTO: os tres primeiros existem porque, sem eles, quem
  // pediu algo ficava sem saber que a solicitacao parou, foi encerrada ou foi
  // respondida. O lembrete existe porque material pronto esperando aprovacao e
  // o gargalo mais caro do fluxo: o trabalho ja foi feito e a entrega nao anda.
  | "aguardando_info"
  | "cancelada"
  | "respondida"
  | "lembrete_aprovacao";

/** Dados que so existem no momento do disparo (texto da resposta, dias parado). */
export type MarcoExtra = Record<string, unknown>;

/* DEDUP-POR-MARCO: o `sent[marco]` sozinho nao dava conta dos marcos novos.
   - aguardando_info pode acontecer varias vezes na vida de uma solicitacao, mas
     o status oscilando no ClickUp geraria uma fila de e-mails: janela de 24h.
   - respondida repete quando a resposta MUDA, e nao quando ela e reeditada, entao
     a marca guarda um hash do texto.
   - lembrete_aprovacao vale por ciclo: uma nova versao para aprovar (que grava
     aprovacao/reaprovacao mais recente) reabre o direito a um novo lembrete. */
const JANELA_AGUARDANDO_MS = 24 * 60 * 60 * 1000;

function hashCurto(texto: string): string {
  let h = 0;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) - h + texto.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function marcaDoMarco(marco: Marco, extra: MarcoExtra): string {
  const agora = new Date().toISOString();
  if (marco === "respondida") return `${agora}|${hashCurto(String(extra.mensagem || ""))}`;
  return agora;
}

function jaEnviado(sent: Record<string, string>, marco: Marco, extra: MarcoExtra): boolean {
  const anterior = sent[marco];

  if (marco === "prazo_alterado") return false;

  if (marco === "aguardando_info") {
    if (!anterior) return false;
    return Date.now() - new Date(anterior).getTime() < JANELA_AGUARDANDO_MS;
  }

  if (marco === "respondida") {
    if (!anterior) return false;
    const hashAnterior = anterior.split("|")[1] || "";
    return hashAnterior === hashCurto(String(extra.mensagem || ""));
  }

  if (marco === "lembrete_aprovacao") {
    if (!anterior) return false;
    const base = [sent.aprovacao, sent.reaprovacao].filter(Boolean).sort().pop();
    if (!base) return true;
    return new Date(anterior).getTime() >= new Date(base).getTime();
  }

  return Boolean(anterior);
}

export async function notificarMarco(solicitacaoId: number, marco: Marco, extra: MarcoExtra = {}): Promise<void> {
  if (!WEBHOOK_URL) {
    logger.warn({ solicitacaoId, marco }, "N8N_NOTIFICATIONS_WEBHOOK_URL ausente — pulando");
    logAtividadeBg({
      tipo: "email_falha", nivel: "error",
      solicitacaoId,
      detalhe: `E-mail "${marco}" não enviado: webhook de notificações (N8N_NOTIFICATIONS_WEBHOOK_URL) não configurado.`,
      metadata: { marco, motivo: "webhook_ausente" },
    });
    return;
  }
  try {
    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, solicitacaoId));
    if (!sol) return;

    const tipo = sol.tipo_solicitacao;
    const isAutomacao = TIPOS_AUTOMACAO_SET.has(tipo);
    const isFisico = tipo === "cartao-visita-fisico";

    if (marco === "recebida" && isAutomacao) return;
    // NOTIF-CHECK-EXCLUSAO: bloqueia so os tipos que nao passam por aprovacao.
    if ((marco === "aprovacao" || marco === "reaprovacao") && TIPOS_SEM_APROVACAO.has(tipo)) return;

    const sent = (sol.notifications_sent as Record<string, string>) || {};
    if (jaEnviado(sent, marco, extra)) return;

    const dados: any = sol.dados || {};
    const userName = String(dados.nome || sol.user_email?.split("@")[0] || "").trim();
    const tipoLabel = labelDoTipo(tipo);

    const payload = {
      marco,
      solicitacao_id: sol.id,
      tipo,
      tipo_label: tipoLabel,
      is_automacao: isAutomacao,
      is_cartao_fisico: isFisico,
      user_email: sol.user_email,
      user_name: userName,
      first_name: userName.split(" ")[0] || userName,
      status_atual: sol.status,
      prazo: sol.prazo,
      prazo_anterior: sol.prazo_anterior,
      prazo_motivo: sol.prazo_motivo,
      link: `${HUB_URL}/solicitacao.html?id=${sol.id}`,
      // primeiro link de entrega (ex.: a pagina publicada do assessor), para o
      // e-mail poder apontar direto para o resultado e nao so para o Hub
      entrega_url: (Array.isArray((sol as any).entrega_links) && (sol as any).entrega_links[0]?.url) || null,
      created_at: sol.created_at,
      // O canal de feedback fala outra lingua: "registro", nao "solicitacao".
      // O n8n usa esta flag para trocar assunto, titulo e botao do e-mail.
      is_feedback: tipo === "feedback-hub",
      quer_retorno: String(dados.quer_retorno || ""),
      unidade: String(dados.unidade || ""),
      ...extra,
    };

    const res = await fetchWithTimeout(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      logger.error({ solicitacaoId, marco, status: res.status }, "Webhook N8N falhou");
      logEventoBg(solicitacaoId, {
        tipo: "warning",
        origem: "n8n",
        mensagem: `Falha ao disparar e-mail "${marco}"`,
        detalhes: { marco, status: res.status },
      });
      logAtividadeBg({
        tipo: "email_falha", nivel: "error",
        solicitacaoId, tipoSolicitacao: tipo,
        detalhe: `Falha ao disparar e-mail "${marco}" da solicitação #${solicitacaoId} (n8n respondeu ${res.status}).`,
        metadata: { marco, n8n_status: res.status },
      });
      return;
    }

    logEventoBg(solicitacaoId, {
      tipo: "info",
      origem: "n8n",
      mensagem: `E-mail "${marco}" disparado`,
      detalhes: { marco, n8n_status: res.status, destinatario: sol.user_email },
    });

    if (marco !== "prazo_alterado") {
      await db.update(solicitacoesTable)
        .set({
          notifications_sent: sql`COALESCE(${solicitacoesTable.notifications_sent}, '{}'::jsonb)
            || ${JSON.stringify({ [marco]: marcaDoMarco(marco, extra) })}::jsonb`,
        })
        .where(eq(solicitacoesTable.id, solicitacaoId));
    }

    logger.info({ solicitacaoId, marco }, "Notificação enviada");
  } catch (err: any) {
    logger.error({ err, solicitacaoId, marco }, "Erro em notificarMarco");
    logEventoBg(solicitacaoId, {
      tipo: "warning",
      origem: "n8n",
      mensagem: `Falha ao disparar e-mail "${marco}"`,
      detalhes: { marco, err: String(err) },
    });
    logAtividadeBg({
      tipo: "email_falha", nivel: "error",
      solicitacaoId,
      detalhe: `Erro ao disparar e-mail "${marco}" da solicitação #${solicitacaoId}: ${String(err)}`,
      metadata: { marco, err: String(err) },
    });
  }
}

export function notificarMarcoBg(solicitacaoId: number, marco: Marco, extra: MarcoExtra = {}): void {
  notificarMarco(solicitacaoId, marco, extra).catch(err =>
    logger.error({ err, solicitacaoId, marco }, "notificarMarcoBg engoliu erro")
  );
}