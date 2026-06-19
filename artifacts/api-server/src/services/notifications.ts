import { db, solicitacoesTable } from "@workspace/db";
import { TIPOS_AUTOMACAO_SET } from "../config/tipos";
import { fetchWithTimeout } from "../lib/http";
import { eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { FORM_SCHEMAS } from "../config/form-schemas";
import { logEventoBg, logAtividadeBg } from "./activity-log";

const WEBHOOK_URL = process.env.N8N_NOTIFICATIONS_WEBHOOK_URL;
const HUB_URL = process.env.HUB_PUBLIC_URL || "https://hub.portalsvn.com.br";


export const TIPOS_COM_APROVACAO = new Set([
  "eventos",
  "artes-divulgacao",
  "atualizacao-material",
  "conteudo-pdf-informativo",
  "apresentacao-nova",
  "apresentacao-atualizar",
]);

export type Marco = "recebida" | "aprovacao" | "concluida" | "prazo_alterado";

export async function notificarMarco(solicitacaoId: number, marco: Marco): Promise<void> {
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
    if (marco === "aprovacao" && !TIPOS_COM_APROVACAO.has(tipo)) return;

    const sent = (sol.notifications_sent as Record<string, string>) || {};
    if (marco !== "prazo_alterado" && sent[marco]) return;

    const dados: any = sol.dados || {};
    const userName = String(dados.nome || sol.user_email?.split("@")[0] || "").trim();
    const tipoLabel = FORM_SCHEMAS[tipo]?.label || tipo;

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
      created_at: sol.created_at,
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
            || ${JSON.stringify({ [marco]: new Date().toISOString() })}::jsonb`,
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

export function notificarMarcoBg(solicitacaoId: number, marco: Marco): void {
  notificarMarco(solicitacaoId, marco).catch(err =>
    logger.error({ err, solicitacaoId, marco }, "notificarMarcoBg engoliu erro")
  );
}