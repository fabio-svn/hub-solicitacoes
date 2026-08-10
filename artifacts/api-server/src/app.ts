import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import pinoHttp from "pino-http";
import { logAtividadeBg } from "./services/activity-log";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import router from "./routes";
import authRouter from "./routes/auth";
import { MARCAS_OPTS, CONTRATOS_OPTS, SETORES_LIST, CARGOS_OPTS } from "./config/form-schemas";
import { UNIDADES } from "./config/unidades";
import { TIPOS_AUTOMACAO } from "./config/tipos";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { ApiError } from "./utils/api-error";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Aguarde alguns segundos e tente novamente." },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Limite de requests atingido. Aguarde um momento." },
});

app.use(compression());

app.use(
  pinoHttp({
    logger,
    /* CODIGO-DE-ERRO: o id padrao do pino-http e um contador que reinicia junto
       com o processo — dois erros diferentes podiam ser "req.id 76". Um codigo
       curto e aleatorio da para a pessoa ditar por telefone e para voce achar no
       log com um grep, sem ambiguidade entre reinicios. */
    genReqId: () => Math.random().toString(36).slice(2, 8).toUpperCase(),
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
// O webhook do ClickUp valida a assinatura HMAC sobre o corpo CRU (Buffer). Se o
// express.json() parsear o corpo antes, ele vira objeto e o crypto.update() quebra
// (ERR_INVALID_ARG_TYPE → 500, e o ClickUp fica re-tentando). Por isso o parser global
// pula essa rota; o próprio webhook tem o seu express.raw() para receber o corpo cru.
const _jsonParser = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  if (req.path === "/api/webhook/clickup") return next();
  _jsonParser(req, res, next);
});
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
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias (rolling renova a cada uso)
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
    emailUpload: process.env.EMAIL_UPLOAD || "",
    urlVideoHero: process.env.URL_VIDEO_HERO || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/bg-eventos-2.mp4",
    urlLogoBranca: process.env.URL_LOGO_BRANCA || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-2.svg",
    urlLogoPreta: process.env.URL_LOGO_PRETA || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-1.svg",
    urlManual: process.env.URL_MANUAL || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/Manual-de-Eventos-SVN.pdf",
    urlTutorialTransmissao: process.env.URL_TUTORIAL_TRANSMISSAO || "https://drive.google.com/file/d/1L36fFqFC-sEPWggNmlZOUNnY2DqxP8HK/view?usp=sharing",
    marcas: MARCAS_OPTS,
    contratos: CONTRATOS_OPTS,
    setores: SETORES_LIST,
    cargos: CARGOS_OPTS,
    unidades: UNIDADES,
    tiposAutomacao: TIPOS_AUTOMACAO,
  });
});

app.use("/auth", authLimiter);
app.use("/api", apiLimiter);
app.use("/api", router);
app.use("/auth", authRouter);

const publicDir = path.resolve(__dirname, "../public");
// "Home" (index.html) descontinuada — a landing e a pagina de solicitacoes.
app.get(["/", "/index.html"], (_req, res) => res.redirect("/solicitacoes.html"));
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }
  },
}));
// Rota que nao casou com nada: se for pedido de pagina, devolve o 404 do Hub em
// vez do "Cannot GET /xyz" cru do Express. Requisicoes de API seguem em JSON.
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/") || req.path.startsWith("/auth/")) return next();
  if (req.path.includes(".") && !req.path.endsWith(".html")) return next();
  res.status(404).sendFile(path.join(publicDir, "404.html"));
});


const fontsDir = path.resolve(__dirname, "../assets/fonts");
app.use('/fonts', express.static(fontsDir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

app.get("/{*catchAll}", (_req, res) => {
  res.redirect("/solicitacoes.html");
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
  /* MULTER-NAO-E-UNHANDLED: as outras rotas com upload (assets, corporate,
     admin) ainda usam o multer cru. Sem este ramo, um arquivo grande demais
     entrava no log como "Unhandled error" e voltava 500, escondendo um caso
     previsto entre as falhas de verdade. */
  if ((err as any)?.name === "MulterError") {
    const code = (err as any).code as string;
    const field = (err as any).field as string | undefined;
    req.log?.warn({ code, field }, "Upload recusado pelo limite");
    res.status(code === "LIMIT_FILE_SIZE" ? 413 : 400).json({
      error: code === "LIMIT_FILE_SIZE"
        ? "Arquivo acima do limite aceito neste envio."
        : "Nao foi possivel receber o arquivo enviado.",
      code,
    });
    return;
  }
  /* UPLOAD-TRUNCADO: o busboy (parser do multer) lanca Error comum — nao
     MulterError — quando a conexao cai no meio do multipart ("Unexpected end
     of form" e parentes). Sem este ramo, envio interrompido pelo lado do
     usuario virava 500 "Erro interno" com codigo, assustando quem so perdeu
     sinal no upload e poluindo o log com falso alarme. */
  const msgBusboy = String((err as any)?.message || "");
  if (
    msgBusboy === "Unexpected end of form" ||
    msgBusboy === "Unexpected end of multipart data" ||
    msgBusboy.startsWith("Malformed part header")
  ) {
    req.log?.warn({ msg: msgBusboy }, "Upload interrompido pelo cliente (multipart truncado)");
    logAtividadeBg({
      userEmail: (req as any).session?.user?.email || "(sem sessao)",
      userName: (req as any).session?.user?.name || "",
      tipo: "upload_interrompido",
      nivel: "warn",
      detalhe: `Envio interrompido pela conexao em ${req.method} ${req.originalUrl}`,
    });
    res.status(400).json({
      error: "O envio foi interrompido antes de terminar. Verifique a conex\u00e3o e tente novamente. No celular, prefira Wi-Fi para enviar fotos.",
      code: "UPLOAD_INTERROMPIDO",
    });
    return;
  }

  req.log?.error({ err }, "Unhandled error");
  /* O codigo vai junto na resposta: e o unico fio entre "deu erro na minha tela"
     e a linha certa do log. So no 500 — os outros erros ja dizem o que houve. */
  res.status(500).json({
    error: process.env.NODE_ENV !== "production" ? ((err as any).message || "Erro interno do servidor") : "Erro interno do servidor",
    ref: req.id,
  });
});

export default app;