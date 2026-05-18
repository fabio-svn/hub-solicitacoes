import crypto from "crypto";
import express, { Router } from "express";
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

router.post(
  "/webhook/clickup",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-signature"] as string | undefined;
    const secret = process.env.CLICKUP_WEBHOOK_SECRET;

    if (!secret) {
      logger.error("CLICKUP_WEBHOOK_SECRET não configurado");
      res.status(500).json({ error: "webhook_not_configured" });
      return;
    }

    if (!signature) {
      res.status(401).json({ error: "missing_signature" });
      return;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    let signatureValid = false;
    try {
      signatureValid = crypto.timingSafeEqual(
        Buffer.from(signature, "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      signatureValid = false;
    }

    if (!signatureValid) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }

    res.sendStatus(200);

    try {
      const payload = JSON.parse((req.body as Buffer).toString("utf-8")) as {
        event?: string;
        task_id?: string;
        history_items?: Array<{
          field?: string;
          after?: { status?: string };
        }>;
      };

      const taskId = payload.task_id;
      if (!taskId) return;

      logger.info({ event: payload.event, taskId }, "ClickUp webhook recebido");

      if (payload.event !== "taskStatusUpdated") return;

      let rawStatus: string | null = null;
      if (Array.isArray(payload.history_items)) {
        for (const item of payload.history_items) {
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
  }
);

export default router;
