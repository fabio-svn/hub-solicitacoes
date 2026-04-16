import { Router } from "express";
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router = Router();

function normalizeStatusKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const CLICKUP_STATUS_MAP: Record<string, string> = {
  "to do":                      "recebido",
  "recebido":                   "recebido",
  "in progress":                "em-producao",
  "em analise":                 "em-analise",
  "em andamento":               "em-producao",
  "em producao":                "em-producao",
  "em revisao":                 "em-revisao",
  "em aprovacao":               "em-aprovacao",
  "alinhamentos":               "alinhamentos",
  "cotacao-aprovacao":          "cotacao-aprovacao",
  "cotacao aprovacao":          "cotacao-aprovacao",
  "em cotacao / aprovacao":     "cotacao-aprovacao",
  "em cotacao":                 "cotacao-aprovacao",
  "aguardando":                 "aguardando",
  "aguardando informacao":      "aguardando",
  "waiting":                    "aguardando",
  "waiting on rh":              "aguardando",
  "aguardando rh":              "aguardando-rh",
  "aguardando pagamento":       "aguardando-pagamento",
  "aguardando finalizacao":     "aguardando-finalizacao",
  "em espera":                  "em-espera",
  "complete":                   "concluido",
  "concluido":                  "concluido",
  "done":                       "concluido",
  "closed":                     "concluido",
  "cancelled":                  "cancelado",
  "canceled":                   "cancelado",
  "cancelado":                  "cancelado",
  "reprovado":                  "reprovado",
  "reprovado / cancelado":      "reprovado",
};

function mapClickUpStatus(raw: string): string | null {
  return CLICKUP_STATUS_MAP[normalizeStatusKey(raw)] || null;
}

router.post("/webhook/clickup", async (req, res) => {
  res.sendStatus(200);

  try {
    const body = req.body as {
      event?: string;
      task_id?: string;
      history_items?: Array<{
        field?: string;
        after?: { status?: string };
      }>;
    };

    const taskId = body.task_id;
    if (!taskId) return;

    logger.info({ event: body.event, taskId }, "ClickUp webhook recebido");

    if (body.event !== "taskStatusUpdated") return;

    let rawStatus: string | null = null;
    if (Array.isArray(body.history_items)) {
      for (const item of body.history_items) {
        if (item.field === "status" && item.after?.status) {
          rawStatus = item.after.status;
          break;
        }
      }
    }

    if (!rawStatus) return;

    const hubStatus = mapClickUpStatus(rawStatus);
    if (!hubStatus) {
      logger.warn({ rawStatus, taskId }, "ClickUp webhook: status sem mapeamento, ignorando");
      return;
    }

    const [solicitacao] = await db
      .select()
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.clickup_task_id, taskId));

    if (!solicitacao) {
      logger.warn({ taskId }, "ClickUp webhook: task sem solicitacao vinculada");
      return;
    }

    if (solicitacao.status === hubStatus) return;

    await db
      .update(solicitacoesTable)
      .set({ status: hubStatus, updated_at: new Date() })
      .where(eq(solicitacoesTable.clickup_task_id, taskId));

    logger.info(
      {
        taskId,
        statusAnterior: solicitacao.status,
        statusNovo: hubStatus,
        solicitacaoId: solicitacao.id,
      },
      "ClickUp webhook: status atualizado"
    );
  } catch (err) {
    logger.error({ err }, "ClickUp webhook: erro ao processar");
  }
});

export default router;
