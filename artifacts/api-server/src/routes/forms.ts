import { Router } from "express";
import multer from "multer";
import os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, arquivosTable, activityLogTable, cartaoAprovacoesTable } from "@workspace/db";
import { eq, desc, and, ne, sql, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { createClickUpTask, getClickUpTaskStatus, type ArquivosMap } from "./clickup";
import { uploadToR2, deleteFromR2 } from "./r2";
import { gerarArteParaSolicitacao, gerarCartaoFisicoPdf } from "../services/art-generator";
import { logger } from "../lib/logger";
import { CONTRATOS_OPTS, MARCAS_OPTS, CARGOS_OPTS, SETORES_LIST, getFormSchemaList, VALID_TIPOS } from "../config/form-schemas";
import { notificarMarcoBg } from "../services/notifications";
import { logEventoBg } from "../services/activity-log";
import { eventosSolicitacaoTable } from "@workspace/db";

const router = Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 50 * 1024 * 1024, files: 10, fields: 20 } });

router.get("/form-schemas", (_req, res) => {
  const schemaList = getFormSchemaList();
  const labels = Object.fromEntries(schemaList.map(s => [s.tipo, s.label]));
  res.json({
    marcas:    MARCAS_OPTS,
    contratos: CONTRATOS_OPTS,
    cargos:    CARGOS_OPTS,
    setores:   SETORES_LIST,
    tipos:     schemaList,
    labels,
  });
});

async function logAtividade(params: {
  userEmail?: string; userName?: string;
  tipo: string; nivel?: string;
  solicitacaoId?: number; tipoSolicitacao?: string; titulo?: string;
  detalhe: string; metadata?: Record<string, unknown>;
}): Promise<void> {
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
  } catch { /* não bloquear fluxo */ }
}


const VALID_STATUSES = [
  "recebido", "em-analise", "em-producao", "aguardando",
  "em-revisao", "em-aprovacao", "concluido", "cancelado",
  "alinhamentos", "em-andamento", "cotacao-aprovacao",
  "aguardando-rh", "aguardando-pagamento", "aguardando-finalizacao",
  "em-espera", "reprovado",
];

const STATUS_APROVACAO_DEFAULT = "aguardando-validacao";

async function aplicarStatusAprovacao<T extends { id: number; tipo_solicitacao: string; status: string }>(rows: T[]): Promise<T[]> {
  const fisicos = rows.filter(r => r.tipo_solicitacao === "cartao-visita-fisico");
  if (fisicos.length === 0) return rows;
  const ids = fisicos.map(r => r.id);
  const aprovacoes = await db.select().from(cartaoAprovacoesTable).where(inArray(cartaoAprovacoesTable.solicitacao_id, ids));
  const mapa = new Map(aprovacoes.map(a => [a.solicitacao_id, a.status]));
  for (const r of fisicos) {
    r.status = mapa.get(r.id) || STATUS_APROVACAO_DEFAULT;
  }
  return rows;
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  "eventos": ["nome"],
  "artes-divulgacao": ["nome", "titulo"],
  "atualizacao-material": ["nome", "titulo"],
  "conteudo-pdf-informativo": ["nome", "titulo"],
  "conteudo-pdf-ebook": ["nome", "titulo"],
  "apresentacao-nova": ["nome", "titulo"],
  "apresentacao-atualizar": ["nome", "titulo"],
  "pagina-assessores-dados": ["nome", "nome_completo"],
  "pagina-assessores-atualizacao": ["nome"],
  "assinatura-email":      ["nome", "telefone", "email", "marca"],
  "cartao-visita-fisico":  ["nome", "nomeCartao", "whatsapp", "emailCorporativo", "unidade", "contrato_social"],
  "cartao-visita-digital": ["nome", "telefone", "email", "contrato_social"],
  "cartao-boas-vindas":    ["nome", "nome_cliente", "nome_assinatura", "contrato_social", "unidade"],
  "divulgacao-nps":        ["nome", "nome_assinatura", "cargo", "agradecimento", "modelo_arte"],
  "convite-fp":            ["nome", "codigo_assessor", "nome_assinatura", "cargo", "contrato_social"],
  "pagina-online":         ["nome", "titulo", "finalidade"],
  "outro":                 ["nome", "titulo", "finalidade", "descricao"],
  "cartao-comemorativo":   ["nome", "nome_aniversariante", "modelo_cartao", "mensagem", "assinatura", "email_destinatario"],
  "brindes":               ["nome", "titulo", "finalidade", "dataEntrega", "itens"],
  "patrocinio":            ["nome", "tituloEvento", "marcasParceiras", "dataEvento", "horario", "local", "estado", "cidade", "tipoEvento", "publico", "explicacao", "centroCusto", "valorCota", "orcamentoTotal", "expectativaRetorno"],
  "email-marketing":       ["nome", "assunto", "finalidade", "tema", "dataDisparo", "assinaturaEmail"],
  "producao-video":        ["nome", "titulo", "ideia", "formato"],
  "sessao-fotos":          ["nome", "titulo", "descricao"],
  "materiais-impressos":   ["nome", "tipoMaterial"],
};

