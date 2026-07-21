import { Router } from "express";
import { TIPOS_AUTOMACAO_SET } from "../config/tipos";
import { fetchWithTimeout } from "../lib/http";
import multer from "multer";
import os from "os";
import fs from "fs";
import { db } from "@workspace/db";
import { solicitacoesTable, arquivosTable, cartaoAprovacoesTable, usersTable, activityLogTable } from "@workspace/db";
import { eq, desc, and, ne, sql, inArray, lt, notInArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { createClickUpTask, getClickUpTaskStatus, getClickUpTaskSnapshot, setClickUpTaskStatus, calcularPrazo, getPrazoDiasUteis, PRAZO_DIAS_UTEIS, APRESENTACAO_TIERS, CLICKUP_STATUS_EM_REVISAO, CLICKUP_STATUS_CONCLUIDO, notificarCartaoValidadoChat, type ArquivosMap } from "./clickup";
import { holidaysList } from "../lib/holidays";
import { normalizeFormDados } from "../lib/normalize";
import { FORM_SCHEMAS } from "../config/form-schemas";
import { uploadToR2, deleteFromR2 } from "./r2";
import { gerarArteParaSolicitacao, gerarCartaoFisicoPdf } from "../services/art-generator";
import { logger } from "../lib/logger";
import { CONTRATOS_OPTS, MARCAS_OPTS, CARGOS_OPTS, SETORES_LIST, getFormSchemaList, VALID_TIPOS } from "../config/form-schemas";
import { notificarMarcoBg } from "../services/notifications";
import { logEventoBg, logAtividade, logAtividadeBg } from "../services/activity-log";
import { eventosSolicitacaoTable, assessorPublicacoesTable } from "@workspace/db";

const router = Router();

/** Formata string de telefone para (XX) XXXXX-XXXX ou (XX) XXXX-XXXX. */
function formatarTelefone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return raw; // devolve sem alterar se não tiver dígitos suficientes
}

// Config de prazos (tabela + faixas + feriados) — fonte única para o front exibir o mesmo que o back calcula.
router.get("/prazo/config", requireAuth, (_req, res): void => {
  res.json({
    diasUteis: PRAZO_DIAS_UTEIS,
    apresentacaoTiers: APRESENTACAO_TIERS,
    especiais: {
      "cartao-visita-fisico": "proxima-quarta",
      "eventos": "data-evento",
    },
    feriados: holidaysList(),
  });
});

// Cálculo de prazo para um tipo (usado por forms/resumo, idêntico ao da criação da task).
router.get("/prazo/info", requireAuth, (req, res): void => {
  const tipo = String(req.query.tipo || "");
  const dados: Record<string, unknown> = {};
  if (req.query.tamanho) dados.tamanho = String(req.query.tamanho);
  if (req.query.dataEvento) dados.dataEvento = String(req.query.dataEvento);
  const calc = calcularPrazo(tipo, dados);
  res.json({
    tipo,
    modo: calc.modo,
    dias: calc.dias ?? null,
    regra: calc.regra,
    dataISO: calc.date ? calc.date.toISOString() : null,
  });
});

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

const STATUS_FINAIS_CANCELAMENTO = ["em-aprovacao", "entregue", "concluido", "concluida", "cancelado"];
function podeCancelar(sol: { tipo_solicitacao: string; status: string; clickup_task_id: string | null }): boolean {
  if (!sol.clickup_task_id) return false;
  if (FORM_SCHEMAS[sol.tipo_solicitacao]?.is_automation) return false;
  if (STATUS_FINAIS_CANCELAMENTO.includes(sol.status)) return false;
  return true;
}

