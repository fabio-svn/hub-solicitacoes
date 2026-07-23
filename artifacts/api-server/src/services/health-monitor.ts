import { pool } from "@workspace/db";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "../lib/r2-client";
import { logger } from "../lib/logger";
import { sendAlert } from "./alert";

/*
 * health-monitor.ts — Vigia as dependências de infraestrutura (banco, R2) e
 * dispara um alerta na TRANSIÇÃO de estado (caiu / recuperou), não a cada ciclo.
 * Mesmo padrão do stuck-monitor: checkHealth() + startHealthMonitor().
 *
 * Cobre o caso "dependência caiu com o processo ainda vivo". O caso "o processo
 * inteiro morreu" é coberto por um monitor EXTERNO apontando para /healthz ou
 * /readyz (ver routes/health.ts) — esse não dá para alertar de dentro.
 *
 * Envs: HEALTH_CHECK_INTERVAL_MS (default 2 min), HEALTH_DISABLE_R2 (desliga o
 * check de R2 se algum dia der falso-positivo), ALERT_WEBHOOK_URL (ver alert.ts).
 */
const CHECK_INTERVAL_MS = parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || String(2 * 60 * 1000), 10);

type DepState = { up: boolean; since: number; lastError?: string };
const state: Record<string, DepState> = {};
let lastCheckAt = 0;

async function pingBanco(): Promise<void> {
  await pool.query("SELECT 1");
}
async function pingR2(): Promise<void> {
  const client = getR2Client();
  if (!client) throw new Error("R2 não configurado (getR2Client retornou null)");
  await client.send(new HeadBucketCommand({ Bucket: R2_BUCKET }));
}

const DEPS: { name: string; ping: () => Promise<void> }[] = [{ name: "banco", ping: pingBanco }];
if (R2_BUCKET && !process.env.HEALTH_DISABLE_R2) DEPS.push({ name: "armazenamento (R2)", ping: pingR2 });

async function checkOne(name: string, ping: () => Promise<void>): Promise<void> {
  let ok = true;
  let errMsg = "";
  try { await ping(); } catch (err) { ok = false; errMsg = err instanceof Error ? err.message : String(err); }

  const prev = state[name];
  if (!prev) {
    // Primeira observação: registra o estado; só alarma se já começar caído.
    state[name] = { up: ok, since: Date.now(), lastError: ok ? undefined : errMsg };
    if (!ok) await sendAlert({ service: name, level: "error", text: `indisponível no boot \u2014 ${errMsg}`, meta: { errMsg } });
    return;
  }
  if (prev.up && !ok) {
    state[name] = { up: false, since: Date.now(), lastError: errMsg };
    await sendAlert({ service: name, level: "error", text: `caiu \u2014 ${errMsg}`, meta: { errMsg } });
  } else if (!prev.up && ok) {
    const downMs = Date.now() - prev.since;
    const min = Math.max(1, Math.round(downMs / 60000));
    state[name] = { up: true, since: Date.now() };
    await sendAlert({ service: name, level: "info", text: `recuperado (ficou ~${min} min fora)`, meta: { downMs } });
  } else {
    // Sem mudança de estado: nada de alerta (dedup natural).
    state[name].lastError = ok ? undefined : errMsg;
  }
}

/* interno */ async function checkHealth(): Promise<void> {
  lastCheckAt = Date.now();
  for (const d of DEPS) {
    try { await checkOne(d.name, d.ping); } catch (err) { logger.error({ err, dep: d.name }, "health-monitor: erro inesperado"); }
  }
}

export function getHealthSnapshot(): {
  ok: boolean;
  checkedAt: string | null;
  deps: Record<string, { up: boolean; since: string; lastError?: string }>;
} {
  const deps: Record<string, { up: boolean; since: string; lastError?: string }> = {};
  let ok = true;
  for (const k of Object.keys(state)) {
    const s = state[k];
    deps[k] = { up: s.up, since: new Date(s.since).toISOString(), lastError: s.lastError };
    if (!s.up) ok = false;
  }
  return { ok, checkedAt: lastCheckAt ? new Date(lastCheckAt).toISOString() : null, deps };
}

export function startHealthMonitor(): void {
  setTimeout(() => { checkHealth().catch(() => {}); }, 30 * 1000);
  setInterval(() => { checkHealth().catch(() => {}); }, CHECK_INTERVAL_MS);
  logger.info(
    { intervalMs: CHECK_INTERVAL_MS, deps: DEPS.map((d) => d.name), alertWebhook: !!process.env.ALERT_WEBHOOK_URL },
    "health-monitor iniciado",
  );
}