function normalizeFormDados(
  _tipo: string,
  dados: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...dados };

  const KEY_MAP: Record<string, string> = {
    isPrivate:     "is_private_key",
    modeloCartao:  "modelo_cartao",
    modeloArte:    "modelo_arte",
    contratoSocial:"contrato_social",
    nomeCliente:   "nome_cliente",
    nomeAssinatura: "nome_assinatura",
    nomeCompleto:      "nome_completo",
    codigoAssessor:    "codigo_assessor",
    fotoPerfilDigital: "foto_perfil",
  };
  for (const [camel, snake] of Object.entries(KEY_MAP)) {
    if (camel in out) {
      if (!(snake in out)) out[snake] = out[camel];
      delete out[camel];
    }
  }

  if (out.is_private_key === "sim")       out.is_private_key = "private";
  else if (out.is_private_key === "nao")  out.is_private_key = "padrao";

  for (let i = 1; i <= 4; i++) {
    const k = "palSvn" + i;
    const v = out[k];
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      if (lower === "sim")              out[k] = "Sim";
      else if (lower === "nao" || lower === "não") out[k] = "Não";
    }
  }

  return out;
}

function validateFormDados(tipo: string, dados: Record<string, unknown>): string | null {
  const required = REQUIRED_FIELDS[tipo];
  if (!required) return null;
  for (const field of required) {
    const value = dados[field];
    if (value === undefined || value === null || (typeof value === "string" && value.trim() === "")) {
      return `Campo obrigatório ausente: ${field}`;
    }
  }
  return null;
}

const submissionCounts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || "30", 10);
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(email: string, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  const now = Date.now();
  const entry = submissionCounts.get(email);
  if (!entry || now > entry.resetAt) {
    submissionCounts.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of submissionCounts.entries()) {
    if (now > entry.resetAt) submissionCounts.delete(key);
  }
}, RATE_LIMIT_WINDOW_MS);

function parseQueryArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  return String(val).split(',').filter(Boolean);
}

function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')]+/);
  return m ? m[0].replace(/[.,;:!?)]+$/, "") : null;
}

function gerarTituloSolicitacao(tipo: string, dados: Record<string, unknown>, userName: string): string {
  const s = (v: unknown) => String(v || "").trim();
  switch (tipo) {
    case "assinatura-email":     return `[Assinatura de E-mail] ${s(dados.nome) || userName}`;
    case "cartao-visita-fisico": return `[Cartão de Visita] ${s(dados.nomeCartao) || userName}`;
    case "cartao-visita-digital":return `[Cartão Digital] ${s(dados.nome) || userName}`;
    case "cartao-boas-vindas":   return `[Cartão de Boas-vindas] ${s(dados.nome_cliente) || userName}`;
    case "cartao-comemorativo":  return `[Cartão Comemorativo] ${s(dados.nomeAniversariante) || userName}`;
    case "divulgacao-nps":       return `[Arte NPS] ${s(dados.nome_assinatura) || userName}`;
    case "convite-fp":           return `[Convite FP] ${s(dados.nome_assinatura) || userName}`;
    case "pagina-online":        return `[Página Online] ${s(dados.titulo)}`;
    case "outro":                return `[Outro] ${s(dados.titulo)}`;
    case "brindes":              return `[Brinde] ${s(dados.titulo) || userName}`;
    case "patrocinio":           return `[Patrocínio] ${s(dados.tituloEvento)}`;
    case "email-marketing":      return `[E-mail Marketing] ${s(dados.assunto)}`;
    case "producao-video":       return `[Produção de Vídeo] ${s(dados.titulo) || s(dados.tituloFotos) || userName}`;
    case "sessao-fotos":         return `[Sessão de Fotos] ${s(dados.tituloFotos) || userName}`;
    case "materiais-impressos": {
      const tipoMat = s(dados.tipoMaterial) || s(dados.tipoImpresso) || "Material";
      const label = tipoMat.charAt(0).toUpperCase() + tipoMat.slice(1);
      return `[Material Impresso] ${label}`;
    }
    default: return `[${tipo}] ${userName}`;
  }
}