const REQUIRED_FIELDS: Record<string, string[]> = {
  "eventos": ["nome"],
  "artes-divulgacao": ["nome", "titulo"],
  "atualizacao-material": ["nome", "titulo"],
  "conteudo-pdf-informativo": ["nome", "titulo"],
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
  "patrocinio":            ["nome", "tituloEvento", "marcasParceiras", "dataEvento", "horario", "local", "estado", "cidade", "tipoEvento", "publico", "explicacao", "centroCusto", "valorCota", "orcamentoTotal"],
  "email-marketing":       ["nome", "assunto", "finalidade", "tema", "dataDisparo", "assinaturaEmail"],
  "producao-video":        ["nome", "titulo", "ideia", "formato"],
  "sessao-fotos":          ["nome", "objetivo", "qtdParticipantes", "localSessao"],
  "materiais-impressos":   ["nome", "tipoMaterial"],
};

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
      const label = tipoMat
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
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

    // Registro de assessor sem pagina: nao ha entrega nem aprovacao. Ja nasce
    // "concluido" e sem prazo (o resumo esconde o card de prazo quando nao ha prazo).
    const ehRegistroSemPagina =
      ["pagina-assessores-dados", "pagina-assessores-atualizacao"].includes(tipo_solicitacao) &&
      String((parsedDados as any).quer_pagina || "").toLowerCase() === "nao";

    const prazoInicial = ehRegistroSemPagina ? null : calcularPrazo(tipo_solicitacao, parsedDados).date;
    const [solicitacao] = await db.insert(solicitacoesTable).values({
      user_email: user.email,
      tipo_solicitacao,
      subtipo: subtipo || null,
      maturidade: maturidade ? parseInt(maturidade, 10) : null,
      dados: parsedDados,
      status: ehRegistroSemPagina ? "concluido" : "recebido",
      prazo: prazoInicial || undefined,
    }).returning();

    const files = req.files as Express.Multer.File[];
    const arquivosMap: ArquivosMap = {};
    if (files && files.length > 0) {
      await Promise.all(files.map(async (file) => {
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
      }));
    }

    // Merge uploaded file URLs into dados so art-generator can access them by field name
    if (Object.keys(arquivosMap).length > 0) {
      parsedDados = { ...parsedDados, ...arquivosMap };
      // Re-normaliza após merge: campos como fotoPerfilDigital agora estão em parsedDados
      // e precisam receber seus aliases snake_case (ex: foto_perfil) antes do generator rodar.
      parsedDados = normalizeFormDados(tipo_solicitacao, parsedDados);
    }

    // Fase 3 — Página de Assessores: se a pessoa quer página personalizada, cria a linha
    // de aprovação para o Capital Humano validar. Sem "quer_pagina=sim", só registra.
    if (
      tipo_solicitacao === "pagina-assessores-dados" &&
      String((parsedDados as any).quer_pagina || "").toLowerCase() === "sim"
    ) {
      try {
        await db.insert(assessorPublicacoesTable).values({
          solicitacao_id: solicitacao.id,
          nome: String((parsedDados as any).nome_completo || "") || null,
          codigo_assessor: String((parsedDados as any).codigo_assessor || "") || null,
          unidade: String((parsedDados as any).unidade || "") || null,
          contrato_social: String((parsedDados as any).contrato_social || "") || null,
          foto_url: String((parsedDados as any).foto_perfil || (parsedDados as any).fotoPerfil || "") || null,
          status: "aguardando-validacao",
          dados_publicacao: parsedDados as Record<string, any>,
        }).onConflictDoNothing({ target: assessorPublicacoesTable.solicitacao_id });
      } catch (assessorErr) {
        logger.error({ err: assessorErr, solicitacaoId: solicitacao.id }, "Falha ao criar assessor_publicacoes");
      }
    }

    // Título base (tipos sem ClickUp usam este; com ClickUp, o nome da task tem prioridade).
    const tituloGerado = gerarTituloSolicitacao(tipo_solicitacao, parsedDados, user.name);

    let clickupTaskId: string | null = null;
    let tituloFinal = tituloGerado;
    let clickupUrl: string | null = null;
    let responsavelFinal: string | null = null;
    try {
      const { taskId, taskName, responsavel } = await createClickUpTask(solicitacao, user, parsedDados, arquivosMap);
      clickupTaskId = taskId;
      if (clickupTaskId) {
        tituloFinal = taskName || tituloGerado;   // nunca apaga o título se a task não tiver nome
        clickupUrl = `https://app.clickup.com/t/${clickupTaskId}`;
        responsavelFinal = responsavel || null;
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

    // Update único: dados (com URLs de arquivo), título final e campos do ClickUp num só round-trip.
    await db.update(solicitacoesTable)
      .set({
        dados: parsedDados,
        titulo: tituloFinal,
        clickup_task_id: clickupTaskId,
        clickup_url: clickupUrl,
        responsavel: responsavelFinal,
      })
      .where(eq(solicitacoesTable.id, solicitacao.id));

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

function linksParaSolicitante(sol: { tipo_solicitacao: string | null; entrega_links: unknown }): Array<{ label: string; url: string }> {
  if (sol.tipo_solicitacao === "cartao-visita-fisico") return [];
  return Array.isArray(sol.entrega_links) ? sol.entrega_links as Array<{ label: string; url: string }> : [];
}

router.get("/solicitacoes", requireAuth, async (req, res) => {
  try {
    const user = req.session.user!;
    const isAdmin = user.role === "admin" || user.role === "gestor";

    const conditions: ReturnType<typeof eq>[] = [];

    // Registros importados da planilha histórica de cartões aparecem APENAS na página de
    // Validação de Cartões — ficam ocultos da lista geral, do "minhas solicitações" e contadores.
    conditions.push(sql`(${solicitacoesTable.dados} ->> '_importado_planilha') IS NULL`);

    if (!isAdmin || req.query.escopo === 'proprias') {
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

    // avaliacao=com|sem|baixa — "baixa" e nota <= 3, o caso que interessa investigar
    if (req.query.avaliacao) {
      const av = String(req.query.avaliacao);
      if (av === "com") {
        conditions.push(sql`${solicitacoesTable.avaliacao} IS NOT NULL`);
      } else if (av === "sem") {
        conditions.push(sql`${solicitacoesTable.avaliacao} IS NULL`);
      } else if (av === "baixa") {
        conditions.push(sql`(${solicitacoesTable.avaliacao}->>'nota')::int <= 3`);
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

    // Ordenar no banco, nao no front: com paginacao, ordenar so a pagina atual
    // devolveria uma lista errada. NULLS LAST deixa quem nao avaliou no fim.
    const ordenarPor = String(req.query.ordenar || "");
    const ordem =
      ordenarPor === "nota-asc"
        ? sql`(${solicitacoesTable.avaliacao}->>'nota')::int ASC NULLS LAST`
        : ordenarPor === "nota-desc"
        ? sql`(${solicitacoesTable.avaliacao}->>'nota')::int DESC NULLS LAST`
        : desc(solicitacoesTable.created_at);

    const results = await db.select().from(solicitacoesTable)
      .where(whereClause)
      .orderBy(ordem)
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
      entrega_links: linksParaSolicitante(r),
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
    const baseCondition = (isAdmin && req.query.escopo !== 'proprias') ? undefined : eq(solicitacoesTable.user_email, user.email);
    // registros importados da planilha histórica de cartões não entram nos contadores (igual à listagem)
    const naoImportada = sql`(${solicitacoesTable.dados} ->> '_importado_planilha') IS NULL`;

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
      .where(and(naoImportada, ...activeConditions));

    const completedConditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.status, "concluido")];
    if (baseCondition) completedConditions.push(baseCondition);

    const [completedCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(naoImportada, ...completedConditions));

    const totalConditions: ReturnType<typeof eq>[] = baseCondition ? [baseCondition] : [];
    const [totalCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(naoImportada, ...totalConditions));

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthConditions: ReturnType<typeof eq>[] = [sql`${solicitacoesTable.created_at} >= ${startOfMonth.toISOString()}`];
    if (baseCondition) monthConditions.push(baseCondition);

    const [monthCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(naoImportada, ...monthConditions));

    // Mesma regra do stuck-monitor, porem ao vivo: o monitor roda a cada 6h e so
    // escreve no log de atividade, onde ninguem olha. Aqui vira numero no painel.
    const STUCK_DIAS = parseInt(process.env.STUCK_DAYS || "5", 10);
    const STATUS_FINAIS_STUCK = ["concluido", "publicado", "cancelado", "reprovado", "erro", "envio-assessor"];
    const cutoffStuck = new Date(Date.now() - STUCK_DIAS * 86400000);
    const [travadasCount] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(
        naoImportada,
        notInArray(solicitacoesTable.status, STATUS_FINAIS_STUCK),
        lt(solicitacoesTable.updated_at, cutoffStuck),
        ...(baseCondition ? [baseCondition] : []),
      ));

    res.json({
      active: Number(activeCount.count),
      completed: Number(completedCount.count),
      total: Number(totalCount.count),
      thisMonth: Number(monthCount.count),
      travadas: Number(travadasCount.count),
      travadasDias: STUCK_DIAS,
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

    // Paginas de assessor: o status que vale e o da validacao/publicacao, nao o do
    // ClickUp. Sobrescreve para o resumo do pedido nao mostrar uma etapa que nao existe.
    // Paginas de assessor: o status vem da validacao/publicacao, nao do ClickUp.
    // E quem NAO quer pagina (so registro) nao passa por aprovacao: ja e "concluido".
    if (["pagina-assessores-dados", "pagina-assessores-atualizacao"].includes(solicitacao.tipo_solicitacao)) {
      try {
        const [pubRow] = await db
          .select({ status: assessorPublicacoesTable.status })
          .from(assessorPublicacoesTable)
          .where(eq(assessorPublicacoesTable.solicitacao_id, id));
        if (pubRow) {
          (solicitacao as any).status = pubRow.status;      // fluxo de validacao/publicacao
          (solicitacao as any).querPagina = "sim";
        } else {
          (solicitacao as any).status = "concluido";         // so registro, sem aprovacao
          (solicitacao as any).querPagina = "nao";
        }
      } catch { /* em caso de erro, mantem o status atual */ }
    }

    // Nome do solicitante (a partir do cadastro de usuários, pelo e-mail)
    let solicitanteNome: string | null = null;
    if (solicitacao.user_email) {
      try {
        const [u] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.email, solicitacao.user_email));
        if (u?.name && u.name.trim()) solicitanteNome = u.name.trim();
      } catch { /* segue sem o nome */ }
    }

    const [solComStatus] = await aplicarStatusAprovacao([{ ...solicitacao }]);
    res.json({ ...solComStatus, solicitante_nome: solicitanteNome, arquivos, canCancel: podeCancelar(solComStatus) });
  } catch (err) {
    logger.error({ err }, "Error getting solicitacao");
    res.status(500).json({ error: "Erro ao buscar solicitação" });
  }
});

// Compara/exibe datas no fuso de Brasília (prazo é dia, sem hora).
function ymdBR(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function fmtBR(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
}

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

    let statusOut = solicitacao.status;
    let updated = false;
    let prazoOut: Date | null = solicitacao.prazo ? new Date(solicitacao.prazo) : null;
    let prazoAnteriorOut: Date | null = solicitacao.prazo_anterior ? new Date(solicitacao.prazo_anterior) : null;
    let prazoMotivoOut: string | null = solicitacao.prazo_motivo || null;
    let prazoAlteradoEmOut: Date | null = solicitacao.prazo_alterado_em ? new Date(solicitacao.prazo_alterado_em) : null;

    if (solicitacao.clickup_task_id) {
      try {
        const snap = await getClickUpTaskSnapshot(solicitacao.clickup_task_id);
        if (snap) {
          const patch: Record<string, unknown> = {};
          if (snap.status && snap.status !== solicitacao.status) {
            patch.status = snap.status; statusOut = snap.status; updated = true;
          }
          if (snap.dueDate) {
            const old = solicitacao.prazo ? new Date(solicitacao.prazo) : null;
            const mudou = !old || ymdBR(snap.dueDate) !== ymdBR(old);
            if (mudou && old) {
              // Alteração real do prazo (já havia um prazo): registra, sinaliza e notifica
              patch.prazo = snap.dueDate;
              patch.prazo_anterior = old;
              patch.prazo_motivo = snap.motivoPrazo || null;
              patch.prazo_alterado_em = new Date();
              prazoOut = snap.dueDate; prazoAnteriorOut = old; prazoMotivoOut = snap.motivoPrazo || null;
              prazoAlteradoEmOut = patch.prazo_alterado_em as Date;
              updated = true;
            } else if (mudou && !old) {
              // Primeira sincronização (sem prazo salvo) — apenas preenche
              patch.prazo = snap.dueDate; prazoOut = snap.dueDate;
            }
          }
          if (Object.keys(patch).length) {
            patch.updated_at = new Date();
            await db.update(solicitacoesTable).set(patch).where(eq(solicitacoesTable.id, id));
          }
          if (patch.prazo_alterado_em) {
            logAtividade({
              tipo: "prazo_alterado", nivel: "warn",
              solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
              titulo: solicitacao.titulo || undefined,
              detalhe: `Prazo alterado no ClickUp: ${fmtBR(prazoAnteriorOut)} → ${fmtBR(prazoOut)}${prazoMotivoOut ? ` · motivo: ${prazoMotivoOut}` : ""} (solicitação #${id})`,
              metadata: { de: prazoAnteriorOut, para: prazoOut, motivo: prazoMotivoOut },
            }).catch(() => {});
            notificarMarcoBg(id, "prazo_alterado");
          }
        }
      } catch (e) {
        logger.error({ err: e }, "ClickUp snapshot check failed");
      }
    }

    res.json({
      status: statusOut,
      updated,
      prazo: prazoOut ? prazoOut.toISOString() : null,
      prazo_anterior: prazoAnteriorOut ? prazoAnteriorOut.toISOString() : null,
      prazo_motivo: prazoMotivoOut,
      prazo_alterado_em: prazoAlteradoEmOut ? prazoAlteradoEmOut.toISOString() : null,
    });
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

    const novoStatus = TIPOS_AUTOMACAO_SET.has(solicitacao.tipo_solicitacao)
      ? "concluido"
      : "em-aprovacao";

    await db.update(solicitacoesTable)
      .set({ entrega_links: links, status: novoStatus, updated_at: new Date() })
      .where(eq(solicitacoesTable.id, id));

    // Dispara o e-mail na própria entrega (ponto confiável), sem depender do webhook
    // do ClickUp — que pode não sincronizar a volta para "em-revisao" e, por isso,
    // ignorar a re-aprovação. Se a demanda já passou por aprovação antes
    // (sent.aprovacao gravado), é uma re-aprovação após alteração. O dedup de
    // notificações evita e-mail duplicado caso o webhook também dispare.
    if (novoStatus === "em-aprovacao") {
      const sent = (solicitacao.notifications_sent as Record<string, string> | null) || {};
      notificarMarcoBg(id, sent.aprovacao ? "reaprovacao" : "aprovacao");
    }

    logger.info({ id, count: links.length }, "Links de entrega salvos");
    logAtividade({
      userEmail: user?.email, userName: user?.name,
      tipo: "entrega_registrada", nivel: "info",
      solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
      titulo: solicitacao.titulo || undefined,
      detalhe: `Entrega registrada na solicitação #${id} (${links.length} link${links.length === 1 ? "" : "s"}) — status: ${novoStatus}.`,
      metadata: { count: links.length, status: novoStatus, isInternal: !!isInternal },
    }).catch(() => {});
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
      .select({ entrega_links: solicitacoesTable.entrega_links, status: solicitacoesTable.status, tipo_solicitacao: solicitacoesTable.tipo_solicitacao })
      .from(solicitacoesTable)
      .where(and(...conditions));
    if (!sol) { res.status(404).json({ error: "Não encontrada" }); return; }

    const links = linksParaSolicitante(sol);
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

    if (solicitacao.tipo_solicitacao === "cartao-visita-fisico") {
      res.json({ links: [], status: solicitacao.status });
      return;
    }

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

    const response = await fetchWithTimeout(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}`, {
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

router.post("/solicitacoes/:id/alteracao", requireAuth, upload.array("arquivos", 10), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { mensagem } = req.body as { mensagem: string };
    if (!mensagem || !mensagem.trim()) {
      res.status(400).json({ error: "Mensagem obrigatória" });
      return;
    }
    const arquivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    const limparTemp = () => arquivos.forEach((f) => { try { fs.unlinkSync(f.path); } catch {} });

    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id), eq(solicitacoesTable.user_email, user.email)];
    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { limparTemp(); res.status(404).json({ error: "Solicitação não encontrada" }); return; }
    if (!solicitacao.clickup_task_id) { limparTemp(); res.status(400).json({ error: "Task não encontrada no ClickUp" }); return; }

    const token = process.env.CLICKUP_API_TOKEN || "";
    const taskId = solicitacao.clickup_task_id;

    // Assignees da task → menção REAL. A API só marca/notifica via bloco "tag" com o user id;
    // um "@username" dentro de comment_text vira texto cru e não notifica ninguém.
    let assigneeIds: number[] = [];
    try {
      const taskRes = await fetchWithTimeout(`https://api.clickup.com/api/v2/task/${taskId}`, {
        headers: { "Authorization": token },
      });
      if (taskRes.ok) {
        const taskData = await taskRes.json() as { assignees?: Array<{ id: number }> };
        assigneeIds = (taskData.assignees ?? []).map((a) => a.id).filter((x): x is number => typeof x === "number");
      }
    } catch {}

    // Anexa cada arquivo na própria task (aba Anexos) e captura a URL pública retornada
    // pela API, para colocar o link clicável dentro do próprio comentário. Best-effort:
    // loga falha sem abortar; o binário vai via multipart (a API não aceita URL "na nuvem").
    const anexados: Array<{ nome: string; url: string }> = [];
    for (const f of arquivos) {
      try {
        const fd = new FormData();
        fd.append("attachment", new Blob([fs.readFileSync(f.path)], { type: f.mimetype || "application/octet-stream" }), f.originalname);
        const attRes = await fetchWithTimeout(`https://api.clickup.com/api/v2/task/${taskId}/attachment`, {
          method: "POST",
          headers: { "Authorization": token }, // sem Content-Type: o FormData define o boundary
          body: fd,
        }, 30000);
        if (attRes.ok) {
          const att = await attRes.json().catch(() => ({})) as { url?: string; title?: string };
          anexados.push({ nome: att.title || f.originalname, url: att.url || "" });
        } else {
          logger.warn({ status: attRes.status, file: f.originalname }, "Falha ao anexar arquivo no ClickUp");
        }
      } catch (e) {
        logger.warn({ err: e, file: f.originalname }, "Erro ao anexar arquivo no ClickUp");
      } finally {
        try { fs.unlinkSync(f.path); } catch {}
      }
    }

    // Comentário em blocos ("comment") para a menção funcionar de verdade (tag + user id).
    const isMultiple = /^\d+\./.test(mensagem.trim());
    const cabecalho = isMultiple
      ? `✏️ Alterações solicitadas por ${user.name}:`
      : `✏️ Alteração solicitada por ${user.name}:`;
    const blocks: Array<Record<string, unknown>> = [];
    for (const aid of assigneeIds) {
      blocks.push({ type: "tag", user: { id: aid } });
      blocks.push({ text: " " });
    }
    blocks.push({ text: `${cabecalho}\n\n${mensagem.trim()}` });
    if (anexados.length > 0) {
      blocks.push({ text: `\n\n\ud83d\udcce Anexo${anexados.length > 1 ? "s" : ""}:` });
      for (const a of anexados) {
        blocks.push({ text: "\n" });
        // Nome do arquivo como link clicável. Se a URL não veio na resposta, cai no nome puro.
        if (a.url) blocks.push({ text: a.nome, attributes: { link: a.url } });
        else blocks.push({ text: a.nome });
      }
    }

    const commentRes = await fetchWithTimeout(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment: blocks, notify_all: true }),
    });

    if (!commentRes.ok) {
      const errText = await commentRes.text();
      logger.error({ status: commentRes.status, body: errText }, "Erro ao comentar no ClickUp");
      res.status(500).json({ error: "Erro ao enviar alteração" });
      return;
    }

    // Volta o status para "Em revisão" (ClickUp + Hub)
    const okStatusRev = await setClickUpTaskStatus(solicitacao.clickup_task_id, CLICKUP_STATUS_EM_REVISAO);
    if (!okStatusRev) {
      logAtividade({
        tipo: "clickup_status_falha", nivel: "warn",
        solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
        detalhe: `Não foi possível mudar o status no ClickUp para "${CLICKUP_STATUS_EM_REVISAO}" (solicitação #${id}).`,
        metadata: { statusAlvo: CLICKUP_STATUS_EM_REVISAO, taskId: solicitacao.clickup_task_id },
      }).catch(() => {});
    }
    await db.update(solicitacoesTable)
      .set({
        status: "em-revisao",
        updated_at: new Date(),
        // Limpa só a flag de re-aprovação para que a PRÓXIMA volta a "em-aprovacao"
        // dispare o e-mail de novo. Mantém "aprovacao" como marcador de que a demanda
        // já passou por aprovação uma vez (o webhook/entrega usa isso para escolher
        // entre o e-mail de 1ª aprovação e o de re-aprovação).
        notifications_sent: sql`COALESCE(${solicitacoesTable.notifications_sent}, '{}'::jsonb) - 'reaprovacao'`,
      })
      .where(eq(solicitacoesTable.id, id));

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

    const existingComments = await fetchWithTimeout(
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
    await fetchWithTimeout(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: comentario }),
    });

    // Conclui a solicitação (ClickUp + Hub)
    const okStatusConcl = await setClickUpTaskStatus(solicitacao.clickup_task_id, CLICKUP_STATUS_CONCLUIDO);
    if (!okStatusConcl) {
      logAtividade({
        tipo: "clickup_status_falha", nivel: "warn",
        solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
        detalhe: `Não foi possível mudar o status no ClickUp para "${CLICKUP_STATUS_CONCLUIDO}" (solicitação #${id}).`,
        metadata: { statusAlvo: CLICKUP_STATUS_CONCLUIDO, taskId: solicitacao.clickup_task_id },
      }).catch(() => {});
    }
    await db.update(solicitacoesTable)
      .set({ status: "concluido", updated_at: new Date() })
      .where(eq(solicitacoesTable.id, id));

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

