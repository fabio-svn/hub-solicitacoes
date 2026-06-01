# RELATÓRIO DE REVISÃO - HUB SVN

--- FILE: artifacts/api-server/src/app.ts ---
```typescript
import compression from "compression";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import router from "./routes";
import authRouter from "./routes/auth";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ApiError } from "./utils/api-error";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

app.use(compression());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://hub.portalsvn.com.br')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (process.env.NODE_ENV !== 'production') return cb(null, true);
    cb(new Error('CORS: origem não permitida: ' + origin));
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.set("trust proxy", 1);

const PgStore = pgSession(session);
app.use(
  session({
    store: new PgStore({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: (() => {
      const secret = process.env.SESSION_SECRET;
      if (!secret && process.env.NODE_ENV === "production") {
        throw new Error("SESSION_SECRET is required in production");
      }
      return secret || randomBytes(32).toString("hex");
    })(),
    resave: false,
    rolling: true,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

app.get("/api/config", (_req, res) => {
  res.set('Cache-Control', 'private, max-age=300');
  res.json({
    r2PublicUrl: process.env.R2_PUBLIC_URL || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev",
    emailUpload: process.env.EMAIL_UPLOAD || "gabriela.franca@svninvest.com.br",
    urlVideoHero: process.env.URL_VIDEO_HERO || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/bg-eventos-2.mp4",
    urlLogoBranca: process.env.URL_LOGO_BRANCA || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-2.svg",
    urlLogoPreta: process.env.URL_LOGO_PRETA || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-1.svg",
    urlManual: process.env.URL_MANUAL || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/Manual-de-Eventos-SVN.pdf",
    urlTutorialTransmissao: process.env.URL_TUTORIAL_TRANSMISSAO || "https://drive.google.com/file/d/1L36fFqFC-sEPWggNmlZOUNnY2DqxP8HK/view?usp=sharing",
  });
});

app.use("/api", router);
app.use("/auth", authRouter);

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  },
}));

app.get("/{*catchAll}", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }
  const anyErr = err as any;
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({
    error: anyErr.message || "Erro interno do servidor",
    code: anyErr.code,
  });
});

export default app;

```

--- FILE: artifacts/api-server/src/routes/index.ts ---
```typescript
import { Router, type IRouter } from "express";
import healthRouter from "./health";
import formsRouter from "./forms";
import adminRouter from "./admin";
import assetsRouter from "./assets";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(formsRouter);
router.use("/admin", adminRouter);
router.use("/admin/assets", assetsRouter);
router.use(webhookRouter);

export default router;

```

--- FILE: artifacts/api-server/src/routes/forms.ts ---
```typescript
import { Router } from "express";
import multer from "multer";
import os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, arquivosTable, activityLogTable, cartaoAprovacoesTable } from "@workspace/db";
import { eq, desc, and, ne, sql, inArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { createClickUpTask, getClickUpTaskStatus, type ArquivosMap } from "./clickup";
import { uploadToR2, deleteFromR2 } from "./r2";
import { gerarArteParaSolicitacao } from "../services/art-generator";
import { logger } from "../lib/logger";
import { CONTRATOS_OPTS, MARCAS_OPTS, CARGOS_OPTS, SETORES_LIST, getFormSchemaList, VALID_TIPOS } from "../config/form-schemas";

const router = Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 250 * 1024 * 1024, files: 10, fields: 20 } });

router.get("/form-schemas", (_req, res) => {
  res.json({
    marcas:    MARCAS_OPTS,
    contratos: CONTRATOS_OPTS,
    cargos:    CARGOS_OPTS,
    setores:   SETORES_LIST,
    tipos:     getFormSchemaList(),
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
  "pagina-assessores-dados": ["nome", "nomeCompleto"],
  "pagina-assessores-atualizacao": ["nome"],
  "assinatura-email":      ["nome", "telefone", "email", "marca"],
  "cartao-visita-fisico":  ["nome", "nomeCartao", "whatsapp", "emailCorporativo", "unidade", "contratoSocial"],
  "cartao-visita-digital": ["nome", "telefone", "email", "contrato_social"],
  "cartao-boas-vindas":    ["nome", "nomeCliente", "nomeAssinatura", "contratoSocial", "unidade"],
  "divulgacao-nps":        ["nome", "nomeAssinatura", "cargo", "agradecimento", "modeloArte"],
  "convite-fp":            ["nome", "codigoAssessor", "nomeAssinatura", "cargo", "contratoSocial"],
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
    if (camel in out && !(snake in out)) {
      out[snake] = out[camel];
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
    case "cartao-boas-vindas":   return `[Cartão de Boas-vindas] ${s(dados.nomeCliente) || userName}`;
    case "cartao-comemorativo":  return `[Cartão Comemorativo] ${s(dados.nomeAniversariante) || userName}`;
    case "divulgacao-nps":       return `[Arte NPS] ${s(dados.nomeAssinatura) || userName}`;
    case "convite-fp":           return `[Convite FP] ${s(dados.nomeAssinatura) || userName}`;
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
    } catch (clickupErr) {
      logger.error({ err: clickupErr }, "ClickUp task creation failed, continuing");
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
    const errMessage = err instanceof Error ? err.message : String(err);
    const errStack   = err instanceof Error ? err.stack  : undefined;
    logger.error({
      err,
      errMessage,
      errStack,
      userEmail:        user?.email,
      tipo_solicitacao: req.body?.tipo_solicitacao,
      step:             "form_submission",
    }, `Form submission error: ${errMessage}`);
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
    res.json({
      data: results,
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
    logger.info({ entregaRaw, taskId: solicitacao.clickup_task_id }, "Entrega field raw value");

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
        contrato_social: a?.contrato_social ?? (dados.contratoSocial || ""),
        envio_para: a?.envio_para ?? "",
        custo: a?.custo ?? "",
        status: a?.status ?? "aguardando-validacao",
        observacao: a?.observacao ?? "",
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
    await db.insert(cartaoAprovacoesTable)
      .values({ solicitacao_id: solicitacaoId, ...valores })
      .onConflictDoUpdate({ target: cartaoAprovacoesTable.solicitacao_id, set: valores });
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro salvando cartao-aprovacao");
    res.status(500).json({ error: "Erro ao salvar" });
  }
});

export default router;

```

