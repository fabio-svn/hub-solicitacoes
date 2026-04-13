import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { solicitacoesTable, arquivosTable } from "@workspace/db";
import { eq, desc, and, ilike, sql, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { createClickUpTask, getClickUpTaskStatus } from "./clickup";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post("/solicitacoes", requireAuth, upload.any(), async (req, res) => {
  try {
    const user = (req.session as any).user;
    const { tipo_solicitacao, subtipo, maturidade, ...dados } = req.body;

    let parsedDados = dados;
    if (typeof dados.dados === "string") {
      try { parsedDados = JSON.parse(dados.dados); } catch { parsedDados = dados; }
    }

    const [solicitacao] = await db.insert(solicitacoesTable).values({
      user_email: user.email,
      tipo_solicitacao,
      subtipo: subtipo || null,
      maturidade: maturidade ? parseInt(maturidade) : null,
      dados: parsedDados,
      status: "recebido",
    }).returning();

    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const url = await uploadToR2(file, solicitacao.id, file.fieldname);
          await db.insert(arquivosTable).values({
            solicitacao_id: solicitacao.id,
            campo: file.fieldname,
            url_r2: url,
            nome_original: file.originalname,
          });
        } catch (uploadErr) {
          logger.error({ err: uploadErr }, "R2 upload failed, continuing");
        }
      }
    }

    let clickupTaskId: string | null = null;
    try {
      clickupTaskId = await createClickUpTask(solicitacao, user, parsedDados);
      if (clickupTaskId) {
        await db.update(solicitacoesTable)
          .set({ clickup_task_id: clickupTaskId })
          .where(eq(solicitacoesTable.id, solicitacao.id));
      }
    } catch (clickupErr) {
      logger.error({ err: clickupErr }, "ClickUp task creation failed, continuing");
    }

    res.json({ success: true, id: solicitacao.id, clickup_task_id: clickupTaskId });
  } catch (err) {
    logger.error({ err }, "Form submission error");
    res.status(500).json({ error: "Erro ao processar solicitacao" });
  }
});

router.get("/solicitacoes", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions: any[] = [];

    if (!isAdmin) {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    if (req.query.tipo_solicitacao) {
      conditions.push(eq(solicitacoesTable.tipo_solicitacao, req.query.tipo_solicitacao as string));
    }
    if (req.query.subtipo) {
      conditions.push(eq(solicitacoesTable.subtipo, req.query.subtipo as string));
    }
    if (req.query.status) {
      conditions.push(eq(solicitacoesTable.status, req.query.status as string));
    }
    if (req.query.maturidade) {
      conditions.push(eq(solicitacoesTable.maturidade, parseInt(req.query.maturidade as string)));
    }

    if (req.query.busca) {
      const searchTerm = `%${req.query.busca}%`;
      conditions.push(sql`(${solicitacoesTable.dados}::text ILIKE ${searchTerm})`);
    }

    if (req.query.periodo) {
      const now = new Date();
      let fromDate: Date | null = null;
      switch (req.query.periodo) {
        case "hoje":
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "7dias":
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30dias":
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "mes":
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      if (fromDate) {
        conditions.push(sql`${solicitacoesTable.created_at} >= ${fromDate.toISOString()}`);
      }
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.select().from(solicitacoesTable)
      .where(whereClause)
      .orderBy(desc(solicitacoesTable.created_at))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(whereClause);

    res.json({
      data: results,
      total: Number(countResult.count),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult.count) / limit),
    });
  } catch (err) {
    logger.error({ err }, "Error listing solicitacoes");
    res.status(500).json({ error: "Erro ao listar solicitacoes" });
  }
});

router.get("/solicitacoes/stats", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const isAdmin = user.role === "admin" || user.role === "gestor";
    const baseCondition = isAdmin ? undefined : eq(solicitacoesTable.user_email, user.email);

    const activeStatuses = ["recebido", "em-analise", "em-producao", "aguardando"];
    const activeConditions = [inArray(solicitacoesTable.status, activeStatuses)];
    if (baseCondition) activeConditions.push(baseCondition);

    const [activeCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(...activeConditions));

    const completedConditions = [eq(solicitacoesTable.status, "concluido")];
    if (baseCondition) completedConditions.push(baseCondition);

    const [completedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(...completedConditions));

    const totalConditions = baseCondition ? [baseCondition] : [];
    const [totalCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(totalConditions.length > 0 ? and(...totalConditions) : undefined);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthConditions = [sql`${solicitacoesTable.created_at} >= ${startOfMonth.toISOString()}`];
    if (baseCondition) monthConditions.push(baseCondition);

    const [monthCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(...monthConditions));

    res.json({
      active: Number(activeCount.count),
      completed: Number(completedCount.count),
      total: Number(totalCount.count),
      thisMonth: Number(monthCount.count),
    });
  } catch (err) {
    logger.error({ err }, "Error getting stats");
    res.status(500).json({ error: "Erro ao obter estatisticas" });
  }
});

router.get("/solicitacoes/:id", requireAuth, async (req, res) => {
  try {
    const user = (req.session as any).user;
    const id = parseInt(req.params.id);
    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions = [eq(solicitacoesTable.id, id)];
    if (!isAdmin) {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) {
      return res.status(404).json({ error: "Solicitacao nao encontrada" });
    }

    const arquivos = await db.select().from(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));

    res.json({ ...solicitacao, arquivos });
  } catch (err) {
    logger.error({ err }, "Error getting solicitacao");
    res.status(500).json({ error: "Erro ao buscar solicitacao" });
  }
});

router.get("/solicitacoes/:id/status", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [solicitacao] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));

    if (!solicitacao) {
      return res.status(404).json({ error: "Solicitacao nao encontrada" });
    }

    if (solicitacao.clickup_task_id) {
      try {
        const clickupStatus = await getClickUpTaskStatus(solicitacao.clickup_task_id);
        if (clickupStatus && clickupStatus !== solicitacao.status) {
          await db.update(solicitacoesTable)
            .set({ status: clickupStatus, updated_at: new Date() })
            .where(eq(solicitacoesTable.id, id));
          return res.json({ status: clickupStatus, updated: true });
        }
      } catch (e) {
        logger.error({ err: e }, "ClickUp status check failed");
      }
    }

    res.json({ status: solicitacao.status, updated: false });
  } catch (err) {
    logger.error({ err }, "Error checking status");
    res.status(500).json({ error: "Erro ao verificar status" });
  }
});

export default router;