router.post("/solicitacoes/:id/cancelar", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const justificativa = String(req.body?.justificativa || "").trim();
    if (justificativa.length < 3) { res.status(400).json({ error: "Informe uma justificativa para o cancelamento." }); return; }

    const isAdmin = user.role === "admin" || user.role === "gestor";
    const conditions: ReturnType<typeof eq>[] = [eq(solicitacoesTable.id, id)];
    if (!isAdmin) conditions.push(eq(solicitacoesTable.user_email, user.email));
    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    const [solComStatus] = await aplicarStatusAprovacao([{ ...solicitacao }]);
    if (!podeCancelar(solComStatus)) { res.status(409).json({ error: "Esta solicitação não pode ser cancelada." }); return; }

    const token = process.env.CLICKUP_API_TOKEN || "";
    const comentario = `\u274c Cancelamento solicitado por ${user.name} em ${new Date().toLocaleDateString('pt-BR')}:\n${justificativa}`;
    const r = await fetchWithTimeout(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: comentario }),
    });
    if (!r.ok) {
      const t = await r.text();
      logger.error({ status: r.status, body: t }, "Erro ao postar comentario de cancelamento no ClickUp");
      res.status(502).json({ error: "Não foi possível registrar o cancelamento no ClickUp." });
      return;
    }

    logEventoBg(id, {
      tipo: "warning",
      origem: "usuario",
      mensagem: `Cancelamento solicitado por ${user.name}: ${justificativa}`,
      user_email: user.email,
    });
    await logAtividade({
      userEmail: user.email, userName: user.name,
      tipo: "cancelamento_solicitado", nivel: "warning",
      solicitacaoId: id, tipoSolicitacao: solicitacao.tipo_solicitacao,
      titulo: solicitacao.titulo || undefined,
      detalhe: `${user.name} solicitou cancelamento da #${id}: ${justificativa}`,
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao registrar cancelamento");
    res.status(500).json({ error: "Erro ao registrar cancelamento" });
  }
});

