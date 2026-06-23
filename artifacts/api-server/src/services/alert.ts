import { logger } from "../lib/logger";

/*
 * alert.ts — Canal de alerta de INFRAESTRUTURA, separado das notificações de
 * negócio (notifications.ts / N8N de marcos). Configure ALERT_WEBHOOK_URL com um
 * webhook dedicado (Telegram, Slack ou um fluxo N8N de alertas). Sem a env, o
 * alerta vai apenas para o log — nada quebra.
 *
 * O `text` já vem formatado para caber em Telegram/Slack; os campos extras
 * (service, level, meta) permitem ao N8N rotear/filtrar.
 */
const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || "";
const ENV = process.env.NODE_ENV || "production";

export type AlertLevel = "info" | "warn" | "error";

export async function sendAlert(opts: {
  service: string;
  level: AlertLevel;
  text: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { service, level, text, meta } = opts;
  const emoji = level === "error" ? "\u{1F534}" : level === "warn" ? "\u{1F7E1}" : "\u{1F7E2}";
  const linha = `${emoji} [Hub SVN/${ENV}] ${service}: ${text}`;

  // Sempre registra no log (fonte da verdade), mesmo que o webhook falhe ou não exista.
  if (level === "error") logger.error({ service, meta }, `[alert] ${text}`);
  else logger.warn({ service, meta }, `[alert] ${text}`);

  if (!ALERT_WEBHOOK_URL) return;

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 5000);
    await fetch(ALERT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: linha, service, level, env: ENV, meta: meta || {}, ts: new Date().toISOString() }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(to));
  } catch (err) {
    logger.error({ err, service }, "[alert] falha ao enviar alerta pelo webhook");
  }
}