router.post("/solicitacoes", requireAuth, upload.any(), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;

    if (!checkRateLimit(user.email, user.role === 'admin')) {
      res.status(429).json({ error: "Muitas solicitações. Tente novamente em 1 hora." });
      return;
    }

    const { tipo_solicitacao, subtipo, maturidade, ...dados } = req.body;

    if (!tipo_solicitacao || typeof tipo_solicitacao !== "string") {
      res.status(400).json({ error: "tipo_solicitacao é obrigatório" });
      return;
    }

    if (!VALID_TIPOS.includes(tipo_solicitacao)) {
      res.status(400).json({ error: "tipo_solicitacao inválido" });
      return;
    }

    if (maturidade !== undefined && maturidade !== null && maturidade !== "") {
      const m = parseInt(maturidade, 10);
      if (isNaN(m) || m < 1 || m > 3) {
        res.status(400).json({ error: "maturidade deve ser 1, 2 ou 3" });
        return;
      }
    }

    let parsedDados = dados;
    if (typeof dados.dados === "string") {
      try { parsedDados = JSON.parse(dados.dados); } catch { parsedDados = dados; }
    }
    parsedDados = normalizeFormDados(tipo_solicitacao, parsedDados);

    const validationError = validateFormDados(tipo_solicitacao, parsedDados);
    if (validationError) {
      res.status(400).json({ error: validationError });
      return;
    }

    const [solicitacao] = await db.insert(solicitacoesTable).values({
      user_email: user.email,
      tipo_solicitacao,
      subtipo: subtipo || null,
      maturidade: maturidade ? parseInt(maturidade, 10) : null,
      dados: parsedDados,
      status: "recebido",
    }).returning();

    const files = req.files as Express.Multer.File[];
    const arquivosMap: ArquivosMap = {};
    if (files && files.length > 0) {
      for (const file of files) {
        let uploadedUrl: string | null = null;
        try {
          uploadedUrl = await uploadToR2(file, solicitacao.id, file.fieldname);
          await db.insert(arquivosTable).values({
            solicitacao_id: solicitacao.id,
            campo: file.fieldname,
            url_r2: uploadedUrl,
            nome_original: file.originalname,
          });
          arquivosMap[file.fieldname] = uploadedUrl;
        } catch (uploadErr) {
          logger.error({ err: uploadErr }, "R2 upload failed, continuing");
          // Se o upload subiu mas o registro no banco falhou, o arquivo ficaria
          // órfão no R2 — limpa pra não gerar lixo/custo. deleteFromR2 já engole
          // o próprio erro, então não precisa de try/catch aqui.
          if (uploadedUrl) {
            await deleteFromR2(uploadedUrl);
            logger.warn({ url: uploadedUrl }, "Arquivo órfão removido do R2 após falha no insert");
          }
        }
      }
    }

    // Merge uploaded file URLs into dados so art-generator can access them by field name
    if (Object.keys(arquivosMap).length > 0) {
      parsedDados = { ...parsedDados, ...arquivosMap };
      // Re-normaliza após merge: campos como fotoPerfilDigital agora estão em parsedDados
      // e precisam receber seus aliases snake_case (ex: foto_perfil) antes do generator rodar.
      parsedDados = normalizeFormDados(tipo_solicitacao, parsedDados);
      await db.update(solicitacoesTable)
        .set({ dados: parsedDados })
        .where(eq(solicitacoesTable.id, solicitacao.id));
    }

    // Gera e persiste título imediatamente (tipos sem ClickUp nunca sobrescrevem)
    const tituloGerado = gerarTituloSolicitacao(tipo_solicitacao, parsedDados, user.name);
    await db.update(solicitacoesTable)
      .set({ titulo: tituloGerado })
      .where(eq(solicitacoesTable.id, solicitacao.id));

    let clickupTaskId: string | null = null;
    try {
      const { taskId, taskName, responsavel } = await createClickUpTask(solicitacao, user, parsedDados, arquivosMap);
      clickupTaskId = taskId;
      if (clickupTaskId) {
        await db.update(solicitacoesTable)
          .set({
            clickup_task_id: clickupTaskId,
            titulo: taskName || null,
            clickup_url: `https://app.clickup.com/t/${clickupTaskId}`,
            responsavel: responsavel || null,
          })
          .where(eq(solicitacoesTable.id, solicitacao.id));
      }
    } catch (clickupErr: any) {
      logger.error({ err: clickupErr }, "ClickUp task creation failed, continuing");
      logEventoBg(solicitacao.id, {
        tipo: "error",
        origem: "clickup",
        mensagem: "Falha ao criar task no ClickUp",
        detalhes: { message: clickupErr?.message, status: clickupErr?.status },
      });
      await logAtividade({
        userEmail: user.email, userName: user.name,
        tipo: "clickup_erro", nivel: "warn",
        solicitacaoId: solicitacao.id, tipoSolicitacao: tipo_solicitacao,
        titulo: tituloGerado,
        detalhe: `Falha ao criar task no ClickUp para solicitação #${solicitacao.id}`,
      });
    }

    gerarArteParaSolicitacao(solicitacao.id, tipo_solicitacao, parsedDados).catch(err => {
      req.log.error({ err, tipo: tipo_solicitacao }, "Erro ao gerar arte");
    });

    notificarMarcoBg(solicitacao.id, "recebida");

    logEventoBg(solicitacao.id, {
      tipo: "info",
      origem: "sistema",
      mensagem: "Solicitação criada",
      user_email: solicitacao.user_email,
      detalhes: { tipo: solicitacao.tipo_solicitacao },
    });

    await logAtividade({
      userEmail: user.email, userName: user.name,
      tipo: "solicitacao_criada", nivel: "info",
      solicitacaoId: solicitacao.id, tipoSolicitacao: tipo_solicitacao,
      titulo: tituloGerado,
      detalhe: `${user.name} criou uma nova solicitação de ${tipo_solicitacao}`,
      metadata: { clickup_task_id: clickupTaskId },
    });
    res.json({ success: true, id: solicitacao.id, clickup_task_id: clickupTaskId });
  } catch (err) {
    const user = req.session?.user;
    logger.error({
      err,
      userEmail:        user?.email,
      tipo_solicitacao: req.body?.tipo_solicitacao,
      step:             "form_submission",
    }, "Form submission error");
    res.status(500).json({ error: "Erro ao processar solicitação" });
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
      const m = parseInt(String(req.query.maturidade), 10);
      if (!isNaN(m) && m >= 1 && m <= 3) {
        conditions.push(eq(solicitacoesTable.maturidade, m));
      }
    }

    if (req.query.natureza) {
      const natureza = String(req.query.natureza);
      if (natureza === "presencial" || natureza === "online") {
        conditions.push(sql`${solicitacoesTable.dados}->>'natureza' = ${natureza}`);
      }
    }

    if (req.query.subtipo_filter) {
      const subtipoFilter = String(req.query.subtipo_filter).replace(/[^a-z0-9-]/g, "");
      if (subtipoFilter) {
        conditions.push(sql`${solicitacoesTable.tipo_solicitacao} LIKE ${subtipoFilter + "%"}`);
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

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 20));
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

    await aplicarStatusAprovacao(results);

    // erros_24h: contagem de eventos warning/error nas últimas 24h por solicitação
    let erros24hMap: Record<number, number> = {};
    if (results.length > 0) {
      const ids = results.map(r => r.id);
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const errosRows = await db
        .select({
          solicitacao_id: eventosSolicitacaoTable.solicitacao_id,
          count: sql<number>`count(*)`,
        })
        .from(eventosSolicitacaoTable)
        .where(
          and(
            inArray(eventosSolicitacaoTable.solicitacao_id, ids),
            sql`${eventosSolicitacaoTable.tipo} IN ('warning','error')`,
            sql`${eventosSolicitacaoTable.created_at} >= ${cutoff}`,
          )
        )
        .groupBy(eventosSolicitacaoTable.solicitacao_id);
      for (const row of errosRows) {
        erros24hMap[row.solicitacao_id] = Number(row.count);
      }
    }

    const dataComErros = results.map(r => ({
      ...r,
      erros_24h: erros24hMap[r.id] ?? 0,
    }));

    res.json({
      data: dataComErros,
      total: Number(countResult.count),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult.count) / limit),
    });
  } catch (err) {
    logger.error({ err }, "Error listing solicitacoes");
    res.status(500).json({ error: "Erro ao listar solicitações" });
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
    res.status(500).json({ error: "Erro ao obter estatísticas" });
  }
});