router.post("/solicitacoes/bulk-delete", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const idsRaw = (req.body?.ids ?? []) as unknown[];
    const ids = Array.from(new Set(
      (Array.isArray(idsRaw) ? idsRaw : []).map(n => parseInt(String(n), 10)).filter(n => !isNaN(n))
    ));
    if (ids.length === 0) { res.status(400).json({ error: "Nenhum id válido informado" }); return; }
    if (ids.length > 200) { res.status(400).json({ error: "Máximo de 200 solicitações por vez" }); return; }

    const sols = await db.select().from(solicitacoesTable).where(inArray(solicitacoesTable.id, ids));
    if (sols.length === 0) { res.status(404).json({ error: "Nenhuma solicitação encontrada" }); return; }
    const foundIds = sols.map(s => s.id);

    const arquivosParaDeletar = await db.select().from(arquivosTable).where(inArray(arquivosTable.solicitacao_id, foundIds));
    await db.transaction(async (tx) => {
      await tx.delete(arquivosTable).where(inArray(arquivosTable.solicitacao_id, foundIds));
      await tx.delete(solicitacoesTable).where(inArray(solicitacoesTable.id, foundIds));
    });
    const r2Del = await Promise.allSettled(arquivosParaDeletar.map(a => deleteFromR2(a.url_r2)));
    r2Del.forEach((r, i) => {
      if (r.status === "rejected") logger.warn({ url: arquivosParaDeletar[i]?.url_r2, reason: r.reason }, "Falha ao deletar arquivo do R2 (bulk)");
    });

    await logAtividade({
      userEmail: user.email, userName: user.name,
      tipo: "solicitacoes_excluidas_massa", nivel: "warn",
      detalhe: `${user.email} excluiu ${foundIds.length} solicitações em massa (#${foundIds.join(", #")})`,
      metadata: { ids: foundIds, count: foundIds.length },
    });
    logger.info({ count: foundIds.length, ids: foundIds, deletedBy: user.email }, "Solicitações excluídas em massa por admin");
    res.json({ success: true, deleted: foundIds.length, ids: foundIds });
  } catch (err) {
    logger.error({ err }, "Erro ao excluir solicitações em massa");
    res.status(500).json({ error: "Erro ao excluir em massa" });
  }
});

