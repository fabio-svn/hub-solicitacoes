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
import formsRouter from "./routes/forms";
import adminRouter from "./routes/admin";
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

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
    saveUninitialized: false,
    cookie: {
      maxAge: 8 * 60 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);
app.use("/auth", authRouter);
app.use("/api", formsRouter);
app.use("/api/admin", adminRouter);

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));

app.get("/{*catchAll}", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
    return next();
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