router.get("/solicitacoes/pendentes-aprovacao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const results = await db.select({ id: solicitacoesTable.id })
      .from(solicitacoesTable)
      .where(and(
        eq(solicitacoesTable.user_email, user.email),
        eq(solicitacoesTable.status, "em-aprovacao"),
      ));
    res.json({ ids: results.map(r => r.id) });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar pendentes aprovação");
    res.status(500).json({ error: "Erro" });
  }
});

router.get("/solicitacoes/:id/eventos", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const isAdmin = user.role === "admin" || user.role === "gestor";
    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (!isAdmin) conditions.push(eq(solicitacoesTable.user_email, user.email));
    const [sol] = await db.select({ id: solicitacoesTable.id }).from(solicitacoesTable).where(and(...conditions));
    if (!sol) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    const eventos = await db
      .select()
      .from(eventosSolicitacaoTable)
      .where(eq(eventosSolicitacaoTable.solicitacao_id, id))
      .orderBy(desc(eventosSolicitacaoTable.created_at))
      .limit(100);

    res.json({ data: eventos });
  } catch (err) {
    logger.error({ err }, "Erro ao listar eventos da solicitação");
    res.status(500).json({ error: "Erro ao listar eventos" });
  }
});

router.get("/solicitacoes/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (!isAdmin) {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) {
      res.status(404).json({ error: "Solicitação não encontrada" });
      return;
    }

    const arquivos = await db.select().from(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));

    const [solComStatus] = await aplicarStatusAprovacao([{ ...solicitacao }]);
    res.json({ ...solComStatus, arquivos });
  } catch (err) {
    logger.error({ err }, "Error getting solicitacao");
    res.status(500).json({ error: "Erro ao buscar solicitação" });
  }
});

router.get("/solicitacoes/:id/status", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }

    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (!isAdmin) {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));

    if (!solicitacao) {
      res.status(404).json({ error: "Solicitação não encontrada" });
      return;
    }

    if (solicitacao.tipo_solicitacao === "cartao-visita-fisico") {
      const [apr] = await db.select().from(cartaoAprovacoesTable)
        .where(eq(cartaoAprovacoesTable.solicitacao_id, solicitacao.id));
      res.json({ status: apr?.status || STATUS_APROVACAO_DEFAULT, updated: false });
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

router.post("/solicitacoes/:id/entrega", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const internalSecret = process.env.INTERNAL_API_SECRET;
    const user = req.session?.user;
    const isInternal = internalSecret && req.headers["x-internal-secret"] === internalSecret;
    const isAdmin = user?.role === "admin" || user?.role === "gestor";

    if (!isInternal && !isAdmin) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const { links } = req.body as { links: Array<{ label: string; url: string }> };
    if (!links || !Array.isArray(links) || links.length === 0) {
      res.status(400).json({ error: "links é obrigatório" }); return;
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    if (!solicitacao) { res.status(404).json({ error: "Não encontrada" }); return; }

    const TIPOS_AUTOMACAO = [
      "assinatura-email",
      "cartao-visita-digital",
      "cartao-boas-vindas",
      "divulgacao-nps",
      "convite-fp",
      "cartao-comemorativo",
    ];
    const novoStatus = TIPOS_AUTOMACAO.includes(solicitacao.tipo_solicitacao)
      ? "concluido"
      : "em-aprovacao";

    await db.update(solicitacoesTable)
      .set({ entrega_links: links, status: novoStatus, updated_at: new Date() })
      .where(eq(solicitacoesTable.id, id));

    logger.info({ id, count: links.length }, "Links de entrega salvos");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar entrega");
    res.status(500).json({ error: "Erro" });
  }
});

router.get("/solicitacoes/:id/artefato", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (user.role !== "admin" && user.role !== "gestor") {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [sol] = await db
      .select({ entrega_links: solicitacoesTable.entrega_links, status: solicitacoesTable.status })
      .from(solicitacoesTable)
      .where(and(...conditions));
    if (!sol) { res.status(404).json({ error: "Não encontrada" }); return; }

    const links = (sol.entrega_links as Array<{ label: string; url: string }> | null) || [];
    res.json({ ready: links.length > 0, links, status: sol.status });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar artefato");
    res.status(500).json({ error: "Erro" });
  }
});