router.delete("/solicitacoes/:id", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [solicitacao] = await db.select()
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.id, id));

    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    const arquivosParaDeletar = await db.select().from(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));
    await db.transaction(async (tx) => {
      await tx.delete(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));
      await tx.delete(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    });
    const r2Del = await Promise.allSettled(arquivosParaDeletar.map(a => deleteFromR2(a.url_r2)));
    r2Del.forEach((r, i) => {
      if (r.status === "rejected") logger.warn({ url: arquivosParaDeletar[i]?.url_r2, reason: r.reason }, "Falha ao deletar arquivo do R2");
    });

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
    if (!notaNum || !Number.isInteger(notaNum) || notaNum < 1 || notaNum > 5) {
      res.status(400).json({ error: "Nota deve ser um inteiro entre 1 e 5" });
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
        created_at: s.created_at,
        data_pedido: a?.data_pedido ?? new Date(s.created_at).toLocaleDateString("pt-BR"),
        // Lê nome/e-mail tolerando as 3 convenções de chave que coexistem no jsonb:
        // canônica (nome_cartao / email_corporativo), camel legada (nomeCartao / emailCorporativo)
        // e a chave simples usada na importação da planilha (nome / email).
        // Usa || (não ??) de propósito: assim uma aprovação com string vazia também recorre ao jsonb.
        nome: a?.nome || dados.nome_cartao || dados.nomeCartao || dados.nome || "",
        whatsapp: a?.whatsapp || dados.whatsapp || "",
        email: a?.email || dados.email_corporativo || dados.emailCorporativo || dados.email || "",
        unidade: a?.unidade ?? (dados.unidade || ""),
        contrato_social: a?.contrato_social ?? (dados.contrato_social || ""),
        envio_para: a?.envio_para ?? "",
        custo: a?.custo ?? "",
        status: a?.status ?? "aguardando-validacao",
        status_changed_at: a?.status_changed_at ?? null,
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

// ============ Página de Assessores — validação (Capital Humano) ============
const ASSESSOR_ROLES = ["capital_humano", "gestor", "admin"];
const ASSESSOR_TIPOS = ["pagina-assessores-dados", "pagina-assessores-atualizacao"];

function assessorCategoria(sol: any, dados: any): string {
  if (sol.tipo_solicitacao === "pagina-assessores-atualizacao") return "atualizacao";
  return String(dados?.quer_pagina || "").toLowerCase() === "nao" ? "sem-pagina" : "pagina";
}
function assessorLinha(sol: any, pub: any) {
  const dados: any = (pub?.dados_publicacao || sol.dados) || {};
  const categoria = assessorCategoria(sol, dados);
  const status = pub ? pub.status : (categoria === "sem-pagina" ? "registrado" : "aguardando-validacao");
  return {
    solicitacao_id: sol.id,
    categoria,
    nome: (pub?.nome) || dados.nome_completo || dados.nome || "",
    codigo_assessor: (pub?.codigo_assessor) || dados.codigo_assessor || "",
    unidade: (pub?.unidade) || dados.unidade || "",
    contrato_social: (pub?.contrato_social) || dados.contrato_social || "",
    foto_url: (pub?.foto_url) || dados.foto_perfil || dados.fotoPerfil || "",
    status,
    ciclo: pub?.ciclo || 1,
    observacao: pub?.observacao ?? "",
    criado_em: sol.created_at,
    decidido_em: pub?.decidido_em ?? null,
  };
}

router.get("/assessor-aprovacoes", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (!ASSESSOR_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }
    const sols = await db.select().from(solicitacoesTable)
      .where(inArray(solicitacoesTable.tipo_solicitacao, ASSESSOR_TIPOS))
      .orderBy(desc(solicitacoesTable.created_at));
    const ids = sols.map(s => s.id);
    const pubs = ids.length
      ? await db.select().from(assessorPublicacoesTable).where(inArray(assessorPublicacoesTable.solicitacao_id, ids))
      : [];
    const mapa = new Map(pubs.map(p => [p.solicitacao_id, p]));
    const linhas = sols.map(s => assessorLinha(s, mapa.get(s.id)));
    res.json({ linhas });
  } catch (err) {
    logger.error({ err }, "Erro listando assessor-aprovacoes");
    res.status(500).json({ error: "Erro ao listar" });
  }
});