--- FILE: artifacts/api-server/src/routes/clickup.ts ---
```typescript
import { logger } from "../lib/logger";
import { randomInt } from "crypto";
import { db, usersTable, userTipoAssignmentsTable, tipoClickupListTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { mapClickUpStatus } from "../config/clickup-status";
import { FORM_SCHEMAS, SETOR_CODIGO_MAP } from "../config/form-schemas";

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN || "";

// Valida um list_id contra o ClickUp usando o token atual.
// Usado pela tela de admin (botão Validar) e pelo save (PUT).
export async function validateClickUpList(
  listId: string
): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!CLICKUP_API_TOKEN) return { ok: false, error: "Token do ClickUp não configurado no servidor." };
  if (!/^\d+$/.test(listId)) return { ok: false, error: "O ID da lista deve conter apenas números." };
  try {
    const r = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
      headers: { Authorization: CLICKUP_API_TOKEN },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let msg = `ClickUp respondeu ${r.status}`;
      if (body.includes("OAUTH_027") || body.includes("not authorized"))
        msg = "Essa lista não existe ou o token não tem acesso a ela (verifique se é um ID de LISTA, não de usuário).";
      else if (r.status === 404) msg = "Lista não encontrada no ClickUp.";
      return { ok: false, error: msg };
    }
    const data = await r.json().catch(() => ({} as any));
    return { ok: true, name: data?.name };
  } catch (err) {
    return { ok: false, error: "Falha de rede ao consultar o ClickUp." };
  }
}

const CLICKUP_LIST_EVENTOS   = process.env.CLICKUP_LIST_EVENTOS   || "901303299333";
const CLICKUP_LIST_GERAL     = process.env.CLICKUP_LIST_GERAL     || "901300673533";
const CLICKUP_LIST_BRINDES   = process.env.CLICKUP_LIST_BRINDES   || "900100469662";
const CLICKUP_LIST_PATROCINIO = process.env.CLICKUP_LIST_PATROCINIO || "901324638951";


const IBGE_STATE_MAP: Record<string, string> = {
  "12": "Acre", "27": "Alagoas", "16": "Amapá", "13": "Amazonas",
  "29": "Bahia", "23": "Ceará", "53": "Distrito Federal", "32": "Espírito Santo",
  "52": "Goiás", "21": "Maranhão", "51": "Mato Grosso", "50": "Mato Grosso do Sul",
  "31": "Minas Gerais", "15": "Pará", "25": "Paraíba", "41": "Paraná",
  "26": "Pernambuco", "22": "Piauí", "33": "Rio de Janeiro", "24": "Rio Grande do Norte",
  "43": "Rio Grande do Sul", "11": "Rondônia", "14": "Roraima", "42": "Santa Catarina",
  "35": "São Paulo", "28": "Sergipe", "17": "Tocantins",
};

const IBGE_SIGLA_MAP: Record<string, string> = {
  "12":"AC","27":"AL","16":"AP","13":"AM","29":"BA","23":"CE","53":"DF",
  "32":"ES","52":"GO","21":"MA","51":"MT","50":"MS","31":"MG","15":"PA",
  "25":"PB","41":"PR","26":"PE","22":"PI","33":"RJ","24":"RN","43":"RS",
  "11":"RO","14":"RR","42":"SC","35":"SP","28":"SE","17":"TO",
};

const NATUREZA_CODIGO: Record<string, string> = {
  "presencial": "P",
  "online":     "L",
};


function gerarIdSolicitacao(dados: FormDados, tipo: string): string {
  const naturezaRaw = str(dados.natureza as string).toLowerCase();
  const tipoCode = tipo === "eventos"
    ? (NATUREZA_CODIGO[naturezaRaw] || "E")
    : "S";
  const setor = str(dados.setor as string);
  const setorCode = SETOR_CODIGO_MAP[setor] || "GRL";
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const rand = String(randomInt(1000, 9999));
  return `${tipoCode}-${setorCode}-${ano}-${mes}-${dia}-${rand}`;
}

const REQUEST_TYPE_LABELS: Record<string, string> = {
  "artes-divulgacao":              "Arte de Divulgação",
  "atualizacao-material":          "Atualização de Material",
  "conteudo-pdf-informativo":      "PDF Informativo",
  "conteudo-pdf-ebook":            "PDF Ebook",
  "apresentacao-nova":             "Apresentação Nova",
  "apresentacao-atualizar":        "Atualização de Apresentação",
  "pagina-assessores-dados":       "Página de Assessores",
  "pagina-assessores-atualizacao": "Página de Assessores",
  "cartao-visita-fisico":          "Cartão de Visita — Físico",
  "pagina-online":                 "Página Online",
  "outro":                         "Outro",
  "email-marketing":               "E-mail Marketing",
  "producao-video":                "Produção de Vídeo",
  "sessao-fotos":                  "Sessão de Fotos",
  "materiais-impressos":           "Materiais Impressos",
  "brindes":                       "Brindes",
  "patrocinio":                    "Patrocínio",
  "ch-kit-onboarding":      "Kit Onboarding",
  "ch-atualizacao-pessoas": "Atualização de Pessoas nos Sites",
  "ch-conteudo-pdf":        "Conteúdo em PDF",
  "ch-arte-divulgacao":     "Arte de Divulgação",
  "ch-atualizacao-books":   "Atualização de Books",
  "ch-linha-do-tempo":      "Linha do Tempo",
  "ch-aniversariantes":     "Aniversariantes do Mês",
};

const ARQUIVO_LABELS: Record<string, string> = {
  arquivoBase:     "Arquivo base",
  arquivoApoio:    "Arquivo de apoio",
  materialAtual:   "Material atual",
  fotoPerfil:      "Foto de perfil",
  logoFile:        "Logo complementar de parceiro",
  imgFile:         "Imagem complementar",
  demaisFile:      "Demais arquivos de apoio",
  arquivoBaseNova: "Arquivo base (nova apresentação)",
  matEmailBase:    "Base para disparo de e-mail",
  palFoto1:        "Foto — Palestrante 1",
  palFoto2:        "Foto — Palestrante 2",
  palFoto3:        "Foto — Palestrante 3",
  palFoto4:        "Foto — Palestrante 4",
};

interface FieldDef {
  label: string;
  id: string;
  dadosKey: string;
  clickupType: string;
  isArquivo?: boolean;
}

// Todos os campos de eventos no ClickUp são do tipo short_text (string simples).
// Data do evento: short_text → enviar string formatada (ex: "01/05/2026"), NÃO timestamp.
// Número de convidados: short_text → enviar string, NÃO inteiro.
// Horários: dois campos distintos; ambos recebem o mesmo valor de dados.horario.
const EVENTOS_CUSTOM_FIELDS: FieldDef[] = [
  { label: "Nome do solicitante",              id: "92db4658-70d1-430e-98ec-5e27029136fd", dadosKey: "nome",            clickupType: "short_text" },
  { label: "Data do evento",                   id: "361cb66a-8c99-43ec-a4fa-5a347e9a4fbd", dadosKey: "dataEvento",      clickupType: "short_text" },
  { label: "Origem do evento",                 id: "626bb697-d9eb-4e79-8277-8a7145e4b979", dadosKey: "origem",          clickupType: "short_text" },
  { label: "Horário do Evento",                id: "45d8babe-a7dd-4a78-952f-1aa366bf34ed", dadosKey: "horario",         clickupType: "short_text" },
  { label: "Horário descrito",                 id: "44c91638-ccb6-41fa-8f05-dcab3085f313", dadosKey: "horario",         clickupType: "short_text" },
  { label: "Horário de Brasília?",             id: "af7d26c8-f228-4985-941a-20bb6905b6d5", dadosKey: "horBrasilia",     clickupType: "short_text" },
  { label: "Título do evento",                 id: "b40d49f5-341d-4671-a4f0-7cef7a643d6b", dadosKey: "nomeEvento",      clickupType: "short_text" },
  { label: "O evento terá palestrantes?",      id: "8dbc39d5-f2e7-4669-be67-b1a24a53c2cf", dadosKey: "temPalestrante",  clickupType: "short_text" },
  { label: "Palestrante 1 — colaborador SVN?", id: "28491235-89d7-4384-819c-66ca974d04a0", dadosKey: "palSvn1",         clickupType: "short_text" },
  { label: "Palestrante 1 — Nome",             id: "5de3fdb1-3434-4820-92c8-6e7ee82cd3eb", dadosKey: "palNome1",        clickupType: "short_text" },
  { label: "Palestrante 1 — Cargo",            id: "56fbcd07-eab1-465d-9055-8c5e6c0f39ac", dadosKey: "palCargo1",       clickupType: "short_text" },
  { label: "Palestrante 1 — Foto",             id: "73d010f4-fb4b-4e00-bcf1-f550487c18fd", dadosKey: "palFoto1",        clickupType: "short_text", isArquivo: true },
  { label: "Natureza",                         id: "1e31ee81-8b88-4cfc-b8c1-754a94f5f084", dadosKey: "natureza",        clickupType: "short_text" },
  { label: "Nível de maturidade",              id: "1fe629c6-9cf4-4576-8828-bc93aae0d335", dadosKey: "maturidade",      clickupType: "short_text" },
  { label: "Tipo de evento",                   id: "c81a416c-a09d-41f4-a003-5261bf6edce6", dadosKey: "tipoEvento",      clickupType: "short_text" },
  { label: "Breve descrição do evento",        id: "4930db39-8924-4121-b432-1068e15068db", dadosKey: "descricao",       clickupType: "text"       },
  { label: "Cidade",                           id: "ded0be23-c50e-4f82-8b81-66a73dcc42a8", dadosKey: "_cidadeFormatada",clickupType: "short_text" },
  { label: "Imagem complementar de parceiro",  id: "2d45b87d-dfd0-4f8d-92d2-0a6efc27eec7", dadosKey: "imgFile",         clickupType: "short_text", isArquivo: true },
  { label: "Arquivo adicional",                id: "35d6d98f-e139-444a-a32a-699a24fe544a", dadosKey: "demaisFile",      clickupType: "short_text", isArquivo: true },
  { label: "Público-alvo",                     id: "5ffdf7e3-cde1-465c-a186-1b24d0f6b395", dadosKey: "publico",         clickupType: "short_text" },
  { label: "Número de convidados",             id: "d676846e-b66c-4c71-8173-7378d9db1f95", dadosKey: "convidados",      clickupType: "short_text" },
  { label: "Custo estimado",                   id: "de09cf5f-3e69-48de-bb7f-bececcf55f95", dadosKey: "custoEstimado",   clickupType: "short_text" },
  { label: "Rateio",                           id: "7ce379f3-fc8c-4ba4-a814-829694df1d07", dadosKey: "rateio",          clickupType: "short_text" },
  { label: "Endereço do local externo",        id: "78816dd7-89b1-470b-a812-8716cd4b8ebf", dadosKey: "localEndereco",   clickupType: "short_text" },
  { label: "Canal de transmissão",             id: "83420339-a502-4a47-ac02-17c5cb5f17c2", dadosKey: "canal",           clickupType: "short_text" },
  { label: "Link de transmissão",              id: "d4964071-a1f6-4089-9e0c-4d7723de3c1b", dadosKey: "linkTransmissao", clickupType: "short_text" },
  { label: "Ideia / Quando",                   id: "ee61335f-97d0-4f9a-91db-675aa7697671", dadosKey: "ideaQuando",      clickupType: "short_text" },
  { label: "Logo complementar de parceiro",    id: "245f050b-1827-45cb-a983-a8b6ab1596ae", dadosKey: "logoFile",        clickupType: "short_text", isArquivo: true },
  { label: "Sugestão de local",                id: "a91901e2-25e0-4224-9d23-8fe13a903ac6", dadosKey: "localSugestoes",  clickupType: "short_text" },
  { label: "Palestrante 2 — colaborador SVN?", id: "9c1d3dbe-39cf-4a84-a67b-2d33ffd6bffe", dadosKey: "palSvn2",         clickupType: "short_text" },
  { label: "Palestrante 2 — Nome",             id: "281def01-58e4-4d21-8b0e-f8bd792d947e", dadosKey: "palNome2",        clickupType: "short_text" },
  { label: "Palestrante 2 — Cargo",            id: "52391024-c4f3-4999-983a-53492e8069a5", dadosKey: "palCargo2",       clickupType: "short_text" },
  { label: "Palestrante 2 — Foto",             id: "00b1cf20-bb99-4f93-bd7b-6e06cf28e84a", dadosKey: "palFoto2",        clickupType: "short_text", isArquivo: true },
  { label: "Palestrante 3 — colaborador SVN?", id: "6467fb48-b972-40ab-a9b2-79cdc0173167", dadosKey: "palSvn3",         clickupType: "short_text" },
  { label: "Palestrante 3 — Nome",             id: "ea476985-2ec4-4a06-8e33-9d6a70ddd07a", dadosKey: "palNome3",        clickupType: "short_text" },
  { label: "Palestrante 3 — Cargo",            id: "f32b20cc-01a6-443e-a5ac-91aaee4fa9b2", dadosKey: "palCargo3",       clickupType: "short_text" },
  { label: "Palestrante 3 — Foto",             id: "53981c0c-20ef-45e9-bf11-8f95261dd4ce", dadosKey: "palFoto3",        clickupType: "short_text", isArquivo: true },
  { label: "Palestrante 4 — colaborador SVN?", id: "c70cc18e-82b7-48f4-b5db-1cc1e1fa18cb", dadosKey: "palSvn4",         clickupType: "short_text" },
  { label: "Palestrante 4 — Nome",             id: "a128e306-f734-423c-8971-9fd4ca66e354", dadosKey: "palNome4",        clickupType: "short_text" },
  { label: "Palestrante 4 — Cargo",            id: "e76af56c-0cf8-4274-970c-93333c6c2f86", dadosKey: "palCargo4",       clickupType: "short_text" },
  { label: "Palestrante 4 — Foto",             id: "2ad7d8c4-bc0d-4925-818e-cc24bedca0bc", dadosKey: "palFoto4",        clickupType: "short_text", isArquivo: true },
];

const MATERIAL_LABELS: Record<string, string> = {
  "pacote-padrao":               "Pacote de Divulgação Padrão",
  "pacote-personalizado":        "Pacote de Divulgação Personalizado",
  "banner-impresso":             "Banner Impresso",
  "flyer":                       "Flyer",
  "brindes-store":               "Brindes (solicitar na Store)",
  "brindes-personalizados":      "Brindes Personalizados",
  "captacao-audiovisual":        "Captação Audiovisual",
  "coffee-break":                "Coffee Break ou Coquetel",
  "instagram":                   "Divulgação no Instagram da SVN",
  "email-marketing":             "E-mail Marketing",
  "equipe-staff":                "Equipe Staff (Marketing)",
  "jantar-almoco":               "Jantar / Almoço (Restaurante)",
  "pagina-sorteio":              "Página para Sorteio",
  "projeto-stand":               "Projeto de Stand",
  "pacote-padrao-online":        "Pacote de Divulgação Padrão (online)",
  "pacote-personalizado-online": "Pacote de Divulgação Personalizado (online)",
  "instagram-online":            "Divulgação no Instagram da SVN (online)",
  "link-youtube-online":         "Link da live no Youtube",
  "apoio-live-online":           "Apoio em live",
  "email-marketing-online":      "E-mail Marketing (online)",
};

const MATERIAL_COND_LABELS: Record<string, Record<string, string>> = {
  "pacote-personalizado":        { personConvite: "O que personalizar no convite", personPagina: "O que incluir na página de inscrição" },
  "pacote-personalizado-online": { personConvite: "O que personalizar no convite", personPagina: "O que incluir na página de inscrição" },
  "banner-impresso":             { tamanho: "Tamanho", conteudo: "Conteúdo" },
  "flyer":                       { tipo: "Tipo", tamanho: "Tamanho", conteudo: "Conteúdo" },
  "brindes-personalizados":      { descricao: "Descrição do brinde" },
  "captacao-audiovisual":        { tipo: "Tipo de captação" },
  "instagram":                   { formaDiv: "Forma de divulgação", arroba: "Perfil" },
  "instagram-online":            { formaDiv: "Forma de divulgação", arroba: "Perfil" },
  "email-marketing":             { conteudo: "Conteúdo do e-mail" },
  "email-marketing-online":      { conteudo: "Conteúdo do e-mail" },
  "apoio-live-online":           { descricao: "Tipo de apoio" },
  "pagina-sorteio":              { premioDefinido: "Prêmio definido", descricao: "Descrição do prêmio" },
  "projeto-stand":               { materiais: "Materiais necessários" },
};

interface SolicitacaoData {
  tipo_solicitacao: string;
  subtipo?: string | null;
}

interface UserData {
  name: string;
  email: string;
  role?: string;
}

interface FormDados {
  nomeEvento?: string;
  titulo?: string;
  nomeCompleto?: string;
  materiais?: unknown;
  materiaisDetalhes?: unknown;
  [key: string]: unknown;
}

export interface ArquivosMap {
  [campo: string]: string;
}

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function addLine(items: string[], label: string, value: string | null | undefined): void {
  const v = str(value);
  if (v) items.push(`• ${label}: ${v}`);
}

function formatDate(raw: string | undefined): string | null {
  const s = str(raw);
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function humanizeEstado(raw: string | undefined): string | null {
  const s = str(raw);
  if (!s) return null;
  const mapped = IBGE_STATE_MAP[s];
  if (!mapped) {
    logger.warn({ raw: s }, "ClickUp: estado não encontrado no mapa IBGE, mantendo valor original");
    return s;
  }
  return mapped;
}

function humanizeLocal(dados: FormDados): string | null {
  const localEvento = str(dados.localEvento);
  if (!localEvento) return null;
  if (localEvento === "unidade") {
    const unidade = str(dados.unidadeSVN);
    return unidade ? `Unidade SVN — ${unidade}` : "Unidade SVN";
  }
  if (localEvento === "externo") {
    const nome = str(dados.localNome);
    const endereco = str(dados.localEndereco);
    const parts = [nome, endereco].filter(Boolean);
    return parts.length ? parts.join(" — ") : "Local externo (não especificado)";
  }
  if (localEvento === "nao-definido") return "Local ainda não definido";
  return null;
}

function getUserDepartment(user: UserData, dados: FormDados): string {
  const setor = str(dados.setor as string);
  if (setor) return setor;
  logger.warn({ email: user.email }, "ClickUp: setor não disponível na sessão, usando fallback Geral");
  return "Geral";
}

function humanizeRequestType(tipo: string): string {
  return REQUEST_TYPE_LABELS[tipo] || tipo;
}

// ─────────────────────────────────────────────
// Task name builders
// ─────────────────────────────────────────────

function buildClickUpEventTaskName(dados: FormDados): string {
  const naturezaRaw = str(dados.natureza);
  const natureza = naturezaRaw === "presencial" ? "Presencial"
    : naturezaRaw === "online" ? "Online"
    : naturezaRaw || "Evento";
  const titulo = str(dados.nomeEvento) || "Evento sem título";
  const cidade = str(dados.cidade);
  logger.info({ natureza, titulo, cidade }, "ClickUp: nome da task de evento gerado");
  return cidade
    ? `[Evento ${natureza}] ${titulo} - ${cidade}`
    : `[Evento ${natureza}] ${titulo}`;
}

function buildGeneralTaskName(tipo: string, _subtipo: string, dados: FormDados, user: UserData): string {
  const setor = getUserDepartment(user, dados);

  switch (tipo) {
    case "cartao-visita-fisico":
      return `[Cartão de Visita] ${str(dados.nomeCartao) || user.name}`;

    case "patrocinio": {
      const cidade = str(dados.cidade);
      const tituloEv = str(dados.tituloEvento);
      return cidade ? `[Patrocínio] ${tituloEv} - ${cidade}` : `[Patrocínio] ${tituloEv}`;
    }

    case "brindes":
      return `[Brinde] ${user.name} - ${setor}`;

    case "pagina-online":
      return `[Página Online] ${str(dados.titulo)} - ${setor}`;

    case "materiais-impressos": {
      const tipoMat = str(dados.tipoMaterial) || str(dados.tipoImpresso) || "Material";
      const tipoMatLabel = tipoMat.charAt(0).toUpperCase() + tipoMat.slice(1);
      return `[Material Impresso] ${tipoMatLabel} - ${setor}`;
    }

    case "ch-kit-onboarding":      return "[Capital Humano] Kit Onboarding";
    case "ch-atualizacao-pessoas": return "[Capital Humano] Atualização de Pessoas";
    case "ch-conteudo-pdf":        return "[Capital Humano] Conteúdo em PDF";
    case "ch-arte-divulgacao":     return "[Capital Humano] Arte de Divulgação";
    case "ch-atualizacao-books":   return "[Capital Humano] Atualização de Books";
    case "ch-linha-do-tempo": {
      const mes = str(dados.mes);
      return mes ? `[Capital Humano] Linha do Tempo - ${mes}` : "[Capital Humano] Linha do Tempo";
    }
    case "ch-aniversariantes": {
      const mes = str(dados.mes);
      return mes ? `[Capital Humano] Aniversariantes do Mês - ${mes}` : "[Capital Humano] Aniversariantes do Mês";
    }

    default: {
      const tipoHuman = humanizeRequestType(tipo);
      const titulo = str(dados.titulo) || str(dados.nomeCompleto) || "";
      let name = `[${tipoHuman}]`;
      if (setor && setor !== "Geral") name += ` ${setor}`;
      if (titulo) name += ` - ${titulo}`;
      logger.info({ tipo, tipoHuman, setor, titulo, taskName: name }, "ClickUp: nome da task geral gerado");
      return name;
    }
  }
}

// ─────────────────────────────────────────────
// Description section builders — Eventos
// ─────────────────────────────────────────────

function buildRequesterSection(user: UserData, dados?: FormDados): string {
  const items: string[] = [];
  items.push(`• Solicitante: ${user.name}`);
  items.push(`• E-mail: ${user.email}`);
  if (dados) addLine(items, "Telefone", str(dados.telefone as string));
  logger.info({ nome: user.name, email: user.email }, "ClickUp: bloco solicitante montado");
  return `👤 SOLICITANTE\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
}