router.get("/solicitacoes/:id/entrega", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (user.role !== "admin" && user.role !== "gestor") {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    const tiposSemAprovacao = ["pagina-assessores-dados", "pagina-assessores-atualizacao"];
    if (tiposSemAprovacao.includes(solicitacao.tipo_solicitacao)) {
      res.status(403).json({ error: "Aprovação não disponível para este tipo de solicitação" });
      return;
    }

    // Verificar entrega_links no banco antes de consultar ClickUp
    if (
      solicitacao.entrega_links &&
      Array.isArray(solicitacao.entrega_links) &&
      (solicitacao.entrega_links as Array<unknown>).length > 0
    ) {
      res.json({ links: solicitacao.entrega_links, status: solicitacao.status });
      return;
    }

    if (!solicitacao.clickup_task_id) { res.json({ links: [], status: solicitacao.status }); return; }

    const response = await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}`, {
      headers: { "Authorization": process.env.CLICKUP_API_TOKEN || "" },
    });
    if (!response.ok) { res.json({ links: [], status: solicitacao.status }); return; }

    const data = await response.json() as {
      custom_fields?: Array<{ id: string; value?: string }>;
      status?: { status: string };
    };

    const entregaField = data.custom_fields?.find(f => f.id === "4485ee1d-253f-4599-a66a-aa674deddf41");
    const entregaRaw = entregaField?.value || "";

    const links: Array<{ label: string; url: string }> = [];

    if (entregaRaw) {
      const lines = entregaRaw.split(/\n+/);
      let materialCount = 0;
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Case 1: markdown link [label](url)
        const mdMatch = trimmed.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
        if (mdMatch) {
          links.push({ label: mdMatch[1].trim(), url: mdMatch[2].trim() });
          return;
        }

        // Case 2: pipe separator  "Label | https://..."
        if (trimmed.includes(" | ") || trimmed.includes("|")) {
          const pipeIdx = trimmed.indexOf("|");
          const before = trimmed.substring(0, pipeIdx).trim();
          const after = trimmed.substring(pipeIdx + 1).trim();
          const url = extractUrl(after) || extractUrl(before);
          if (url) {
            const label = before.startsWith("http") ? `Material ${++materialCount}` : before;
            links.push({ label, url });
            return;
          }
        }

        // Case 3: bare URL on its own line
        if (/^https?:\/\//.test(trimmed)) {
          const url = extractUrl(trimmed);
          if (url) { links.push({ label: `Material ${++materialCount}`, url }); return; }
        }

        // Case 4: "Label: https://..." — colon separator, but label must not start with http
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx > 0 && !trimmed.startsWith("http")) {
          const possibleLabel = trimmed.substring(0, colonIdx).trim();
          const rest = trimmed.substring(colonIdx + 1).trim();
          const url = extractUrl(rest);
          if (url && possibleLabel.length < 60) {
            links.push({ label: possibleLabel, url });
            return;
          }
        }

        // Case 5: line contains a URL somewhere
        const url = extractUrl(trimmed);
        if (url) {
          const textPart = trimmed.replace(url, "").replace(/[:\-|]+$/, "").trim();
          const label = textPart && !textPart.startsWith("http") && textPart.length < 60
            ? textPart
            : `Material ${++materialCount}`;
          links.push({ label, url });
        }
      });
    }

    logger.info({ links, count: links.length }, "Parsed Entrega links");
    res.json({ links, status: solicitacao.status, taskId: solicitacao.clickup_task_id, rawLength: entregaRaw.length });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar entrega");
    res.status(500).json({ error: "Erro ao buscar links de entrega" });
  }
});

router.post("/solicitacoes/:id/alteracao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { mensagem } = req.body as { mensagem: string };
    if (!mensagem || !mensagem.trim()) {
      res.status(400).json({ error: "Mensagem obrigatória" });
      return;
    }

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id), eq(solicitacoesTable.user_email, user.email)];
    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }
    if (!solicitacao.clickup_task_id) { res.status(400).json({ error: "Task não encontrada no ClickUp" }); return; }

    const token = process.env.CLICKUP_API_TOKEN || "";

    let mentionText = "";
    try {
      const taskRes = await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}`, {
        headers: { "Authorization": token },
      });
      if (taskRes.ok) {
        const taskData = await taskRes.json() as { assignees?: Array<{ id: number; username: string }> };
        const firstAssignee = taskData.assignees?.[0];
        if (firstAssignee) {
          mentionText = `@${firstAssignee.username} `;
        }
      }
    } catch {}

    const isMultiple = /^\d+\./.test(mensagem.trim());
    const comentario = isMultiple
      ? `${mentionText}✏️ Alterações solicitadas por ${user.name}:\n\n${mensagem.trim()}`
      : `${mentionText}✏️ Alteração solicitada por ${user.name}:\n\n${mensagem.trim()}`;

    const commentRes = await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: comentario }),
    });

    if (!commentRes.ok) {
      const errText = await commentRes.text();
      logger.error({ status: commentRes.status, body: errText }, "Erro ao comentar no ClickUp");
      res.status(500).json({ error: "Erro ao enviar alteração" });
      return;
    }

    await logAtividade({
      userEmail: user.email, userName: user.name,
      tipo: "alteracao_solicitada", nivel: "info",
      solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
      titulo: solicitacao.titulo || undefined,
      detalhe: `${user.name} solicitou alteração na solicitação #${id}`,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao enviar alteração");
    res.status(500).json({ error: "Erro ao processar alteração" });
  }
});