router.get("/assessor-aprovacoes/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (!ASSESSOR_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    if (!sol || !ASSESSOR_TIPOS.includes(sol.tipo_solicitacao)) { res.status(404).json({ error: "Não encontrado" }); return; }
    const [pub] = await db.select().from(assessorPublicacoesTable).where(eq(assessorPublicacoesTable.solicitacao_id, id));
    const dados: any = (pub?.dados_publicacao || sol.dados) || {};
    res.json({ resumo: assessorLinha(sol, pub), publicacao: pub || null, dados, original: sol.dados || {} });
  } catch (err) {
    logger.error({ err }, "Erro no detalhe de assessor-aprovacao");
    res.status(500).json({ error: "Erro ao buscar" });
  }
});

// PATCH /assessor-aprovacoes/:id — admin corrige os dados do perfil (ex.: contrato
// social errado). Atualiza as COLUNAS (que os filtros leem) e o dados_publicacao.
router.patch("/assessor-aprovacoes/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "ID inválido." }); return; }

    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    if (!sol) { res.status(404).json({ error: "Solicitação não encontrada." }); return; }

    const [pub] = await db.select().from(assessorPublicacoesTable).where(eq(assessorPublicacoesTable.solicitacao_id, id));
    if (!pub) { res.status(400).json({ error: "Este registro não passa por aprovação (sem página)." }); return; }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const limpa = (v: unknown, max: number) => {
      const s = String(v ?? "").trim();
      return s ? s.slice(0, max) : null;
    };

    // so os campos que fazem sentido corrigir (e que afetam filtros)
    const nome = limpa(body.nome, 255);
    const codigo = limpa(body.codigo_assessor, 40);
    const unidade = limpa(body.unidade, 120);
    const contrato = limpa(body.contrato_social, 60);
    const foto = limpa(body.foto_url, 2000);

    // o dados_publicacao e a fonte da previa: mantem coerente com as colunas
    const dadosAtual = (pub.dados_publicacao || sol.dados || {}) as Record<string, any>;
    const dadosNovo = {
      ...dadosAtual,
      ...(nome !== null ? { nome_completo: nome, nome } : {}),
      ...(codigo !== null ? { codigo_assessor: codigo } : {}),
      ...(unidade !== null ? { unidade } : {}),
      ...(contrato !== null ? { contrato_social: contrato } : {}),
      ...(foto !== null ? { foto_url: foto, foto_perfil: foto } : {}),
    };

    await db.update(assessorPublicacoesTable).set({
      nome, codigo_assessor: codigo, unidade, contrato_social: contrato,
      ...(foto !== null ? { foto_url: foto } : {}),
      dados_publicacao: dadosNovo,
      editado_por_rh: true,
      atualizado_em: new Date(),
    }).where(eq(assessorPublicacoesTable.solicitacao_id, id));

    logger.info({ id, user: req.session?.user?.email }, "[assessor] perfil editado por admin");
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "[assessor] erro ao editar perfil");
    res.status(500).json({ error: "Não foi possível salvar as correções." });
  }
});

router.post("/assessor-aprovacoes/:id/decisao", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (!ASSESSOR_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const b = req.body || {};
    const MAP: Record<string, string> = { aprovado: "aprovado", ajustes: "ajustes-solicitados", reprovado: "reprovado", publicado: "publicado" };
    const novoStatus = MAP[String(b.decisao || "")];
    if (!novoStatus) { res.status(400).json({ error: "Decisão inválida" }); return; }
    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    if (!sol || !ASSESSOR_TIPOS.includes(sol.tipo_solicitacao)) { res.status(404).json({ error: "Não encontrado" }); return; }
    const dados: any = sol.dados || {};
    if (assessorCategoria(sol, dados) === "sem-pagina") { res.status(400).json({ error: "Registro sem página não passa por aprovação." }); return; }

    const [pub] = await db.select().from(assessorPublicacoesTable).where(eq(assessorPublicacoesTable.solicitacao_id, id));
    const ajustes = Array.isArray(b.ajustes)
      ? b.ajustes.filter((a: any) => a && a.campo).map((a: any) => ({ campo: String(a.campo), comentario: String(a.comentario || "") }))
      : null;
    const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, req.session.user!.email));
    const setFields: Record<string, unknown> = {
      status: novoStatus,
      observacao: typeof b.observacao === "string" ? b.observacao : (pub?.observacao ?? null),
      ajustes: novoStatus === "ajustes-solicitados" ? ajustes : null,
      decidido_por: u?.id ?? null,
      decidido_em: new Date(),
      atualizado_em: new Date(),
    };
    if (novoStatus === "ajustes-solicitados") setFields.ciclo = (pub?.ciclo || 1) + 1;

    // "Concluído" = publicado no site. So faz sentido depois de aprovado e nao e uma
    // decisao de validacao: nao mexe em decidido_por/decidido_em nem nos ajustes.
    if (novoStatus === "publicado") {
      // Concluir = "ja esta publicado no site". Quem publica e o marketing.
      // Capital Humano valida, mas nao conclui.
      const PUBLICA_ROLES = ["gestor", "admin"];
      if (!PUBLICA_ROLES.includes(role)) {
        res.status(403).json({ error: "Apenas o marketing pode concluir uma página." });
        return;
      }
      if (!pub || pub.status !== "aprovado") {
        res.status(400).json({ error: "Só é possível concluir um perfil que está aprovado." });
        return;
      }

      // A pagina so esta "concluida" quando esta no ar em algum endereco. Exigir a
      // URL aqui garante que o link fique registrado e possa ir no e-mail ao assessor.
      const urlPublicada = String((b as any).url_publicada || "").trim();
      if (!urlPublicada) {
        res.status(400).json({ error: "Informe o link da página publicada para concluir." });
        return;
      }
      let urlValida: string;
      try {
        const u = new URL(urlPublicada);
        if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("protocolo");
        urlValida = u.toString();
      } catch {
        res.status(400).json({ error: "O link da página precisa ser uma URL válida (começando com https://)." });
        return;
      }
      // entrega_links e o campo que o resumo ja mostra ao solicitante
      await db.update(solicitacoesTable)
        .set({ entrega_links: [{ label: "Página no site", url: urlValida }], updated_at: new Date() })
        .where(eq(solicitacoesTable.id, id));
      delete setFields.decidido_por;
      delete setFields.decidido_em;
      delete setFields.ajustes;
      setFields.observacao = pub.observacao ?? null;
      setFields.publicado_por = u?.id ?? null;
      setFields.publicado_em = new Date();
    }

    // Mantem solicitacoes.status em sincronia com a validacao, para a lista e o
    // painel (que contam pela coluna) refletirem a realidade — nao so o resumo.
    // Traduz para status genericos que a coluna ja aceita (VALID_STATUSES).
    const SYNC_STATUS_SOLICITACAO: Record<string, string> = {
      "aguardando-validacao": "aguardando-validacao",
      "ajustes-solicitados":  "em-revisao",
      "aprovado":             "em-aprovacao",
      "publicado":            "concluido",
      "reprovado":            "reprovado",
    };
    const statusSolic = SYNC_STATUS_SOLICITACAO[novoStatus];
    if (statusSolic) {
      await db.update(solicitacoesTable)
        .set({ status: statusSolic, updated_at: new Date() })
        .where(eq(solicitacoesTable.id, id));
    }

    // Unico aviso que o assessor recebe depois do "recebida": a pagina esta no ar.
    if (novoStatus === "publicado") {
      notificarMarcoBg(id, "publicada");
    }


    if (pub) {
      await db.update(assessorPublicacoesTable).set(setFields).where(eq(assessorPublicacoesTable.solicitacao_id, id));
    } else {
      const dp: any = dados;
      await db.insert(assessorPublicacoesTable).values({
        solicitacao_id: id,
        nome: String(dp.nome_completo || dp.nome || "") || null,
        codigo_assessor: String(dp.codigo_assessor || "") || null,
        unidade: String(dp.unidade || "") || null,
        contrato_social: String(dp.contrato_social || "") || null,
        foto_url: String(dp.foto_perfil || dp.fotoPerfil || "") || null,
        dados_publicacao: dp,
        ...(setFields as any),
        ciclo: (setFields.ciclo as number) || 1,
      }).onConflictDoNothing({ target: assessorPublicacoesTable.solicitacao_id });
    }
    res.json({ ok: true, status: novoStatus });
  } catch (err) {
    logger.error({ err }, "Erro na decisão de assessor");
    res.status(500).json({ error: "Erro ao registrar decisão" });
  }
});