function buildResumoSection(dados: FormDados): string {
  const naturezaRaw = str(dados.natureza);
  const natureza = naturezaRaw === "presencial" ? "Presencial"
    : naturezaRaw === "online" ? "Online"
    : naturezaRaw || null;

  const tipoAproxRaw = str(dados.tipoAprox);
  const tipoAprox = tipoAproxRaw === "ao-vivo" ? "Ao vivo"
    : tipoAproxRaw === "gravado" ? "Gravado"
    : tipoAproxRaw || null;

  const items: string[] = [];
  addLine(items, "Natureza", natureza);
  addLine(items, "Setor solicitante", str(dados.setor as string));
  addLine(items, "Nível de maturidade", str(dados.maturidade));
  addLine(items, "Título do evento", str(dados.nomeEvento));
  addLine(items, "Data do evento", formatDate(dados.dataEvento as string));
  addLine(items, "Horário do evento", str(dados.horario));
  addLine(items, "Origem do evento", str(dados.origem));
  addLine(items, "Tipo de evento", str(dados.tipoEvento));
  addLine(items, "Público-alvo", str(dados.publico));
  addLine(items, "Estado", humanizeEstado(dados.estado as string));
  addLine(items, "Cidade", str(dados.cidade));
  addLine(items, "Local", humanizeLocal(dados));
  addLine(items, "Número estimado de convidados", str(dados.convidados));
  addLine(items, "Custo estimado", str(dados.custoEstimado));
  addLine(items, "Rateio", str(dados.rateio));
  addLine(items, "Canal de transmissão", str(dados.canal));
  addLine(items, "Link de transmissão", str(dados.linkTransmissao));
  addLine(items, "Tipo de transmissão", tipoAprox);
  addLine(items, "Ideia / Quando", str(dados.ideaQuando));
  addLine(items, "Objetivos", str(dados.objetivos));
  addLine(items, "Descrição", str(dados.descricao));
  logger.info({ itens: items.length }, "ClickUp: bloco de resumo montado");
  return `🎯 RESUMO DA SOLICITAÇÃO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
}

function buildPalestrantesSection(dados: FormDados): string | null {
  if (str(dados.temPalestrante).toLowerCase() !== "sim") return null;
  const items: string[] = [];
  items.push("• O evento terá palestrantes?: Sim");
  const lista = [
    { svn: dados.palSvn1, nome: dados.palNome1, cargo: dados.palCargo1, n: 1 },
    { svn: dados.palSvn2, nome: dados.palNome2, cargo: dados.palCargo2, n: 2 },
    { svn: dados.palSvn3, nome: dados.palNome3, cargo: dados.palCargo3, n: 3 },
    { svn: dados.palSvn4, nome: dados.palNome4, cargo: dados.palCargo4, n: 4 },
  ];
  let count = 0;
  for (const { svn, nome, cargo, n } of lista) {
    const nomeStr = str(nome as string);
    if (!nomeStr) continue;
    count++;
    const svnStr = str(svn as string);
    if (svnStr) items.push(`• Palestrante ${n} é colaborador da SVN?: ${svnStr}`);
    items.push(`• Nome do palestrante ${n}: ${nomeStr}`);
    const cargoStr = str(cargo as string);
    if (cargoStr) items.push(`• Cargo do palestrante ${n}: ${cargoStr}`);
  }
  if (count === 0) return null;
  logger.info({ count }, "ClickUp: bloco de palestrantes montado");
  return `🎤 PALESTRANTES\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
}

function buildMateriaisSection(dados: FormDados): string | null {
  const materiais = dados.materiais as string[] | undefined;
  if (!materiais || !Array.isArray(materiais) || materiais.length === 0) return null;
  const detalhes = (dados.materiaisDetalhes || {}) as Record<string, Record<string, string>>;
  const lines: string[] = [];
  for (const materialId of materiais) {
    const label = MATERIAL_LABELS[materialId] || materialId;
    lines.push(`✅ ${label}`);
    const condLabels = MATERIAL_COND_LABELS[materialId];
    const condValues = detalhes[materialId];
    if (condLabels && condValues && typeof condValues === "object") {
      for (const [key, fieldLabel] of Object.entries(condLabels)) {
        const val = str(condValues[key]);
        if (val) lines.push(`• ${fieldLabel}: ${val}`);
      }
    }
    lines.push("");
  }
  logger.info({ count: materiais.length }, "ClickUp: bloco de materiais montado");
  return `📦 MATERIAIS SOLICITADOS\n━━━━━━━━━━━━━━━━━━━━━━\n\n${lines.join("\n").trimEnd()}`;
}

function buildEventDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));
  blocks.push(buildResumoSection(dados));
  const palestrantes = buildPalestrantesSection(dados);
  if (palestrantes) blocks.push(palestrantes);
  const materiais = buildMateriaisSection(dados);
  if (materiais) blocks.push(materiais);
  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);
  const obs = str(dados.observacoes);
  if (obs) blocks.push(`📝 OBSERVAÇÕES GERAIS\n━━━━━━━━━━━━━━━━━━━━━━\n\n• ${obs}`);
  logger.info({ blocos: blocks.length }, "ClickUp: descricao humanizada de evento gerada");
  return blocks.join("\n\n");
}

// ─────────────────────────────────────────────
// Description section builders — Lista Geral
// ─────────────────────────────────────────────

function buildDetailsSection(tipo: string, dados: FormDados): string | null {
  const items: string[] = [];

  if (["artes-divulgacao", "conteudo-pdf-informativo", "conteudo-pdf-ebook"].includes(tipo)) {
    const conteudo = str(dados.conteudo);
    if (conteudo) items.push(`• Conteúdo / Briefing:\n${conteudo}`);
    const canalOutro = str(dados.canalOutro);
    if (canalOutro) items.push(`• Canal personalizado: ${canalOutro}`);

  } else if (tipo === "atualizacao-material") {
    const descricao = str(dados.descricao);
    if (descricao) items.push(`• Descrição das atualizações:\n${descricao}`);

  } else if (["apresentacao-nova", "apresentacao-atualizar"].includes(tipo)) {
    const tamanho = str(dados.tamanho);
    if (tamanho) items.push(`• Formato / Tamanho: ${tamanho}`);
    const tipoCriacao = str(dados.tipoCriacao);
    if (tipoCriacao) {
      const tipoHuman = tipoCriacao === "do-zero" ? "Do zero"
        : tipoCriacao === "base-existente" ? "Com base existente"
        : tipoCriacao;
      items.push(`• Tipo de criação: ${tipoHuman}`);
    }
    const elementos = str(dados.elementos);
    if (elementos) items.push(`• Elementos desejados: ${elementos}`);
    const elementosDesc = str(dados.elementosDescricao);
    if (elementosDesc) items.push(`• Descrição dos elementos:\n${elementosDesc}`);

  } else if (["pagina-assessores-dados", "pagina-assessores-atualizacao"].includes(tipo)) {
    addLine(items, "Nome completo", str(dados.nomeCompleto));
    addLine(items, "Código do assessor", str(dados.codigoAssessor));
    addLine(items, "Unidade", str(dados.unidade));
    addLine(items, "Contrato social", str(dados.contratoSocial));
    addLine(items, "LinkedIn", str(dados.linkedin));
    addLine(items, "Instagram", str(dados.instagram));
    const miniBio = str(dados.miniBio);
    if (miniBio) items.push(`• Mini bio:\n${miniBio}`);
    const selos = dados.selos as string[] | undefined;
    if (selos && Array.isArray(selos) && selos.length > 0) {
      items.push(`• Selos: ${selos.join(", ")}`);
    }
    const depos = dados.depoimentos as Array<{ nome: string; texto: string }> | undefined;
    if (depos && Array.isArray(depos) && depos.length > 0) {
      items.push("• Depoimentos:");
      depos.forEach((d, i) => {
        if (d.nome && d.texto) items.push(`  ${i + 1}. ${d.nome}: "${d.texto}"`);
      });
    }
  }

  if (items.length === 0) return null;
  return `📝 DETALHES\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
}

function buildArquivosSection(arquivos: ArquivosMap): string | null {
  const items: string[] = [];
  for (const [campo, url] of Object.entries(arquivos)) {
    if (!url) continue;
    const label = ARQUIVO_LABELS[campo] || campo;
    items.push(`• ${label}: ${url}`);
  }
  if (items.length === 0) return null;
  return `📎 ARQUIVOS\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
}