router.post("/solicitacoes/:id/aprovacao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id), eq(solicitacoesTable.user_email, user.email)];
    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }
    if (!solicitacao.clickup_task_id) { res.status(400).json({ error: "Task não encontrada no ClickUp" }); return; }

    const token = process.env.CLICKUP_API_TOKEN || "";

    const existingComments = await fetch(
      `https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`,
      { headers: { "Authorization": token } }
    );
    if (existingComments.ok) {
      const commentsData = await existingComments.json() as { comments?: Array<{ comment_text: string }> };
      const jaAprovado = commentsData.comments?.some(c =>
        c.comment_text?.includes('Aprovado por') && c.comment_text?.includes(user.name)
      );
      if (jaAprovado) {
        res.json({ success: true, alreadyApproved: true });
        return;
      }
    }

    const comentario = `✅ Aprovado por ${user.name} em ${new Date().toLocaleDateString('pt-BR')}`;
    await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: comentario }),
    });

    logEventoBg(id, {
      tipo: "info",
      origem: "usuario",
      mensagem: "Material aprovado pelo solicitante",
      user_email: user.email,
    });
    await logAtividade({
      userEmail: user.email, userName: user.name,
      tipo: "aprovacao_registrada", nivel: "info",
      solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
      titulo: solicitacao.titulo || undefined,
      detalhe: `${user.name} aprovou a solicitação #${id}`,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao registrar aprovação");
    res.status(500).json({ error: "Erro ao registrar aprovação" });
  }
});

router.get("/admin/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias), 10) || 7));
    const now = new Date();
    const periodoAtual = new Date(now.getTime() - dias * 86400000);
    const periodoAnterior = new Date(periodoAtual.getTime() - dias * 86400000);

    const [atual] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`);

    const [anterior] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAnterior.toISOString()}`,
        sql`${solicitacoesTable.created_at} < ${periodoAtual.toISOString()}`
      ));

    const porTipo = await db.select({
      tipo: solicitacoesTable.tipo_solicitacao,
      count: sql<number>`count(*)`
    })
      .from(solicitacoesTable)
      .where(sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`)
      .groupBy(solicitacoesTable.tipo_solicitacao)
      .orderBy(desc(sql`count(*)`));

    const porStatus = await db.select({
      status: solicitacoesTable.status,
      count: sql<number>`count(*)`
    })
      .from(solicitacoesTable)
      .where(sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`)
      .groupBy(solicitacoesTable.status)
      .orderBy(desc(sql`count(*)`));

    const [avaliacoes] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`,
        sql`${solicitacoesTable.avaliacao} IS NOT NULL`
      ));

    const [mediaNotas] = await db.select({
      media: sql<number>`avg((avaliacao->>'nota')::numeric)`
    })
      .from(solicitacoesTable)
      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`,
        sql`${solicitacoesTable.avaliacao} IS NOT NULL`
      ));

    const totalAtual = Number(atual.count);
    const totalAnterior = Number(anterior.count);
    const delta = totalAnterior === 0
      ? (totalAtual > 0 ? 100 : 0)
      : Math.round(((totalAtual - totalAnterior) / totalAnterior) * 100);

    res.json({
      total: totalAtual,
      delta,
      deltaPositivo: totalAtual >= totalAnterior,
      porTipo: porTipo.map(r => ({ tipo: r.tipo, count: Number(r.count) })),
      porStatus: porStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      avaliacoes: Number(avaliacoes.count),
      mediaNotas: mediaNotas.media ? Number(mediaNotas.media).toFixed(1) : null,
      dias,
    });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar stats admin");
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});