router.put("/cartao-aprovacoes/:solicitacaoId", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (role !== "capital_humano" && role !== "gestor" && role !== "admin") { res.status(403).json({ error: "Sem permissão" }); return; }
    const solicitacaoId = parseInt(String(req.params.solicitacaoId), 10);
    if (Number.isNaN(solicitacaoId)) { res.status(400).json({ error: "ID inválido" }); return; }
    const b = req.body || {};

    // Validação básica: status precisa ser um dos válidos; campos de texto precisam ser string.
    const STATUS_VALIDOS = ["aguardando-validacao", "aguardando-contrato", "validado", "envio-grafica", "envio-assessor", "reprovado"];
    if (b.status !== undefined && !STATUS_VALIDOS.includes(b.status)) {
      res.status(400).json({ error: "Status inválido" }); return;
    }
    const CAMPOS_TEXTO = ["data_pedido", "nome", "whatsapp", "email", "unidade", "contrato_social", "envio_para", "custo", "observacao"] as const;
    for (const campo of CAMPOS_TEXTO) {
      if (b[campo] !== undefined && b[campo] !== null && typeof b[campo] !== "string") {
        res.status(400).json({ error: `Campo "${campo}" inválido` }); return;
      }
    }

    // Lê o registro atual ANTES de montar os valores, para fazer MERGE parcial:
    // só sobrescreve o que veio no body; o que não veio é preservado (evita zerar campos).
    const [prev] = await db.select().from(cartaoAprovacoesTable)
      .where(eq(cartaoAprovacoesTable.solicitacao_id, solicitacaoId));
    // Campos de identidade da pessoa nunca devem ser zerados por um "" vindo da tela
    // (a validação pode enviar input vazio de coluna secundária fora da viewport). Para
    // esses, string vazia = "não enviado": preserva o valor atual. Defesa em profundidade
    // junto com o front, que já evita mandar esses campos vazios.
    const SEM_VAZIO = new Set(["nome", "whatsapp", "email"]);
    const pick = (campo: string) => {
      const v = b[campo];
      if (SEM_VAZIO.has(campo) && typeof v === "string" && v.trim() === "") {
        return (prev as any)?.[campo] ?? null;
      }
      return v !== undefined ? v : ((prev as any)?.[campo] ?? null);
    };

    const statusAnterior = prev?.status;
    const novoStatus = b.status !== undefined ? b.status : (prev?.status ?? "aguardando-validacao");
    const statusMudou = statusAnterior !== novoStatus;

    const valores = {
      data_pedido: pick("data_pedido"),
      nome: pick("nome"),
      whatsapp: pick("whatsapp"),
      email: pick("email"),
      unidade: pick("unidade"),
      contrato_social: pick("contrato_social"),
      envio_para: pick("envio_para"),
      custo: pick("custo"),
      status: novoStatus,
      observacao: pick("observacao"),
      updated_at: new Date(),
      // marca quando a etapa mudou — "pendente há" passa a contar o tempo na etapa atual
      status_changed_at: statusMudou ? new Date() : ((prev as any)?.status_changed_at ?? null),
    };
    await db.insert(cartaoAprovacoesTable)
      .values({ solicitacao_id: solicitacaoId, ...valores })
      .onConflictDoUpdate({ target: cartaoAprovacoesTable.solicitacao_id, set: valores });

    // Geração automática do arquivo do cartão ao validar — dispara por qualquer caminho que
    // mude o status (edição na linha, "avançar etapa" ou lote). Fire-and-forget: não trava a
    // resposta e não reverte o status se falhar; o link é gravado em entrega_links e passa a
    // aparecer no pdf_url do próximo GET. Só roda na transição (não regenera se já era validado).
    if (statusAnterior !== valores.status && valores.status === "validado") {
      // Resolve nome/e-mail/whatsapp com a MESMA prioridade do GET, incluindo o jsonb da
      // solicitação: aprovação → forma canônica → camel legada → chave de importação.
      // Sem isso, validar por um caminho que muda só o status (ex.: select no card mobile,
      // "avançar etapa") não acharia os dados de cartões importados/ainda não editados,
      // e o PDF sairia em branco ou não seria gerado.
      const [solCartao] = await db.select().from(solicitacoesTable)
        .where(eq(solicitacoesTable.id, solicitacaoId));
      const d: any = solCartao?.dados || {};
      const nomeGerar = String(valores.nome ?? "").trim()
        || String(d.nome_cartao || d.nomeCartao || d.nome || "").trim();
      const emailGerar = String(valores.email ?? "").trim()
        || String(d.email_corporativo || d.emailCorporativo || d.email || "").trim();
      const whatsGerar = String(valores.whatsapp ?? "").trim()
        || String(d.whatsapp || "").trim();
      if (nomeGerar && emailGerar) {
        const unidadeGerar = String(valores.unidade ?? "").trim() || String(d.unidade || "").trim();
        const solicitanteEmail = solCartao?.user_email ?? "";
        gerarCartaoFisicoPdf(solicitacaoId, {
          nome: nomeGerar,
          telefone: formatarTelefone(whatsGerar),
          email: emailGerar,
        })
          .then((url) => {
            logger.info({ solicitacaoId }, "[cartao] PDF gerado automaticamente ao validar");
            // Avisa o time no ClickUp Chat que o cartão foi validado e já saiu o arquivo.
            // No-op silencioso se as envs de chat não estiverem configuradas; nunca trava a validação.
            notificarCartaoValidadoChat({
              nome: nomeGerar,
              email: emailGerar,
              unidade: unidadeGerar || undefined,
              solicitante: solicitanteEmail || undefined,
              pdfUrl: typeof url === "string" ? url : undefined,
            }).catch(() => {});
          })
          .catch((genErr) =>
            logger.error({ genErr, solicitacaoId }, "[cartao] Falha ao gerar PDF automático ao validar (status mantido)"),
          );
      } else {
        logger.warn({ solicitacaoId }, "[cartao] Validado sem nome/e-mail — PDF automático não gerado");
      }
    }

    if (statusAnterior !== valores.status && valores.status === "envio-assessor") {
      notificarMarcoBg(solicitacaoId, "concluida");
    }

    if (statusAnterior !== valores.status) {
      try {
        const [solCk] = await db.select({ clickup_task_id: solicitacoesTable.clickup_task_id })
          .from(solicitacoesTable).where(eq(solicitacoesTable.id, solicitacaoId));
        const taskId = solCk?.clickup_task_id;
        if (taskId) {
          const STATUS_LABELS_CARTAO: Record<string, string> = {
            "aguardando-validacao": "Aguardando validação",
            "aguardando-contrato": "Aguardando contrato",
            "validado": "Validado",
            "envio-grafica": "Envio gráfica",
            "envio-assessor": "Envio assessor",
            "reprovado": "Reprovado",
          };
          const de = STATUS_LABELS_CARTAO[statusAnterior || ""] || statusAnterior || "—";
          const para = STATUS_LABELS_CARTAO[valores.status] || valores.status;
          const quem = req.session.user!.name || req.session.user!.email || "Validação";
          const token = process.env.CLICKUP_API_TOKEN || "";
          await fetchWithTimeout(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
            method: "POST",
            headers: { "Authorization": token, "Content-Type": "application/json" },
            body: JSON.stringify({ comment_text: `🔄 Status atualizado: ${de} → ${para} (por ${quem})` }),
          });
        }
      } catch (e) {
        logger.warn({ e, solicitacaoId }, "Falha ao comentar mudança de status no ClickUp");
        logAtividadeBg({
          tipo: "clickup_status_falha", nivel: "warn",
          solicitacaoId, tipoSolicitacao: "cartao-visita-fisico",
          detalhe: `Falha ao comentar a mudança de status no ClickUp (cartão #${solicitacaoId}).`,
          metadata: { err: String(e) },
        });
      }
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
      const quem = req.session.user!.name || req.session.user!.email;
      const resumo = Object.entries(camposEditados)
        .map(([c, v]) => `${c}: "${v.antes ?? "—"}" → "${v.depois ?? "—"}"`)
        .join("; ");
      logAtividadeBg({
        userEmail: req.session.user!.email, userName: req.session.user!.name,
        tipo: "cartao_validacao_editada",
        nivel: camposEditados.status ? "warn" : "info",
        solicitacaoId, tipoSolicitacao: "cartao-visita-fisico",
        detalhe: `${quem} editou a validação do cartão #${solicitacaoId} — ${resumo}`,
        metadata: { campos: camposEditados },
      });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro salvando cartao-aprovacao");
    res.status(500).json({ error: "Erro ao salvar" });
  }
});