function buildGeneralDescription(
  tipo: string,
  subtipo: string,
  dados: FormDados,
  user: UserData,
  arquivos: ArquivosMap
): string {
  const blocks: string[] = [];

  blocks.push(buildRequesterSection(user, dados));

  const tipoHuman = humanizeRequestType(tipo);
  const setor = getUserDepartment(user, dados);
  const resumoItems: string[] = [];
  addLine(resumoItems, "Tipo", tipoHuman);
  if (subtipo) addLine(resumoItems, "Subtipo", subtipo);
  if (setor) addLine(resumoItems, "Setor", setor);
  addLine(resumoItems, "Título", str(dados.titulo) || str(dados.nomeCompleto));
  addLine(resumoItems, "Finalidade", str(dados.finalidade));
  addLine(resumoItems, "Prazo de entrega", str(dados.prazoEntrega));
  addLine(resumoItems, "Público-alvo", str(dados.publico as string) || str(dados.publicoAlvo));
  addLine(resumoItems, "Canais", str(dados.canais));
  if (resumoItems.length > 0) blocks.push(`📌 RESUMO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${resumoItems.join("\n")}`);

  const detalhes = buildDetailsSection(tipo, dados);
  if (detalhes) blocks.push(detalhes);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  const obs = str(dados.observacoes);
  if (obs) blocks.push(`📝 OBSERVAÇÕES GERAIS\n━━━━━━━━━━━━━━━━━━━━━━\n\n• ${obs}`);

  logger.info({ tipo, blocos: blocks.length }, "ClickUp: descricao geral humanizada gerada, JSON bruto removido");
  return blocks.join("\n\n");
}

// ─────────────────────────────────────────────
// Description builders — específicos por tipo
// ─────────────────────────────────────────────