router.get("/admin/historico", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit), 10) || 25));
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof sql>[] = [];

    if (req.query.busca) {
      const term = `%${String(req.query.busca).replace(/%/g, "\\%")}%`;
      conditions.push(sql`(
        ${solicitacoesTable.titulo} ILIKE ${term} OR
        ${solicitacoesTable.user_email} ILIKE ${term} OR
        ${solicitacoesTable.dados}::text ILIKE ${term}
      )`);
    }

    const tiposArr = parseQueryArray(req.query.tipos);
    if (tiposArr.length > 0) {
      conditions.push(inArray(solicitacoesTable.tipo_solicitacao, tiposArr));
    } else if (req.query.tipo && String(req.query.tipo) !== "") {
      conditions.push(sql`${solicitacoesTable.tipo_solicitacao} = ${String(req.query.tipo)}`);
    }

    const statusArr = parseQueryArray(req.query.statuses);
    if (statusArr.length > 0) {
      conditions.push(inArray(solicitacoesTable.status, statusArr));
    } else if (req.query.status && String(req.query.status) !== "") {
      conditions.push(sql`${solicitacoesTable.status} = ${String(req.query.status)}`);
    }

    if (req.query.solicitante) {
      const term = `%${String(req.query.solicitante).replace(/%/g, "\\%")}%`;
      conditions.push(sql`${solicitacoesTable.user_email} ILIKE ${term}`);
    }

    if (req.query.de) {
      conditions.push(sql`${solicitacoesTable.created_at} >= ${new Date(String(req.query.de)).toISOString()}`);
    }
    if (req.query.ate) {
      const ate = new Date(String(req.query.ate));
      ate.setHours(23, 59, 59, 999);
      conditions.push(sql`${solicitacoesTable.created_at} <= ${ate.toISOString()}`);
    }

    if (req.query.avaliacao === "sim") {
      conditions.push(sql`${solicitacoesTable.avaliacao} IS NOT NULL`);
    }

    if (req.query.com_clickup === "sim") {
      conditions.push(sql`${solicitacoesTable.clickup_url} IS NOT NULL`);
    }
    if (req.query.sem_clickup === "sim") {
      conditions.push(sql`${solicitacoesTable.clickup_url} IS NULL`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allowedCols: Record<string, any> = {
      created_at: solicitacoesTable.created_at,
      criado_em: solicitacoesTable.created_at,
      status: solicitacoesTable.status,
      tipo_solicitacao: solicitacoesTable.tipo_solicitacao,
      titulo: solicitacoesTable.titulo,
      user_email: solicitacoesTable.user_email,
    };
    const orderColKey = String(req.query.order || "created_at");
    const orderDirKey = String(req.query.dir || "desc");
    const col = allowedCols[orderColKey] || solicitacoesTable.created_at;
    const orderBy = orderDirKey === "asc" ? col : desc(col);

    const results = await db.select({
      id: solicitacoesTable.id,
      user_email: solicitacoesTable.user_email,
      tipo_solicitacao: solicitacoesTable.tipo_solicitacao,
      status: solicitacoesTable.status,
      titulo: solicitacoesTable.titulo,
      created_at: solicitacoesTable.created_at,
      clickup_url: solicitacoesTable.clickup_url,
      avaliacao: solicitacoesTable.avaliacao,
      dados: solicitacoesTable.dados,
    })
      .from(solicitacoesTable)
      .where(whereClause)
      .orderBy(orderBy)
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
    logger.error({ err }, "Erro ao buscar histórico admin");
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});

router.delete("/solicitacoes/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [solicitacao] = await db.select()
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.id, id));

    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    logEventoBg(id, {
      tipo: "warning",
      origem: "admin",
      mensagem: "Solicitação deletada por admin",
      user_email: user.email,
    });
    const arquivosParaDeletar = await db.select().from(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));
    await Promise.all(arquivosParaDeletar.map(a => deleteFromR2(a.url_r2)));
    await db.delete(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));
    await db.delete(solicitacoesTable).where(eq(solicitacoesTable.id, id));

    await logAtividade({
      userEmail: user.email, userName: user.name,
      tipo: "solicitacao_excluida", nivel: "warn",
      solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
      titulo: solicitacao.titulo || undefined,
      detalhe: `${user.email} excluiu a solicitação #${id} (${solicitacao.tipo_solicitacao})`,
      metadata: { titulo: solicitacao.titulo },
    });
    logger.info({ id, deletedBy: user.email }, "Solicitação excluída por admin");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao excluir solicitação");
    res.status(500).json({ error: "Erro ao excluir solicitação" });
  }
});

router.post("/solicitacoes/:id/avaliacao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { nota, comentario } = req.body as { nota: number; comentario?: string };
    const notaNum = Number(nota);
    if (!notaNum || !Number.isInteger(notaNum) || notaNum < 1 || notaNum > 10) {
      res.status(400).json({ error: "Nota deve ser um inteiro entre 1 e 10" });
      return;
    }

    const [solicitacao] = await db.select()
      .from(solicitacoesTable)
      .where(and(eq(solicitacoesTable.id, id), eq(solicitacoesTable.user_email, user.email)));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    await db.update(solicitacoesTable)
      .set({ avaliacao: { nota: notaNum, comentario: comentario?.trim() || null, data: new Date().toISOString() } })
      .where(eq(solicitacoesTable.id, id));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar avaliação");
    res.status(500).json({ error: "Erro ao salvar avaliação" });
  }
});

router.get("/solicitacoes/:id/avaliacao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [sol] = await db.select({ avaliacao: solicitacoesTable.avaliacao })
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.id, id));
    if (!sol) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json({ avaliacao: sol.avaliacao });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar avaliação");
    res.status(500).json({ error: "Erro ao buscar avaliação" });
  }
});

router.post("/solicitacoes/massa-delete", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const { ids } = req.body as { ids: number[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "IDs inválidos" }); return;
    }
    const validIds = ids.map(Number).filter(n => !isNaN(n) && n > 0);
    if (validIds.length === 0) { res.status(400).json({ error: "IDs inválidos" }); return; }

    const arquivosParaDeletar = await db.select().from(arquivosTable).where(inArray(arquivosTable.solicitacao_id, validIds));
    await Promise.all(arquivosParaDeletar.map(a => deleteFromR2(a.url_r2)));
    await db.delete(arquivosTable).where(inArray(arquivosTable.solicitacao_id, validIds));
    await db.delete(solicitacoesTable).where(inArray(solicitacoesTable.id, validIds));

    await logAtividade({
      userEmail: user.email, userName: user.name,
      tipo: "massa_excluida", nivel: "warn",
      detalhe: `${user.email} excluiu ${validIds.length} solicitações em massa`,
      metadata: { ids: validIds },
    });
    logger.info({ ids: validIds, deletedBy: user.email }, "Solicitações excluídas em massa");
    res.json({ success: true, deleted: validIds.length });
  } catch (err) {
    logger.error({ err }, "Erro ao excluir em massa");
    res.status(500).json({ error: "Erro ao excluir em massa" });
  }
});