router.delete("/cartao-aprovacoes/:solicitacaoId", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (role !== "admin") { res.status(403).json({ error: "Apenas administradores podem excluir" }); return; }

    const solicitacaoId = parseInt(String(req.params.solicitacaoId), 10);
    if (!Number.isFinite(solicitacaoId)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, solicitacaoId));
    if (!sol || sol.tipo_solicitacao !== "cartao-visita-fisico") { res.status(404).json({ error: "Cartão não encontrado" }); return; }

    const url = (Array.isArray(sol.entrega_links) && (sol.entrega_links as any)[0]?.url) ? (sol.entrega_links as any)[0].url : null;

    await db.transaction(async (tx) => {
      await tx.delete(cartaoAprovacoesTable).where(eq(cartaoAprovacoesTable.solicitacao_id, solicitacaoId));
      await tx.delete(arquivosTable).where(eq(arquivosTable.solicitacao_id, solicitacaoId));
      await tx.delete(activityLogTable).where(eq(activityLogTable.solicitacao_id, solicitacaoId));
      await tx.delete(solicitacoesTable).where(eq(solicitacoesTable.id, solicitacaoId));
    });

    if (url) { await deleteFromR2(url).catch(() => {}); }

    logger.info({ solicitacaoId }, "[cartao] solicitação excluída permanentemente (admin)");
    res.json({ ok: true });
  } catch (err: any) {
    logger.error({ err }, "Erro ao excluir cartão");
    res.status(500).json({ error: "Erro ao excluir" });
  }
});

router.post("/cartao-aprovacoes/:solicitacaoId/gerar-pdf", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (role !== "capital_humano" && role !== "gestor" && role !== "admin") { res.status(403).json({ error: "Sem permissão" }); return; }

    const solicitacaoId = parseInt(String(req.params.solicitacaoId), 10);
    if (!Number.isFinite(solicitacaoId)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, solicitacaoId));
    if (!sol || sol.tipo_solicitacao !== "cartao-visita-fisico") { res.status(404).json({ error: "Cartão não encontrado" }); return; }

    const b = req.body || {};
    const d: any = sol.dados || {};
    // Prioriza o que a tela enviou; se vier vazio, recorre ao jsonb (canônica → camel → import),
    // espelhando a leitura do GET e da geração automática.
    const nome = String(b.nome ?? "").trim()
      || String(d.nome_cartao || d.nomeCartao || d.nome || "").trim();
    const telefoneRaw = String(b.whatsapp ?? b.telefone ?? "").trim()
      || String(d.whatsapp || "").trim();
    const telefone = formatarTelefone(telefoneRaw);
    const email = String(b.email ?? "").trim()
      || String(d.email_corporativo || d.emailCorporativo || d.email || "").trim();
    if (!nome || !email) { res.status(400).json({ error: "Nome e e-mail são obrigatórios para gerar o cartão" }); return; }

    const url = await gerarCartaoFisicoPdf(solicitacaoId, { nome, telefone, email });
    res.json({ url });
  } catch (err: any) {
    logger.error({ err }, "Erro ao gerar PDF do cartão sob demanda");
    res.status(500).json({ error: "Erro ao gerar o PDF" });
  }
});

export default router;