function buildCartaoFisicoDescription(dados: FormDados, user: UserData): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));
  const items: string[] = [];
  items.push(`• Nome: ${str(dados.nomeCartao)}`);
  items.push(`• WhatsApp: ${str(dados.whatsapp)}`);
  items.push(`• E-mail: ${str(dados.emailCorporativo)}`);
  items.push(`• Contrato social: ${str(dados.contratoSocial)}`);
  items.push(`• Unidade: ${str(dados.unidade)}`);
  items.push(`• Link para planilha: https://svninvest-my.sharepoint.com/:x:/r/personal/gabriela_franca_svninvest_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B7D66B897-EA4E-4C43-AB8C-20DB6B8B745C%7D&file=Solicitac%25u0327o%25u0303es%20Marketing.xlsx&nav=MTVfezAwMDAwMDAwLTAwMDEtMDAwMC0wNjAwLTAwMDAwMDAwMDAwMH0&action=default&mobileredirect=true`);
  blocks.push(`📇 CARTÃO DE VISITA\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);
  return blocks.join("\n\n");
}

function buildPatrocinioDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const resumoItems: string[] = [];
  addLine(resumoItems, "Título do evento", str(dados.tituloEvento));
  addLine(resumoItems, "Marcas parceiras", str(dados.marcasParceiras));
  addLine(resumoItems, "Data do evento", formatDate(dados.dataEvento as string));
  addLine(resumoItems, "Horário", str(dados.horario));
  addLine(resumoItems, "Horário de Brasília?", str(dados.horBrasilia));
  addLine(resumoItems, "Estado", humanizeEstado(dados.estado as string));
  addLine(resumoItems, "Cidade", str(dados.cidade));
  addLine(resumoItems, "Local", str(dados.local));
  addLine(resumoItems, "Tipo de evento", str(dados.tipoEvento));
  addLine(resumoItems, "Público", str(dados.publico));
  if (resumoItems.length > 0)
    blocks.push(`📋 RESUMO DO EVENTO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${resumoItems.join("\n")}`);

  const explicacao = str(dados.explicacao);
  if (explicacao)
    blocks.push(`💡 IDEIA DO PATROCÍNIO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${explicacao}`);

  const matSection = buildMateriaisSection(dados);
  if (matSection) blocks.push(matSection);

  const finItems: string[] = [];
  addLine(finItems, "Centro de custo", str(dados.centroCusto));
  addLine(finItems, "Valor da cota", str(dados.valorCota));
  addLine(finItems, "Orçamento total", str(dados.orcamentoTotal));
  addLine(finItems, "Expectativa de retorno", str(dados.expectativaRetorno));
  addLine(finItems, "Orç. alimentação/pessoa", str(dados.orcAlimentacao));
  addLine(finItems, "Orç. material gráfico", str(dados.orcGrafico));
  addLine(finItems, "Orç. brindes", str(dados.orcBrindes));
  addLine(finItems, "Orç. equipe staff", str(dados.orcStaff));
  if (finItems.length > 0)
    blocks.push(`💰 FINANCEIRO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${finItems.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildBrindesDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Título", str(dados.titulo));
  addLine(items, "Finalidade", str(dados.finalidade));
  addLine(items, "Data de entrega", formatDate(dados.dataEntrega as string));
  addLine(items, "Itens solicitados", Array.isArray(dados.itens)
    ? (dados.itens as string[]).join(", ")
    : str(dados.itens));
  addLine(items, "Personalização", str(dados.personalizacao));
  addLine(items, "Texto cartão presente", str(dados.textoCartaoPresente));
  if (items.length > 0)
    blocks.push(`📦 BRINDE\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildPaginaOnlineDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Título da página", str(dados.titulo));
  addLine(items, "Finalidade", str(dados.finalidade));
  if (items.length > 0)
    blocks.push(`🌐 PÁGINA ONLINE\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildMateriaisImpressosDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Tipo de material", str(dados.tipoMaterial) || str(dados.tipoImpresso));
  addLine(items, "Formato do papel", str(dados.formatoPapel));
  addLine(items, "Orientação", str(dados.orientacao));
  addLine(items, "Tamanho", str(dados.tamanhoBanner) || str(dados.tamanhoAdesivo));
  addLine(items, "Tipo de adesivo", str(dados.tipoAdesivo));
  addLine(items, "Tipo de camiseta", str(dados.tipoCamiseta));
  addLine(items, "Cor", str(dados.corCamiseta));
  addLine(items, "Quantidade/tamanhos", str(dados.qtdTamanhos));
  addLine(items, "Fornecedor", str(dados.fornecedor));
  if (items.length > 0)
    blocks.push(`🖨️ MATERIAL IMPRESSO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const conteudo = str(dados.conteudoMaterial);
  if (conteudo)
    blocks.push(`📝 CONTEÚDO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${conteudo}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildEmailMarketingDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Assunto", str(dados.assunto));
  addLine(items, "Finalidade", str(dados.finalidade));
  addLine(items, "Tema e resumo", str(dados.tema));
  addLine(items, "Data de disparo", formatDate(dados.dataDisparo as string));
  addLine(items, "Assinatura do e-mail", str(dados.assinaturaEmail));
  if (items.length > 0)
    blocks.push(`✉️ E-MAIL MARKETING\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildProducaoAudiovisualDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap, tipo: string): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const isVideo = tipo === "producao-video";

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Modalidade", isVideo ? "Produção de Vídeo" : "Sessão de Fotos");
  addLine(items, "Título", str(dados.titulo) || str(dados.tituloFotos));
  addLine(items, "Ideia / Descrição", str(dados.ideia) || str(dados.descricaoFotos));
  addLine(items, "Formato", Array.isArray(dados.formato)
    ? (dados.formato as string[]).join(", ")
    : str(dados.formato));
  addLine(items, "Restrições", str(dados.restricoes));
  if (items.length > 0)
    blocks.push(`🎥 PRODUÇÃO AUDIOVISUAL\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildOutroDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Título", str(dados.titulo));
  addLine(items, "Finalidade", str(dados.finalidade));
  if (items.length > 0)
    blocks.push(`📋 RESUMO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const descricao = str(dados.descricao);
  if (descricao)
    blocks.push(`📝 DESCRIÇÃO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${descricao}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

// ─────────────────────────────────────────────
// ClickUp API helpers
// ─────────────────────────────────────────────

async function setClickUpCustomField(
  taskId: string,
  fieldId: string,
  value: unknown,
  label: string,
  opts?: { clickupType?: string; raw?: unknown }
): Promise<void> {
  logger.info({
    taskId,
    fieldId,
    label,
    clickupType: opts?.clickupType ?? "unknown",
    rawValue: opts?.raw !== undefined ? opts.raw : value,
    convertedValue: value,
  }, "ClickUp: enviando custom field");
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error({ taskId, fieldId, label, clickupType: opts?.clickupType, httpStatus: response.status, body: text }, "ClickUp: ERRO ao preencher custom field");
    } else {
      logger.info({ taskId, fieldId, label, clickupType: opts?.clickupType }, "ClickUp: custom field preenchido com sucesso");
    }
  } catch (err) {
    logger.error({ err, taskId, fieldId, label }, "ClickUp: excecao ao preencher custom field");
  }
}

async function setEventosCustomFields(taskId: string, dados: FormDados, arquivos: ArquivosMap, user: UserData): Promise<void> {
  // ── Cópia local para campos computados — não muta o objeto original ────────
  const dadosLocal: Record<string, unknown> = { ...dados };

  // ── Campos computados: calcular antes do Promise.all ──────────────────────
  const localHuman = humanizeLocal(dados);

  const cidadeRaw = str(dados.cidade as string);
  const estadoRaw = str(dados.estado as string);
  if (cidadeRaw) {
    const sigla = IBGE_SIGLA_MAP[estadoRaw] || estadoRaw;
    dadosLocal._cidadeFormatada = sigla ? `${cidadeRaw} - ${sigla}` : cidadeRaw;
  }

  const localEvento = str(dados.localEvento as string);
  // UNIDADES_ENDERECOS é definido inline para manter o mapeamento próximo ao uso;
  // se outros módulos precisarem, extrair para um arquivo de constantes compartilhado.
  if (localEvento === "unidade") {
    const UNIDADES_ENDERECOS: Record<string, string> = {
      "SVN Aracaju":              "R. Francisco Duarte Ramos, 34 - Jardins, Aracaju - SE",
      "SVN Campo Grande":         "Edifício Atrium - R. Euclides da Cunha, 1039 - Loja 3 - Jardim dos Estados",
      "SVN Cascavel":             "Av. Piquiri, 17 - Salas 01 e 02 - Centro",
      "SVN Cuiabá":               "R. Pres. Castelo Branco, 277 - Quilombo",
      "SVN Curitiba":             "Praça São Paulo da Cruz, 50 - Sala 1605 - Juveve, Curitiba - PR",
      "SVN Foz do Iguaçu":        "R. Alm. Barroso, 1139 - Centro",
      "SVN Londrina":             "Av. Higienópolis, 602 - Sala 2 - Centro, Londrina - PR",
      "SVN Maringá":              "Av. Cerro Azul, 123 - Zona 2, Maringá - PR",
      "SVN Salvador":             "Torre Nova York, Av. Tancredo Neves, 2539 - Sala 2104, Salvador - BA",
      "SVN São Paulo":            "Av. Dr. Cardoso de Melo, 1855 - Conjunto 51 - Vila Olímpia, São Paulo - SP",
      "SVN Toledo":               "Rua Nossa Senhora do Rocio, 2279 - Sala 02 - Jardim La Salle, Toledo - PR",
      "SVN Vitória da Conquista":  "Av. Jorge Teixeira, 29 - Salas 16 e 17",
    };
    const unidade = str(dados.unidadeSVN as string);
    const enderecoUnidade = UNIDADES_ENDERECOS[unidade];
    if (enderecoUnidade) {
      dadosLocal.localEndereco = enderecoUnidade;
      logger.info({ unidade, endereco: enderecoUnidade }, "ClickUp: endereço da unidade SVN injetado");
    }
  }

  const materiaisArr = dados.materiais as string[] | undefined;
  const materiaisText = (Array.isArray(materiaisArr) && materiaisArr.length > 0)
    ? materiaisArr.map(id => `• ${MATERIAL_LABELS[id] || id}`).join("\n")
    : null;

  // ── Campos fixos computados em paralelo ────────────────────────────────────
  await Promise.all([
    user.email
      ? setClickUpCustomField(taskId, "ae56f16a-8d97-40e0-9032-c357eb0793ca", user.email, "E-mail do Solicitante", { clickupType: "short_text", raw: user.email })
      : Promise.resolve(),
    localHuman
      ? setClickUpCustomField(taskId, "38ac133a-13b0-4428-98eb-adb5f8cdc23a", localHuman, "Local do evento", { clickupType: "short_text" })
      : Promise.resolve(),
    materiaisText
      ? setClickUpCustomField(taskId, "3266524c-febc-47ac-a76d-0d9c4256d9dc", materiaisText, "Solicitações", { clickupType: "text", raw: materiaisArr })
      : Promise.resolve(),
  ]);

  // ── Campos da lista EVENTOS_CUSTOM_FIELDS — paralelo em lotes de 10 ────────
  const fieldThunks: Array<() => Promise<void>> = [];

  for (const field of EVENTOS_CUSTOM_FIELDS) {
    let value: string | null;

    if (field.isArquivo) {
      const url = arquivos[field.dadosKey] || null;
      if (!url) { logger.warn({ taskId, label: field.label }, "ClickUp: arquivo sem URL, pulando"); continue; }
      value = url;
    } else {
      const raw = field.dadosKey in dadosLocal ? dadosLocal[field.dadosKey] : dados[field.dadosKey];
      if (raw === undefined || raw === null || str(raw as string) === "") {
        logger.warn({ taskId, label: field.label, dadosKey: field.dadosKey }, "ClickUp: campo sem valor, pulando");
        continue;
      }
      if (field.dadosKey === "dataEvento") {
        value = formatDate(String(raw)) ?? String(raw);
      } else if (field.dadosKey === "natureza") {
        const n = str(raw as string).toLowerCase();
        value = n === "presencial" ? "Presencial" : n === "online" ? "Online" : str(raw as string);
      } else {
        value = str(raw as string);
      }
    }

    const capturedValue = value;
    fieldThunks.push(
      () => setClickUpCustomField(taskId, field.id, capturedValue, field.label, {
        clickupType: field.clickupType,
        raw: field.dadosKey in dadosLocal ? dadosLocal[field.dadosKey] : dados[field.dadosKey],
      })
    );
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < fieldThunks.length; i += BATCH_SIZE) {
    await Promise.all(fieldThunks.slice(i, i + BATCH_SIZE).map(t => t()));
  }
}

// Mapa de tipo de solicitação → orderindex do dropdown "Tipo de Demanda" no ClickUp.
// Todos os tipos da Lista Geral são classificados como "Conteúdo" (orderindex 3).
const TIPO_DEMANDA_ORDERINDEX: Record<string, number> = {
  "artes-divulgacao":              3,
  "atualizacao-material":          3,
  "conteudo-pdf-informativo":      3,
  "conteudo-pdf-ebook":            3,
  "apresentacao-nova":             3,
  "apresentacao-atualizar":        3,
  "pagina-assessores-dados":       3,
  "pagina-assessores-atualizacao": 3,
};

async function setGeneralCustomFields(
  taskId: string,
  tipo: string,
  subtipo: string,
  dados: FormDados,
  arquivos: ArquivosMap
): Promise<void> {
  const titulo = str(dados.titulo) || str(dados.nomeCompleto) || null;
  const publicoAlvo = str(dados.publico as string) || str(dados.publicoAlvo as string) || null;
  const arquivoPrincipal = arquivos.materialAtual || arquivos.arquivoBase || null;
  const arquivoApoio = arquivos.arquivoApoio || arquivos.fotoPerfil || null;

  // ── Campos short_text e text ───────────────────────────────────────────────
  const textFields: Array<{ id: string; value: unknown; label: string; clickupType: string }> = [
    { id: "6e36326f-2501-4ce2-9894-13d4ddf222d4", value: str(dados.nome) || null,        label: "Nome do solicitante", clickupType: "short_text" },
    { id: "b727b647-0da1-43a5-a82d-70c33dedf0fd", value: titulo,                         label: "Título",              clickupType: "short_text" },
    { id: "5d7ae6e5-8528-4df3-bf0c-ed3bb05ebee1", value: str(dados.finalidade) || null,  label: "Finalidade",          clickupType: "text" },
    { id: "c7585104-7f53-4dcb-95d6-c75d55c4c57b", value: publicoAlvo,                    label: "Público-alvo",        clickupType: "short_text" },
    { id: "ea38779d-385c-410b-972e-ba97499e9252", value: str(dados.canais) || null,       label: "Canais",              clickupType: "short_text" },
    { id: "f80ba423-ccae-464c-9d20-6665c7f1da00", value: str(dados.observacoes) || null, label: "Observações",         clickupType: "text" },
  ];

  // ── Campos short_text e text — paralelo ───────────────────────────────────
  await Promise.all(
    textFields
      .filter(({ value }) => {
        if (!value) { logger.warn({ taskId, label: "campo geral" }, "ClickUp: campo geral sem valor, pulando"); return false; }
        return true;
      })
      .map(({ id, value, label, clickupType }) =>
        setClickUpCustomField(taskId, id, value, label, { clickupType, raw: value })
      )
  );

  // ── Dropdown, prazo e arquivos — paralelo ──────────────────────────────────
  const tipoDemandaOrderindex = TIPO_DEMANDA_ORDERINDEX[tipo] ?? 3;
  const prazoRaw = str(dados.prazoEntrega as string);
  const prazoDate = prazoRaw ? new Date(prazoRaw + "T12:00:00") : null;
  if (prazoRaw && prazoDate && isNaN(prazoDate.getTime())) {
    logger.warn({ taskId, prazoRaw }, "ClickUp: data de prazo inválida, pulando");
  }

  await Promise.all([
    setClickUpCustomField(
      taskId, "ea901547-2f65-42ee-ab6c-5fbf0ceaa79b", tipoDemandaOrderindex, "Tipo de Demanda",
      { clickupType: "drop_down", raw: tipo }
    ),
    prazoDate && !isNaN(prazoDate.getTime())
      ? setClickUpCustomField(taskId, "33c5d4c5-1e0d-48ba-b0a5-6decdea6e138", prazoDate.getTime(), "Prazo de entrega", { clickupType: "date", raw: prazoRaw })
      : Promise.resolve(),
    arquivoPrincipal
      ? setClickUpCustomField(taskId, "294f47eb-82a7-416e-998e-ea79b77d296b", arquivoPrincipal, "Arquivo principal", { clickupType: "url" })
      : Promise.resolve(),
    arquivoApoio
      ? setClickUpCustomField(taskId, "67d565fd-ca4f-472b-969b-4b5228459e0f", arquivoApoio, "Arquivo de apoio", { clickupType: "url" })
      : Promise.resolve(),
  ]);
}

// ─────────────────────────────────────────────
// Custom-field payload builders (used in initial task creation POST)
// ─────────────────────────────────────────────

function buildEventosCustomFieldsArray(
  dados: FormDados,
  arquivos: ArquivosMap,
  user: UserData,
): Array<{ id: string; value: unknown }> {
  const fields: Array<{ id: string; value: unknown }> = [];
  const dadosLocal: Record<string, unknown> = { ...dados };

  const localHuman = humanizeLocal(dados);

  const cidadeRaw = str(dados.cidade as string);
  const estadoRaw = str(dados.estado as string);
  if (cidadeRaw) {
    const sigla = IBGE_SIGLA_MAP[estadoRaw] || estadoRaw;
    dadosLocal._cidadeFormatada = sigla ? `${cidadeRaw} - ${sigla}` : cidadeRaw;
  }

  const localEvento = str(dados.localEvento as string);
  if (localEvento === "unidade") {
    const UNIDADES_ENDERECOS: Record<string, string> = {
      "SVN Aracaju":              "R. Francisco Duarte Ramos, 34 - Jardins, Aracaju - SE",
      "SVN Campo Grande":         "Edifício Atrium - R. Euclides da Cunha, 1039 - Loja 3 - Jardim dos Estados",
      "SVN Cascavel":             "Av. Piquiri, 17 - Salas 01 e 02 - Centro",
      "SVN Cuiabá":               "R. Pres. Castelo Branco, 277 - Quilombo",
      "SVN Curitiba":             "Praça São Paulo da Cruz, 50 - Sala 1605 - Juveve, Curitiba - PR",
      "SVN Foz do Iguaçu":        "R. Alm. Barroso, 1139 - Centro",
      "SVN Londrina":             "Av. Higienópolis, 602 - Sala 2 - Centro, Londrina - PR",
      "SVN Maringá":              "Av. Cerro Azul, 123 - Zona 2, Maringá - PR",
      "SVN Salvador":             "Torre Nova York, Av. Tancredo Neves, 2539 - Sala 2104, Salvador - BA",
      "SVN São Paulo":            "Av. Dr. Cardoso de Melo, 1855 - Conjunto 51 - Vila Olímpia, São Paulo - SP",
      "SVN Toledo":               "Rua Nossa Senhora do Rocio, 2279 - Sala 02 - Jardim La Salle, Toledo - PR",
      "SVN Vitória da Conquista":  "Av. Jorge Teixeira, 29 - Salas 16 e 17",
    };
    const unidade = str(dados.unidadeSVN as string);
    const enderecoUnidade = UNIDADES_ENDERECOS[unidade];
    if (enderecoUnidade) dadosLocal.localEndereco = enderecoUnidade;
  }

  const materiaisArr = dados.materiais as string[] | undefined;
  const materiaisText = (Array.isArray(materiaisArr) && materiaisArr.length > 0)
    ? materiaisArr.map(id => `• ${MATERIAL_LABELS[id] || id}`).join("\n")
    : null;

  if (user.email) fields.push({ id: "ae56f16a-8d97-40e0-9032-c357eb0793ca", value: user.email });
  if (localHuman) fields.push({ id: "38ac133a-13b0-4428-98eb-adb5f8cdc23a", value: localHuman });
  if (materiaisText) fields.push({ id: "3266524c-febc-47ac-a76d-0d9c4256d9dc", value: materiaisText });

  for (const field of EVENTOS_CUSTOM_FIELDS) {
    let value: string | null;
    if (field.isArquivo) {
      const url = arquivos[field.dadosKey] || null;
      if (!url) continue;
      value = url;
    } else {
      const raw = field.dadosKey in dadosLocal ? dadosLocal[field.dadosKey] : dados[field.dadosKey];
      if (raw === undefined || raw === null || str(raw as string) === "") continue;
      if (field.dadosKey === "dataEvento") {
        value = formatDate(String(raw)) ?? String(raw);
      } else if (field.dadosKey === "natureza") {
        const n = str(raw as string).toLowerCase();
        value = n === "presencial" ? "Presencial" : n === "online" ? "Online" : str(raw as string);
      } else {
        value = str(raw as string);
      }
    }
    if (value !== null) fields.push({ id: field.id, value });
  }

  return fields;
}

function buildGeneralCustomFieldsArray(
  tipo: string,
  dados: FormDados,
  arquivos: ArquivosMap,
): Array<{ id: string; value: unknown }> {
  const fields: Array<{ id: string; value: unknown }> = [];

  const titulo = str(dados.titulo) || str(dados.nomeCompleto) || null;
  const publicoAlvo = str(dados.publico as string) || str(dados.publicoAlvo as string) || null;
  const arquivoPrincipal = arquivos.materialAtual || arquivos.arquivoBase || null;
  const arquivoApoio = arquivos.arquivoApoio || arquivos.fotoPerfil || null;

  const textPairs: Array<[string, unknown, string]> = [
    ["6e36326f-2501-4ce2-9894-13d4ddf222d4", str(dados.nome) || null,        "Nome do solicitante"],
    ["b727b647-0da1-43a5-a82d-70c33dedf0fd", titulo,                         "Título"],
    ["5d7ae6e5-8528-4df3-bf0c-ed3bb05ebee1", str(dados.finalidade) || null,  "Finalidade"],
    ["c7585104-7f53-4dcb-95d6-c75d55c4c57b", publicoAlvo,                    "Público-alvo"],
    ["ea38779d-385c-410b-972e-ba97499e9252", str(dados.canais) || null,       "Canais"],
    ["f80ba423-ccae-464c-9d20-6665c7f1da00", str(dados.observacoes) || null, "Observações"],
  ];

  for (const [id, value, label] of textPairs) {
    if (!value) { logger.warn({ label }, "ClickUp: campo geral sem valor, pulando"); continue; }
    fields.push({ id, value });
  }

  fields.push({ id: "ea901547-2f65-42ee-ab6c-5fbf0ceaa79b", value: TIPO_DEMANDA_ORDERINDEX[tipo] ?? 3 });

  const prazoRaw = str(dados.prazoEntrega as string);
  if (prazoRaw) {
    const prazoDate = new Date(prazoRaw + "T12:00:00");
    if (!isNaN(prazoDate.getTime())) {
      fields.push({ id: "33c5d4c5-1e0d-48ba-b0a5-6decdea6e138", value: prazoDate.getTime() });
    }
  }

  if (arquivoPrincipal) fields.push({ id: "294f47eb-82a7-416e-998e-ea79b77d296b", value: arquivoPrincipal });
  if (arquivoApoio) fields.push({ id: "67d565fd-ca4f-472b-969b-4b5228459e0f", value: arquivoApoio });

  return fields;
}

// ─────────────────────────────────────────────
// Core public functions
// ─────────────────────────────────────────────

async function getListId(tipoSolicitacao: string): Promise<string> {
  try {
    // 1) lista específica configurada para este tipo
    const [row] = await db
      .select({ list_id: tipoClickupListTable.list_id })
      .from(tipoClickupListTable)
      .where(eq(tipoClickupListTable.tipo, tipoSolicitacao));
    if (row?.list_id) {
      logger.info({ tipo: tipoSolicitacao, listId: row.list_id }, "ClickUp: lista por tipo (banco)");
      return row.list_id;
    }
    // 2) fallback configurável: linha "_default" (Geral), também editável na interface
    const [def] = await db
      .select({ list_id: tipoClickupListTable.list_id })
      .from(tipoClickupListTable)
      .where(eq(tipoClickupListTable.tipo, "_default"));
    if (def?.list_id) {
      logger.info({ tipo: tipoSolicitacao, listId: def.list_id }, "ClickUp: lista default (banco)");
      return def.list_id;
    }
  } catch (err) {
    logger.error({ err, tipo: tipoSolicitacao }, "getListId: erro ao ler config do banco");
  }
  // 3) fallback final hardcoded — segurança pra nunca enviar lista vazia
  logger.warn({ tipo: tipoSolicitacao, listId: CLICKUP_LIST_GERAL }, "ClickUp: usando lista default hardcoded (sem config no banco)");
  return CLICKUP_LIST_GERAL;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

const PRAZO_DIAS_UTEIS: Record<string, number> = {
  "pagina-assessores-dados":       3,
  "pagina-assessores-atualizacao": 2,
  "apresentacao-nova":             5,
  "apresentacao-atualizar":        5,
  "artes-divulgacao":              3,
  "atualizacao-material":          3,
  "conteudo-pdf-informativo":      4,
  "conteudo-pdf-ebook":            15,
  "pagina-online":                 5,
  "outro":                         7,
  "email-marketing":               3,
  "producao-video":                7,
  "sessao-fotos":                  7,
  "materiais-impressos":           5,
  "brindes":                       15,
  "patrocinio":                    30,
};


function proximaQuarta(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const dow = d.getDay();
  const diasAte = (3 - dow + 7) % 7 || 7;
  d.setDate(d.getDate() + diasAte);
  return d;
}

async function getAssigneesForTipo(tipo: string): Promise<Array<{ id: number; name: string }>> {
  try {
    const rows = await db
      .select({
        clickup_user_id: usersTable.clickup_user_id,
        name: usersTable.name,
      })
      .from(userTipoAssignmentsTable)
      .innerJoin(usersTable, eq(userTipoAssignmentsTable.user_id, usersTable.id))
      .where(eq(userTipoAssignmentsTable.tipo, tipo));
    return rows
      .map(r => ({ id: parseInt(r.clickup_user_id ?? "", 10), name: r.name ?? "" }))
      .filter(r => !isNaN(r.id));
  } catch (err) {
    logger.error({ err, tipo }, "getAssigneesForTipo: erro ao buscar assignees no DB");
    return [];
  }
}

export async function createClickUpTask(
  solicitacao: SolicitacaoData,
  user: UserData,
  dados: FormDados,
  arquivos?: ArquivosMap
): Promise<{ taskId: string | null; taskName: string; responsavel: string }> {
  if (!CLICKUP_API_TOKEN) {
    logger.warn("CLICKUP_API_TOKEN not configured, skipping task creation");
    return { taskId: null, taskName: "", responsavel: "" };
  }

  const tipo = solicitacao.tipo_solicitacao;

  if (FORM_SCHEMAS[tipo]?.has_clickup === false) {
    logger.info({ tipo }, "ClickUp: tipo sem integração, pulando");
    return { taskId: null, taskName: "", responsavel: "" };
  }
  const subtipo = solicitacao.subtipo || "";
  const safeArquivos = arquivos || {};
  const listId = await getListId(tipo);

  let taskName: string;
  let description: string;

  if (tipo === "eventos") {
    taskName = buildClickUpEventTaskName(dados);
    description = buildEventDescription(dados, user, safeArquivos);
  } else if (tipo === "cartao-visita-fisico") {
    taskName = `[Cartão de Visita] ${str(dados.nomeCartao) || user.name}`;
    description = buildCartaoFisicoDescription(dados, user);
  } else if (tipo === "patrocinio") {
    const cidade = str(dados.cidade);
    const tituloEv = str(dados.tituloEvento);
    taskName = cidade ? `[Patrocínio] ${tituloEv} - ${cidade}` : `[Patrocínio] ${tituloEv}`;
    description = buildPatrocinioDescription(dados, user, safeArquivos);
  } else if (tipo === "brindes") {
    const setor = getUserDepartment(user, dados);
    taskName = `[Brinde] ${user.name} - ${setor}`;
    description = buildBrindesDescription(dados, user, safeArquivos);
  } else if (tipo === "pagina-online") {
    const setor = getUserDepartment(user, dados);
    taskName = `[Página Online] ${str(dados.titulo)} - ${setor}`;
    description = buildPaginaOnlineDescription(dados, user, safeArquivos);
  } else if (tipo === "materiais-impressos") {
    const setor = getUserDepartment(user, dados);
    const tipoMat = str(dados.tipoMaterial) || str(dados.tipoImpresso) || "Material";
    const tipoLabel = tipoMat.charAt(0).toUpperCase() + tipoMat.slice(1);
    taskName = `[Material Impresso] ${tipoLabel} - ${setor}`;
    description = buildMateriaisImpressosDescription(dados, user, safeArquivos);
  } else if (tipo === "email-marketing") {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildEmailMarketingDescription(dados, user, safeArquivos);
  } else if (tipo === "producao-video" || tipo === "sessao-fotos") {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildProducaoAudiovisualDescription(dados, user, safeArquivos, tipo);
  } else if (tipo === "outro") {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildOutroDescription(dados, user, safeArquivos);
  } else {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildGeneralDescription(tipo, subtipo, dados, user, safeArquivos);
  }

  logger.info({ tipo, listId, taskName, descriptionLength: description.length }, "ClickUp: criando task");

  const taskPayload: Record<string, unknown> = { name: taskName, description };
  if (tipo === "eventos") taskPayload.status = "Solicitações";

  // Datas de início e prazo
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  taskPayload.start_date = hoje.getTime();
  taskPayload.start_date_time = false;

  let prazoDate: Date;
  if (tipo === "cartao-visita-fisico") {
    prazoDate = proximaQuarta();
  } else {
    let diasUteis = PRAZO_DIAS_UTEIS[tipo] ?? 3;
    if (tipo === "apresentacao-nova" || tipo === "apresentacao-atualizar") {
      const qtd = parseInt(String((dados as Record<string, unknown>).qtdPaginas || "0"), 10);
      if (qtd > 20) diasUteis = 15;
    }
    prazoDate = addBusinessDays(new Date(), diasUteis);
    prazoDate.setHours(12, 0, 0, 0);
  }
  taskPayload.due_date = prazoDate.getTime();
  taskPayload.due_date_time = false;
  logger.info({ tipo, prazo: prazoDate.toISOString() }, "ClickUp: prazo calculado");

  // Responsáveis por tipo (via DB)
  const assignees = await getAssigneesForTipo(tipo);
  if (assignees.length > 0) {
    taskPayload.assignees = assignees.map(a => a.id);
    logger.info({ assigneeIds: assignees.map(a => a.id), tipo }, "ClickUp: assignees definidos via DB");
  } else {
    logger.warn({ tipo }, "ClickUp: nenhum assignee encontrado no DB para este tipo");
  }

  // Agrupa todos os custom_fields no payload inicial (evita N PATCH requests pós-criação)
  const idSolicitacao = gerarIdSolicitacao(dados, tipo);
  const customFieldsBase: Array<{ id: string; value: unknown }> = [
    { id: "4a8493f1-dfc8-49b4-9372-f6df80d62816", value: idSolicitacao },
  ];
  const customFieldsSpecific = tipo === "eventos"
    ? buildEventosCustomFieldsArray(dados, safeArquivos, user)
    : buildGeneralCustomFieldsArray(tipo, dados, safeArquivos);
  taskPayload.custom_fields = [...customFieldsSpecific, ...customFieldsBase];

  logger.info({ tipo, listId, taskName, customFieldCount: (taskPayload.custom_fields as unknown[]).length }, "ClickUp: payload final antes do POST");

  let taskId: string | null = null;

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(taskPayload),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error({ tipo, listId, taskName, httpStatus: response.status, body: text }, "ClickUp: erro ao criar task");
      return { taskId: null, taskName, responsavel: "" };
    }
    const data = await response.json() as { id?: string };
    taskId = data.id || null;
  } catch (err) {
    logger.error({ err, tipo, listId }, "ClickUp: falha na criação da task");
    return { taskId: null, taskName, responsavel: "" };
  }

  if (!taskId) return { taskId: null, taskName, responsavel: "" };
  logger.info({ taskId, tipo, listId, taskName, idSolicitacao }, "ClickUp: task criada com sucesso");

  const responsavel = assignees.length > 0 ? assignees[0].name : "";

  return { taskId, taskName, responsavel };
}

export async function getClickUpTaskStatus(taskId: string): Promise<string | null> {
  if (!CLICKUP_API_TOKEN) return null;
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: { "Authorization": CLICKUP_API_TOKEN },
    });
    if (!response.ok) return null;
    const data = await response.json() as { status?: { status?: string } };
    return mapClickUpStatus(data.status?.status || "");
  } catch {
    return null;
  }
}