router.get("/cartao-aprovacoes", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (role !== "capital_humano" && role !== "gestor" && role !== "admin") { res.status(403).json({ error: "Sem permissão" }); return; }
    const sols = await db.select().from(solicitacoesTable)
      .where(eq(solicitacoesTable.tipo_solicitacao, "cartao-visita-fisico"))
      .orderBy(desc(solicitacoesTable.created_at));
    const ids = sols.map(s => s.id);
    const aprovacoes = ids.length
      ? await db.select().from(cartaoAprovacoesTable).where(inArray(cartaoAprovacoesTable.solicitacao_id, ids))
      : [];
    const mapa = new Map(aprovacoes.map(a => [a.solicitacao_id, a]));
    const linhas = sols.map(s => {
      const a = mapa.get(s.id);
      const dados: any = s.dados || {};
      return {
        solicitacao_id: s.id,
        data_pedido: a?.data_pedido ?? new Date(s.created_at).toLocaleDateString("pt-BR"),
        nome: a?.nome ?? (dados.nomeCartao || ""),
        whatsapp: a?.whatsapp ?? (dados.whatsapp || ""),
        email: a?.email ?? (dados.emailCorporativo || ""),
        unidade: a?.unidade ?? (dados.unidade || ""),
        contrato_social: a?.contrato_social ?? (dados.contrato_social || ""),
        envio_para: a?.envio_para ?? "",
        custo: a?.custo ?? "",
        status: a?.status ?? "aguardando-validacao",
        observacao: a?.observacao ?? "",
        pdf_url: (Array.isArray(s.entrega_links) && (s.entrega_links as any)[0]?.url) ? (s.entrega_links as any)[0].url : "",
      };
    });
    res.json({ linhas });
  } catch (err) {
    logger.error({ err }, "Erro listando cartao-aprovacoes");
    res.status(500).json({ error: "Erro ao listar" });
  }
});

router.put("/cartao-aprovacoes/:solicitacaoId", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (role !== "capital_humano" && role !== "gestor" && role !== "admin") { res.status(403).json({ error: "Sem permissão" }); return; }
    const solicitacaoId = parseInt(req.params.solicitacaoId, 10);
    if (Number.isNaN(solicitacaoId)) { res.status(400).json({ error: "ID inválido" }); return; }
    const b = req.body || {};
    const valores = {
      data_pedido: b.data_pedido ?? null,
      nome: b.nome ?? null,
      whatsapp: b.whatsapp ?? null,
      email: b.email ?? null,
      unidade: b.unidade ?? null,
      contrato_social: b.contrato_social ?? null,
      envio_para: b.envio_para ?? null,
      custo: b.custo ?? null,
      status: b.status || "aguardando-validacao",
      observacao: b.observacao ?? null,
      updated_at: new Date(),
    };
    const [prev] = await db.select().from(cartaoAprovacoesTable)
      .where(eq(cartaoAprovacoesTable.solicitacao_id, solicitacaoId));
    const statusAnterior = prev?.status;
    await db.insert(cartaoAprovacoesTable)
      .values({ solicitacao_id: solicitacaoId, ...valores })
      .onConflictDoUpdate({ target: cartaoAprovacoesTable.solicitacao_id, set: valores });
    if (statusAnterior !== valores.status && valores.status === "envio-assessor") {
      notificarMarcoBg(solicitacaoId, "concluida");
    }
    const camposEditados: Record<string, { antes: any; depois: any }> = {};
    for (const campo of ["status", "observacao", "nome", "whatsapp", "email", "unidade", "contrato_social", "envio_para", "custo"] as const) {
      const antes = (prev as any)?.[campo] ?? null;
      const depois = (valores as any)[campo] ?? null;
      if (antes !== depois) camposEditados[campo] = { antes, depois };
    }
    if (Object.keys(camposEditados).length > 0) {
      logEventoBg(solicitacaoId, {
        tipo: "info",
        origem: "capital-humano",
        mensagem: "Validação de cartão editada",
        user_email: req.session.user!.email,
        detalhes: { campos: camposEditados },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro salvando cartao-aprovacao");
    res.status(500).json({ error: "Erro ao salvar" });
  }
});

router.post("/cartao-aprovacoes/:solicitacaoId/gerar-pdf", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (role !== "capital_humano" && role !== "gestor" && role !== "admin") { res.status(403).json({ error: "Sem permissão" }); return; }

    const solicitacaoId = parseInt(req.params.solicitacaoId, 10);
    if (!Number.isFinite(solicitacaoId)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, solicitacaoId));
    if (!sol || sol.tipo_solicitacao !== "cartao-visita-fisico") { res.status(404).json({ error: "Cartão não encontrado" }); return; }

    const b = req.body || {};
    const nome = String(b.nome ?? "").trim();
    const telefone = String(b.whatsapp ?? b.telefone ?? "").trim();
    const email = String(b.email ?? "").trim();
    if (!nome || !email) { res.status(400).json({ error: "Nome e e-mail são obrigatórios para gerar o cartão" }); return; }

    const url = await gerarCartaoFisicoPdf(solicitacaoId, { nome, telefone, email });
    res.json({ url });
  } catch (err: any) {
    logger.error({ err }, "Erro ao gerar PDF do cartão sob demanda");
    res.status(500).json({ error: err?.message || "Erro ao gerar o PDF" });
  }
});

export default router;
