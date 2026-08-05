function normalizeStatusKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/* interno */ const CLICKUP_STATUS_MAP: Record<string, string> = {
  "backlog":                    "em-analise",
  "to do":                      "recebido",
  "recebido":                   "recebido",
  "in progress":                "em-producao",
  "em analise":                 "em-analise",
  "em andamento":               "em-producao",
  "em producao":                "em-producao",
  "em producao.":               "em-producao",
  "em revisao":                 "em-revisao",
  "em aprovacao":               "em-aprovacao",
  "alinhamentos":               "alinhamentos",
  "cotacao-aprovacao":          "cotacao-aprovacao",
  "cotacao aprovacao":          "cotacao-aprovacao",
  "em cotacao / aprovacao":     "cotacao-aprovacao",
  "em cotacao":                 "cotacao-aprovacao",
  "aguardando":                 "aguardando",
  "aguardando informacao":      "aguardando",
  "aguardando informacao.":     "aguardando",
  "waiting":                    "aguardando",
  "waiting on rh":              "aguardando",
  "aguardando rh":              "aguardando-rh",
  "aguardando pagamento":       "aguardando-pagamento",
  "aguardando finalizacao":     "aguardando-finalizacao",
  "em espera":                  "em-espera",
  "aguardando validacao":       "aguardando-validacao",
  "em validacao":               "aguardando-validacao",
  "aguardando contrato":        "aguardando-contrato",
  "em contrato":                "aguardando-contrato",
  "validado":                   "validado",
  "envio grafica":              "envio-grafica",
  "envio assessor":             "envio-assessor",
  "complete":                   "concluido",
  "concluido":                  "concluido",
  "done":                       "concluido",
  "closed":                     "concluido",
  "cancelled":                  "cancelado",
  "canceled":                   "cancelado",
  "cancelado":                  "cancelado",
  "aprovado":                   "aprovado",
  "reprovado":                  "reprovado",
  "reprovado / cancelado":      "reprovado",
};

// STATUS-DESCONHECIDO-ALERTA: quando o ClickUp manda um status que o mapa nao
// conhece, o Hub o ignora (a solicitacao mantem o status anterior). Isso e
// seguro — nao quebra nada — mas era SILENCIOSO: ninguem descobria que uma etapa
// nova do ClickUp nao estava mapeada ate um usuario estranhar. Agora registramos
// um aviso (uma vez por status, para nao floodar o log a cada sincronizacao).
const _statusDesconhecidosVistos = new Set<string>();

export function mapClickUpStatus(raw: string): string | null {
  const chave = normalizeStatusKey(raw);
  const mapeado = CLICKUP_STATUS_MAP[chave] || null;
  if (!mapeado && chave && !_statusDesconhecidosVistos.has(chave)) {
    _statusDesconhecidosVistos.add(chave);
    // import tardio evita ciclo de dependencia com o logger
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { logger } = require("../lib/logger");
      logger.warn(
        { statusClickUp: raw, chaveNormalizada: chave },
        "ClickUp enviou um status que o Hub nao reconhece — a solicitacao ficara no status anterior. " +
        "Adicione este status ao CLICKUP_STATUS_MAP em src/config/clickup-status.ts."
      );
    } catch { /* sem logger disponivel: segue silencioso, como antes */ }
  }
  return mapeado;
}