```

--- FILE: artifacts/api-server/src/routes/webhook.ts ---
```typescript
import crypto from "crypto";
import express, { Router } from "express";
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { mapClickUpStatus } from "../config/clickup-status";

const router = Router();

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

      if (solicitacao.status === 'gerando' || solicitacao.status === 'erro') {
        logger.info({ taskId, status: solicitacao.status }, "ClickUp webhook: status em render, ignorando");
        return;
      }

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

```

--- FILE: artifacts/api-server/src/services/art-generator.ts ---
```typescript
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, artTemplatesTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { uploadToR2 } from "../routes/r2";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "./template-renderer";
import { renderTemplateToPdf } from "./pdf-renderer";
import { FORM_SCHEMAS, FormSchema } from "../config/form-schemas";

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}

function buildRenderData(dados: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(dados)) {
    const strVal = String(value ?? "");
    result[key] = strVal;
    const snakeKey = camelToSnake(key);
    if (snakeKey !== key) result[snakeKey] = strVal;
  }
  return result;
}

function resolveComputed(
  dados: Record<string, unknown>,
  schema: FormSchema | undefined,
): Record<string, unknown> {
  if (!schema?.computed?.length) return dados;
  const result = { ...dados };
  for (const c of schema.computed) {
    if (!c.derived_from || !c.transform) continue;
    const source = String(dados[c.derived_from] ?? "");
    if (!source) continue;
    switch (c.transform) {
      case "digits_only": {
        let digits = source.replace(/\D/g, "");
        if (digits.length === 11 && !digits.startsWith("55")) {
          digits = "55" + digits;
        }
        result[c.name] = digits;
        break;
      }
      case "website_by_value":
      case "label_by_value":
        result[c.name] = c.lookup?.[source] ?? "";
        break;
    }
  }
  return result;
}

