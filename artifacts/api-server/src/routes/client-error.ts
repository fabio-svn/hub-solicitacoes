import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.middleware";
import { logAtividadeBg } from "../services/activity-log";

/**
 * ERRO-DO-NAVEGADOR
 *
 * Um erro de JavaScript no front deixava a pagina quebrada em silencio: o botao
 * parava de responder e ninguem ficava sabendo — nem quem estava usando, nem a
 * equipe. Todo o cuidado do backend (ApiError, health-monitor, alert) nao
 * enxergava nada do lado do navegador.
 *
 * Esta rota e o outro lado da ponte do public/utils.js. Ela nunca devolve erro:
 * relatar falha nao pode virar mais uma falha.
 */
const router: IRouter = Router();

// O apiLimiter global ja cobre /api (300/min). Este e mais apertado porque um
// erro dentro de um laco de render pode disparar em rajada.
const limiteRelato = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: true },
});

const corta = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max) : undefined;

router.post("/client-error", limiteRelato, requireAuth, (req, res): void => {
  // 204 sempre, inclusive se o corpo vier torto: quem chama aqui ja esta com
  // problema, e nao pode receber outro.
  res.status(204).end();

  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const mensagem = corta(b.mensagem, 300) || "(sem mensagem)";
    const origem = corta(b.origem, 300) || "";

    // LOG-CATEGORIAS: telemetria de terceiros bloqueada no navegador (adblock,
    // anti-tracking) e ruido constante sem valor diagnostico — nao vira registro.
    // Falha de script proprio continua registrando: e sinal real de incidente.
    const TELEMETRIA_IGNORADA = [
      "cloudflareinsights.com",
      "googletagmanager.com",
      "google-analytics.com",
      "clarity.ms",
      "hotjar.com",
    ];
    if (TELEMETRIA_IGNORADA.some((d) => origem.includes(d))) return;
    const user = req.session?.user;

    logAtividadeBg({
      userEmail: user?.email || "(sem sessao)",
      userName: user?.name || "",
      tipo: "erro_navegador",
      nivel: "error",
      detalhe: `${mensagem} — em ${origem}`,
      metadata: {
        tipo: corta(b.tipo, 40),
        origem,
        linha: typeof b.linha === "number" ? b.linha : undefined,
        stack: corta(b.stack, 1500),
        userAgent: corta(req.get("user-agent"), 300),
      },
    });
  } catch {
    // silencio proposital
  }
});

export default router;
