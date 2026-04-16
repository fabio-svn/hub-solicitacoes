import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { solicitacoesTable, arquivosTable } from "@workspace/db";
import { eq, desc, and, ne, sql, inArray } from "drizzle-orm";
import { requireAuth } from "../middleware/auth.middleware";
import { createClickUpTask, getClickUpTaskStatus, type ArquivosMap } from "./clickup";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 250 * 1024 * 1024 } });

const VALID_TIPOS = [
  "eventos",
  "artes-divulgacao",
  "atualizacao-material",
  "conteudo-pdf-informativo",
  "conteudo-pdf-ebook",
  "apresentacao-nova",
  "apresentacao-atualizar",
  "pagina-assessores-dados",
  "pagina-assessores-atualizacao",
];

const VALID_STATUSES = [
  "recebido", "em-analise", "em-producao", "aguardando",
  "em-revisao", "em-aprovacao", "concluido", "cancelado",
  "alinhamentos", "em-andamento", "cotacao-aprovacao",
  "aguardando-rh", "aguardando-pagamento", "aguardando-finalizacao",
  "em-espera", "reprovado",
];

const REQUIRED_FIELDS: Record<string, string[]> = {
  "eventos": ["nome"],
  "artes-divulgacao": ["nome", "titulo"],
  "atualizacao-material": ["nome", "titulo"],
  "conteudo-pdf-informativo": ["nome", "titulo"],
  "conteudo-pdf-ebook": ["nome", "titulo"],
  "apresentacao-nova": ["nome", "titulo"],
  "apresentacao-atualizar": ["nome", "titulo"],
  "pagina-assessores-dados": ["nome", "nomeCompleto"],
  "pagina-assessores-atualizacao": ["nome"],
};

function validateFormDados(tipo: string, dados: Record<string, unknown>): string | null {
  const required = REQUIRED_FIELDS[tipo];
  if (!required) return null;
  for (const field of required) {
    const value = dados[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      return `Campo obrigatorio ausente: ${field}`;
    }
  }
  return null;
}

router.post("/solicitacoes", requireAuth, upload.any(), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const { tipo_solicitacao, subtipo, maturidade, ...dados } = req.body;

    if (!tipo_solicitacao || typeof tipo_solicitacao !== "string") {
      res.status(400).json({ error: "tipo_solicitacao e obrigatorio" });
      return;
    }

    if (!VALID_TIPOS.includes(tipo_solicitacao)) {
      res.status(400).json({ error: "tipo_solicitacao invalido" });
      return;
    }

    if (maturidade !== undefined && maturidade !== null && maturidade !== "") {
      const m = parseInt(maturidade);
      if (isNaN(m) || m < 1 || m > 3) {
        res.status(400).json({ error: "maturidade deve ser 1, 2 ou 3" });
        return;
      }
    }

    let parsedDados = dados;
    if (typeof dados.dados === "string") {
      try { parsedDados = JSON.parse(dados.dados); } catch { parsedDados = dados; }
    }

    const validationError = validateFormDados(tipo_solicitacao, parsedDados);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
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
    const arquivosMap: ArquivosMap = {};
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
          arquivosMap[file.fieldname] = url;
        } catch (uploadErr) {
          logger.error({ err: uploadErr }, "R2 upload failed, continuing");
        }
      }
    }

    let clickupTaskId: string | null = null;
    try {
      clickupTaskId = await createClickUpTask(solicitacao, user, parsedDados, arquivosMap);
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
    const user = req.session.user!;
    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions: ReturnType<typeof eq>[] = [];

    if (!isAdmin) {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    if (req.query.tipo_solicitacao) {
      const tipo = String(req.query.tipo_solicitacao);
      if (tipo === "eventos") {
        conditions.push(eq(solicitacoesTable.tipo_solicitacao, "eventos"));
      } else if (tipo === "geral") {
        conditions.push(ne(solicitacoesTable.tipo_solicitacao, "eventos"));
      } else if (VALID_TIPOS.includes(tipo)) {
        conditions.push(eq(solicitacoesTable.tipo_solicitacao, tipo));
      }
    }
    if (req.query.subtipo) {
      conditions.push(eq(solicitacoesTable.subtipo, String(req.query.subtipo)));
    }
    if (req.query.status) {
      const status = String(req.query.status);
      if (VALID_STATUSES.includes(status)) {
        conditions.push(eq(solicitacoesTable.status, status));
      }
    }
    if (req.query.maturidade) {
      const m = parseInt(String(req.query.maturidade));
      if (!isNaN(m) && m >= 1 && m <= 3) {
        conditions.push(eq(solicitacoesTable.maturidade, m));
      }
    }

    if (req.query.busca) {
      const searchTerm = `%${String(req.query.busca).replace(/%/g, "\\%")}%`;
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

    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 20));
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
    const user = req.session.user!;
    const isAdmin = user.role === "admin" || user.role === "gestor";
    const baseCondition = isAdmin ? undefined : eq(solicitacoesTable.user_email, user.email);

    const activeStatuses = [
      "recebido", "em-analise", "em-producao", "aguardando",
      "em-revisao", "em-aprovacao",
      "alinhamentos", "em-andamento", "cotacao-aprovacao",
      "aguardando-rh", "aguardando-pagamento", "aguardando-finalizacao",
      "em-espera",
    ];
    const activeConditions: ReturnType<typeof eq>[] = [inArray(solicitacoesTable.status, activeStatuses)];
    if (baseCondition) activeConditions.push(baseCondition);

    const [activeCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(...activeConditions));

    const completedConditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.status, "concluido")];
    if (baseCondition) completedConditions.push(baseCondition);

    const [completedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(...completedConditions));

    const totalConditions: ReturnType<typeof eq>[] = baseCondition ? [baseCondition] : [];
    const [totalCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(totalConditions.length > 0 ? and(...totalConditions) : undefined);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthConditions: ReturnType<typeof eq>[] = [sql`${solicitacoesTable.created_at} >= ${startOfMonth.toISOString()}`];
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

router.get("/solicitacoes/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "ID invalido" });
      return;
    }

    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (!isAdmin) {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) {
      res.status(404).json({ error: "Solicitacao nao encontrada" });
      return;
    }

    const arquivos = await db.select().from(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));

    res.json({ ...solicitacao, arquivos });
  } catch (err) {
    logger.error({ err }, "Error getting solicitacao");
    res.status(500).json({ error: "Erro ao buscar solicitacao" });
  }
});

router.get("/solicitacoes/:id/status", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "ID invalido" });
      return;
    }

    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (!isAdmin) {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));

    if (!solicitacao) {
      res.status(404).json({ error: "Solicitacao nao encontrada" });
      return;
    }

    if (solicitacao.clickup_task_id) {
      try {
        const clickupStatus = await getClickUpTaskStatus(solicitacao.clickup_task_id);
        if (clickupStatus && clickupStatus !== solicitacao.status) {
          await db.update(solicitacoesTable)
            .set({ status: clickupStatus, updated_at: new Date() })
            .where(eq(solicitacoesTable.id, id));
          res.json({ status: clickupStatus, updated: true });
          return;
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