const TIPO_LABELS: Record<string, string> = {
  "cartao-comemorativo":   "Cartão Comemorativo",
  "cartao-visita-fisico":  "Cartão de Visita",
  "cartao-visita-digital": "Cartão Digital",
  "divulgacao-nps":        "Arte NPS",
  "convite-fp":            "Convite FP",
  "cartao-boas-vindas":    "Cartão de Boas-vindas",
  "assinatura-email":      "Assinatura de E-mail",
};

export async function gerarArteParaSolicitacao(
  solicitacaoId: number,
  tipo: string,
  dados: Record<string, unknown>,
): Promise<void> {
  logger.info({ solicitacaoId, tipo }, "[render] iniciando geração de arte (template-driven)");

  const formSchema = FORM_SCHEMAS[tipo];

  const resolvedDados = resolveComputed(dados, formSchema);

  const variantField = formSchema?.template_variant_field;
  const variantValue = variantField && resolvedDados[variantField] != null
    ? String(resolvedDados[variantField])
    : null;

  logger.info({
    tipo,
    variantField: variantField ?? null,
    variantValue,
    bodyKeys: Object.keys(resolvedDados),
  }, "[render] buscando template ativo");

  const templateWhere = variantValue
    ? and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true), eq(artTemplatesTable.variant_value, variantValue))
    : and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true), isNull(artTemplatesTable.variant_value));

  const [templateRow] = await db
    .select()
    .from(artTemplatesTable)
    .where(templateWhere)
    .orderBy(desc(artTemplatesTable.id))
    .limit(1);

  if (!templateRow) {
    logger.info({ solicitacaoId, tipo }, "[render] sem template ativo, pulando geração");
    return;
  }

  await db.update(solicitacoesTable)
    .set({ status: "gerando", updated_at: new Date() })
    .where(eq(solicitacoesTable.id, solicitacaoId));

  try {
    const renderData = buildRenderData(resolvedDados);
    logger.info({ solicitacaoId, tipo, keys: Object.keys(renderData) }, "[render] dados mapeados, renderizando");

    const config = templateRow.config as any;
    const outputFormat: "png" | "pdf" = config.output_format === "pdf" ? "pdf" : "png";

    let artBuffer: Buffer;
    let mimetype: string;
    let ext: string;

    if (outputFormat === "pdf") {
      artBuffer = await renderTemplateToPdf(config, renderData);
      mimetype = "application/pdf";
      ext = "pdf";
    } else {
      artBuffer = await renderFromTemplate(config, renderData);
      mimetype = "image/png";
      ext = "png";
    }

    const filename = `${tipo}-${solicitacaoId}-${Date.now()}.${ext}`;
    const tmpPath = path.join(os.tmpdir(), filename);
    await fs.promises.writeFile(tmpPath, artBuffer);

    const url = await uploadToR2(
      { path: tmpPath, originalname: `${tipo}.${ext}`, mimetype },
      solicitacaoId,
      tipo,
    );

    logger.info({ solicitacaoId, tipo, url }, "[r2] upload OK");

    const label = TIPO_LABELS[tipo] || tipo;
    await db.update(solicitacoesTable)
      .set({
        entrega_links: [{ label, url }],
        status: "concluido",
        erro_geracao: null,
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    logger.info({ solicitacaoId, tipo, url }, "Arte gerada e salva");
  } catch (error) {
    logger.error({ solicitacaoId, tipo, error }, "art generation failed");

    await db.update(solicitacoesTable)
      .set({
        status: "erro",
        erro_geracao: error instanceof Error ? error.message : String(error),
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    throw error;
  }
}

```

--- FILE: artifacts/api-server/src/config/form-schemas.ts ---
```typescript
export type FormFieldSchema = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'radio' | 'textarea' | 'file';
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type ComputedField = {
  name: string;
  label: string;
  derived_from?: string;
  transform?: 'digits_only' | 'website_by_value' | 'label_by_value';
  lookup?: Record<string, string>;
};

export type FormSchema = {
  tipo: string;
  label: string;
  description?: string;
  fields: FormFieldSchema[];
  computed?: ComputedField[];
  template_variant_field?: string;
  is_automation: boolean;
  has_clickup: boolean;
  has_approval_flow: boolean;
  has_downloadable_artifact: boolean;
};

export const CONTRATOS_OPTS = [
  { value: 'svn-investimentos', label: 'SVN Investimentos' },
  { value: 'svn-capital',       label: 'SVN Capital' },
  { value: 'svn-connect',       label: 'SVN Connect' },
];

export const MARCAS_OPTS = [
  { value: 'svn-investimentos',           label: 'SVN Investimentos' },
  { value: 'svn-capital',                 label: 'SVN Capital' },
  { value: 'svn-connect',                 label: 'SVN Connect' },
  { value: 'svn-gestao',                  label: 'SVN Gestão' },
  { value: 'svn-global',                  label: 'SVN Global' },
  { value: 'svn-imb',                     label: 'SVN Investment & Merchant Banking' },
  { value: 'svn-agro-cambio-commodities', label: 'SVN Agro, Câmbio & Commodities' },
  { value: 'svn-protecao-patrimonial',    label: 'SVN Proteção Patrimonial' },
  { value: 'svn-wealth-planning',         label: 'SVN Wealth Planning' },
];

export const CARGOS_OPTS = [
  { value: 'assessor',        label: 'Assessor de Investimentos' },
  { value: 'assessora',       label: 'Assessora de Investimentos' },
  { value: 'socio-assessor',  label: 'Sócio e Assessor de Investimentos' },
  { value: 'socia-assessora', label: 'Sócia e Assessora de Investimentos' },
];

// Fonte única de setores: nome (exibição/dropdown) + code (geração de ID no ClickUp).
// Adicione um setor novo APENAS aqui — a lista de nomes e o mapa de códigos
// são derivados automaticamente, então não há mais risco de desync.
export const SETORES = [
  { name: "Administração",                           code: "ADM" },
  { name: "Alocação",                                code: "ALO" },
  { name: "Aracaju",                                 code: "AJU" },
  { name: "Câmbio",                                  code: "CAM" },
  { name: "Campo Grande",                            code: "CGR" },
  { name: "Capital Humano",                          code: "RH" },
  { name: "Cascavel",                                code: "CVV" },
  { name: "Commodities",                             code: "CMO" },
  { name: "Connect",                                 code: "CONN" },
  { name: "Corporate",                               code: "COR" },
  { name: "Cuiabá",                                  code: "CBA" },
  { name: "Curitiba",                                code: "CTB" },
  { name: "Curitiba Digital",                        code: "CTBDGT" },
  { name: "Digital",                                 code: "DIG" },
  { name: "Financeiro",                              code: "FIN" },
  { name: "Foz do Iguaçu",                           code: "FOZ" },
  { name: "Institucional",                           code: "INST" },
  { name: "Jurídico",                                code: "JUR" },
  { name: "Londrina",                                code: "LDN" },
  { name: "Marketing",                               code: "MKT" },
  { name: "Marketing Digital",                       code: "MKTDGT" },
  { name: "Maringá",                                 code: "MGF" },
  { name: "Maringá Digital",                         code: "MGFDGT" },
  { name: "Middle",                                  code: "MID" },
  { name: "Performance",                             code: "PER" },
  { name: "Produto",                                 code: "PRO" },
  { name: "Proteção Patrimonial",                    code: "PPA" },
  { name: "Renda Fixa",                              code: "RF" },
  { name: "Renda Variável",                          code: "RV" },
  { name: "Salvador",                                code: "SSA" },
  { name: "São Paulo",                               code: "SAO" },
  { name: "São Paulo Digital",                       code: "SAODGT" },
  { name: "SVN Gestão",                              code: "GEST" },
  { name: "SVN Global",                              code: "GLO" },
  { name: "SVN Investment & Merchant Banking (M&A)", code: "IMB" },
  { name: "Toledo",                                  code: "TLD" },
  { name: "Universidade SVN",                        code: "USVN" },
  { name: "Vitória da Conquista",                    code: "VDC" },
  { name: "Wealth Planning",                         code: "WEAL" },
] as const;

// Lista de nomes — mantém compatibilidade com quem já consome SETORES_LIST
// (rota /form-schemas → dropdown do frontend).
export const SETORES_LIST: string[] = SETORES.map(s => s.name);

// Mapa nome → código, consumido pelo clickup.ts na geração do ID.
export const SETOR_CODIGO_MAP: Record<string, string> =
  Object.fromEntries(SETORES.map(s => [s.name, s.code]));

export const FORM_SCHEMAS: Record<string, FormSchema> = {
  'cartao-boas-vindas': {
    tipo: 'cartao-boas-vindas',
    label: 'Cartão de Boas-vindas',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',        label: 'Telefone',              type: 'tel',    required: true },
      { name: 'nome_cliente',    label: 'Nome do cliente',        type: 'text',   required: true },
      { name: 'nome_assinatura', label: 'Nome para assinatura',   type: 'text',   required: true },
      { name: 'unidade',         label: 'Unidade',                type: 'text',   required: true },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
      {
        name: 'is_private_key', label: 'Cliente Private?', type: 'radio', required: true,
        options: [
          { value: 'padrao',  label: 'Padrão' },
          { value: 'private', label: 'Private' },
        ],
      },
    ],
    computed: [
      { name: 'contrato_label', label: 'Contrato (label)', derived_from: 'contrato_social' },
    ],
    template_variant_field: 'is_private_key',
  },

  'cartao-visita-fisico': {
    tipo: 'cartao-visita-fisico',
    label: 'Cartão de Visita — Físico',
    is_automation: false,
    has_clickup: true,
    has_approval_flow: true,
    has_downloadable_artifact: false,
    fields: [
      { name: 'nome',            label: 'Nome completo',   type: 'text',   required: true },
      { name: 'whatsapp',        label: 'WhatsApp',         type: 'tel',    required: true },
      { name: 'email',           label: 'E-mail corporativo', type: 'email', required: true },
      { name: 'unidade',         label: 'Unidade',          type: 'text',   required: true },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
    ],
    computed: [
      { name: 'contrato_label', label: 'Contrato (label)', derived_from: 'contrato_social' },
    ],
  },

  'cartao-visita-digital': {
    tipo: 'cartao-visita-digital',
    label: 'Cartão de Visita — Digital',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    template_variant_field: 'contrato_social',
    fields: [
      { name: 'nome',            label: 'Nome completo',       type: 'text',   required: true },
      { name: 'telefone',        label: 'Telefone',             type: 'tel',    required: true },
      { name: 'email',           label: 'E-mail corporativo',   type: 'email',  required: true },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
      { name: 'foto_perfil', label: 'Foto de perfil', type: 'file' },
    ],
    computed: [
      {
        name: 'contrato_label', label: 'Contrato (label)',
        derived_from: 'contrato_social', transform: 'label_by_value',
        lookup: {
          'svn-investimentos': 'SVN Investimentos',
          'svn-connect':       'SVN Connect',
          'svn-capital':       'SVN Capital',
        },
      },
      { name: 'telefone_digits', label: 'Telefone (só dígitos + 55)', derived_from: 'telefone', transform: 'digits_only' },
      {
        name: 'site_url', label: 'URL do site da marca',
        derived_from: 'contrato_social', transform: 'website_by_value',
        lookup: {
          'svn-investimentos': 'https://svninvestimentos.com.br',
          'svn-connect':       'https://svnconnect.com.br',
          'svn-capital':       'https://svncapital.com.br',
        },
      },
    ],
  },

  'divulgacao-nps': {
    tipo: 'divulgacao-nps',
    label: 'Arte NPS',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',        label: 'Telefone',            type: 'tel',      required: true },
      { name: 'nome_assinatura', label: 'Nome para assinatura', type: 'text',    required: true },
      {
        name: 'cargo', label: 'Cargo', type: 'select', required: true,
        options: CARGOS_OPTS,
      },
      { name: 'agradecimento',   label: 'Mensagem de agradecimento', type: 'textarea', required: true },
      {
        name: 'modelo_arte', label: 'Modelo da arte', type: 'select', required: true,
        options: [
          { value: 'com-foto',  label: 'Com foto' },
          { value: 'sem-foto',  label: 'Sem foto' },
        ],
      },
      { name: 'foto_perfil', label: 'Foto de perfil', type: 'file' },
    ],
    template_variant_field: 'modelo_arte',
  },

  'convite-fp': {
    tipo: 'convite-fp',
    label: 'Convite Financial Planning',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',         label: 'Telefone',            type: 'tel',    required: true },
      { name: 'codigo_assessor',  label: 'Código do assessor',  type: 'text',   required: true },
      { name: 'nome_assinatura',  label: 'Nome para assinatura', type: 'text',  required: true },
      {
        name: 'cargo', label: 'Cargo', type: 'select', required: true,
        options: CARGOS_OPTS,
      },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
    ],
    computed: [
      { name: 'contrato_label', label: 'Contrato (label)', derived_from: 'contrato_social' },
    ],
  },


  'cartao-comemorativo': {
    tipo: 'cartao-comemorativo',
    label: 'Cartão Comemorativo',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',           label: 'Telefone',           type: 'tel',      required: true },
      { name: 'nome_aniversariante', label: 'Nome do aniversariante', type: 'text', required: true },
      {
        name: 'modelo_cartao', label: 'Modelo do cartão', type: 'select', required: true,
        options: [
          { value: 'dourado',   label: 'Dourado' },
          { value: 'vermelho',  label: 'Vermelho' },
        ],
      },
      { name: 'mensagem',           label: 'Mensagem',           type: 'textarea' },
      { name: 'assinatura',         label: 'Assinatura',         type: 'textarea' },
      { name: 'email_destinatario', label: 'E-mail do destinatário', type: 'email', required: true },
    ],
    template_variant_field: 'modelo_cartao',
  },

  'assinatura-email': {
    tipo: 'assinatura-email',
    label: 'Assinatura de E-mail',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    template_variant_field: 'marca',
    fields: [
      { name: 'nome',              label: 'Nome completo',    type: 'text',  required: true },
      { name: 'telefone',          label: 'Telefone',          type: 'tel',   required: true },
      { name: 'email',             label: 'E-mail corporativo', type: 'email', required: true },
      {
        name: 'marca', label: 'Marca / empresa', type: 'select', required: true,
        options: MARCAS_OPTS,
      },
      { name: 'cargo',             label: 'Cargo',             type: 'text',  required: true },
      {
        name: 'tem_cfp', label: 'Tem CFP?', type: 'radio', required: true,
        options: [
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ],
      },
    ],
    computed: [
      { name: 'marca_label', label: 'Marca (label)', derived_from: 'marca' },
    ],
  },
};

