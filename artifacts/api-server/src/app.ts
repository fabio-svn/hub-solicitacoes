import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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
import { MARCAS_OPTS, CONTRATOS_OPTS, SETORES_LIST, CARGOS_OPTS } from "./config/form-schemas";
import { UNIDADES } from "./config/unidades";
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
    marcas: MARCAS_OPTS,
    contratos: CONTRATOS_OPTS,
    setores: SETORES_LIST,
    cargos: CARGOS_OPTS,
    unidades: UNIDADES,
  });
});

app.use("/auth", authLimiter);
app.use("/api", apiLimiter);
app.use("/api", router);
app.use("/auth", authRouter);

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\.(js|css|woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/i.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
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
  req.log?.error({ err }, "Unhandled error");
  res.status(500).json({
    error: process.env.NODE_ENV !== "production" ? ((err as any).message || "Erro interno do servidor") : "Erro interno do servidor",
  });
});

export default app;
