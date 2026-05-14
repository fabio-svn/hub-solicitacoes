import express, { type Express } from "express";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

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
app.use(express.static(publicDir));

app.get("/{*catchAll}", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