export const VALID_TIPOS: string[] = [
  "eventos",
  "artes-divulgacao",
  "atualizacao-material",
  "conteudo-pdf-informativo",
  "conteudo-pdf-ebook",
  "apresentacao-nova",
  "apresentacao-atualizar",
  "pagina-assessores-dados",
  "pagina-assessores-atualizacao",
  "assinatura-email",
  "cartao-visita-fisico",
  "cartao-visita-digital",
  "cartao-boas-vindas",
  "divulgacao-nps",
  "convite-fp",
  "pagina-online",
  "outro",
  "cartao-comemorativo",
  "brindes",
  "patrocinio",
  "email-marketing",
  "producao-video",
  "sessao-fotos",
  "materiais-impressos",
];

export const TIPOS_COM_CLICKUP: Array<{ tipo: string; label: string }> = [
  { tipo: "ch-kit-onboarding",      label: "Kit Onboarding" },
  { tipo: "ch-atualizacao-pessoas", label: "Atualização de Pessoas nos Sites" },
  { tipo: "ch-conteudo-pdf",        label: "Conteúdo em PDF (CH)" },
  { tipo: "ch-arte-divulgacao",     label: "Arte de Divulgação (CH)" },
  { tipo: "ch-atualizacao-books",   label: "Atualização de Books" },
  { tipo: "ch-linha-do-tempo",      label: "Linha do Tempo" },
  { tipo: "ch-aniversariantes",     label: "Aniversariantes do Mês" },
  { tipo: "eventos",                       label: "Eventos" },
  { tipo: "artes-divulgacao",              label: "Artes de Divulgação" },
  { tipo: "atualizacao-material",          label: "Atualização de Material" },
  { tipo: "conteudo-pdf-informativo",      label: "PDF — Informativo" },
  { tipo: "conteudo-pdf-ebook",            label: "PDF — Ebook" },
  { tipo: "apresentacao-nova",             label: "Apresentação — Nova" },
  { tipo: "apresentacao-atualizar",        label: "Apresentação — Atualização" },
  { tipo: "pagina-assessores-dados",       label: "Página de Assessores — Dados" },
  { tipo: "pagina-assessores-atualizacao", label: "Página de Assessores — Atualização" },
  { tipo: "cartao-visita-fisico",          label: "Cartão de Visita — Físico" },
  { tipo: "pagina-online",                 label: "Página Online" },
  { tipo: "outro",                         label: "Outro" },
  { tipo: "brindes",                       label: "Brindes" },
  { tipo: "patrocinio",                    label: "Patrocínio" },
  { tipo: "email-marketing",               label: "E-mail Marketing" },
  { tipo: "producao-video",                label: "Produção de Vídeo" },
  { tipo: "sessao-fotos",                  label: "Sessão de Fotos" },
  { tipo: "materiais-impressos",           label: "Materiais Impressos" },
];

export function getFormSchemaList() {
  return Object.values(FORM_SCHEMAS).map(s => {
    const variantField = s.template_variant_field;
    const variantOptions = variantField
      ? (s.fields.find(f => f.name === variantField)?.options ?? [])
      : [];
    return {
      tipo: s.tipo,
      label: s.label,
      description: s.description,
      template_variant_field: variantField ?? null,
      template_variant_options: variantOptions,
      is_automation: s.is_automation,
      has_clickup: s.has_clickup,
      has_approval_flow: s.has_approval_flow,
      has_downloadable_artifact: s.has_downloadable_artifact,
      placeholders: [
        ...s.fields.map(f => f.name),
        ...(s.computed || []).map(c => c.name),
      ],
    };
  });
}

```

--- FILE: lib/db/src/index.ts ---
```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";

```

--- FILE: artifacts/mockup-sandbox/src/App.tsx ---
```typescript
import { useEffect, useState, type ComponentType } from "react";

import { modules as discoveredModules } from "./.generated/mockup-components";

type ModuleMap = Record<string, () => Promise<Record<string, unknown>>>;

function _resolveComponent(
  mod: Record<string, unknown>,
  name: string,
): ComponentType | undefined {
  const fns = Object.values(mod).filter(
    (v) => typeof v === "function",
  ) as ComponentType[];
  return (
    (mod.default as ComponentType) ||
    (mod.Preview as ComponentType) ||
    (mod[name] as ComponentType) ||
    fns[fns.length - 1]
  );
}

function PreviewRenderer({
  componentPath,
  modules,
}: {
  componentPath: string;
  modules: ModuleMap;
}) {
  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setComponent(null);
    setError(null);

    async function loadComponent(): Promise<void> {
      const key = `./components/mockups/${componentPath}.tsx`;
      const loader = modules[key];
      if (!loader) {
        setError(`No component found at ${componentPath}.tsx`);
        return;
      }

      try {
        const mod = await loader();
        if (cancelled) {
          return;
        }
        const name = componentPath.split("/").pop()!;
        const comp = _resolveComponent(mod, name);
        if (!comp) {
          setError(
            `No exported React component found in ${componentPath}.tsx\n\nMake sure the file has at least one exported function component.`,
          );
          return;
        }
        setComponent(() => comp);
      } catch (e) {
        if (cancelled) {
          return;
        }

        const message = e instanceof Error ? e.message : String(e);
        setError(`Failed to load preview.\n${message}`);
      }
    }

    void loadComponent();

    return () => {
      cancelled = true;
    };
  }, [componentPath, modules]);

  if (error) {
    return (
      <pre style={{ color: "red", padding: "2rem", fontFamily: "system-ui" }}>
        {error}
      </pre>
    );
  }

  if (!Component) return null;

  return <Component />;
}

function getBasePath(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

function getPreviewExamplePath(): string {
  const basePath = getBasePath();
  return `${basePath}/preview/ComponentName`;
}

function Gallery() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">
          Component Preview Server
        </h1>
        <p className="text-gray-500 mb-4">
          This server renders individual components for the workspace canvas.
        </p>
        <p className="text-sm text-gray-400">
          Access component previews at{" "}
          <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
            {getPreviewExamplePath()}
          </code>
        </p>
      </div>
    </div>
  );
}

function getPreviewPath(): string | null {
  const basePath = getBasePath();
  const { pathname } = window.location;
  const local =
    basePath && pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  const match = local.match(/^\/preview\/(.+)$/);
  return match ? match[1] : null;
}

function App() {
  const previewPath = getPreviewPath();

  if (previewPath) {
    return (
      <PreviewRenderer
        componentPath={previewPath}
        modules={discoveredModules}
      />
    );
  }

  return <Gallery />;
}

export default App;

```

--- ESTRUTURA DE TABELAS (Se existir schema.ts) ---
