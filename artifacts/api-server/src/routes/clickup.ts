import { logger } from "../lib/logger";

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN || "";

const CLICKUP_LISTS: Record<string, string> = {
  "eventos": process.env.CLICKUP_LIST_EVENTOS || "901303299333",
  "identidade-pessoal": process.env.CLICKUP_LIST_GERAL || "901300673533",
  "marketing-conteudo": process.env.CLICKUP_LIST_GERAL || "901300673533",
  "audiovisual": process.env.CLICKUP_LIST_GERAL || "901300673533",
  "impressos": process.env.CLICKUP_LIST_GERAL || "901300673533",
  "obras-manutencao": process.env.CLICKUP_LIST_GERAL || "901300673533",
  "outros": process.env.CLICKUP_LIST_GERAL || "901300673533",
};

const CLICKUP_LIST_MAP: Record<string, string> = {
  "eventos": "eventos",
  "pagina-assessores-dados": "identidade-pessoal",
  "pagina-assessores-atualizacao": "identidade-pessoal",
  "artes-divulgacao": "marketing-conteudo",
  "apresentacao-nova": "marketing-conteudo",
  "apresentacao-atualizar": "marketing-conteudo",
  "conteudo-pdf-informativo": "marketing-conteudo",
  "conteudo-pdf-ebook": "marketing-conteudo",
  "atualizacao-material": "marketing-conteudo",
};

const CLICKUP_STATUS_MAP: Record<string, string> = {
  "to do": "recebido",
  "in progress": "em-producao",
  "waiting": "aguardando",
  "waiting on rh": "aguardando",
  "complete": "concluido",
  "cancelled": "cancelado",
};

const EVENTOS_CUSTOM_FIELDS: Array<{ label: string; id: string; dadosKey: string; isArquivo?: boolean; isDate?: boolean }> = [
  { label: "Nome do solicitante",              id: "92db4658-70d1-430e-98ec-5e27029136fd", dadosKey: "nome" },
  { label: "Data do evento",                   id: "361cb66a-8c99-43ec-a4fa-5a347e9a4fbd", dadosKey: "dataEvento", isDate: true },
  { label: "Origem do evento",                 id: "626bb697-d9eb-4e79-8277-8a7145e4b979", dadosKey: "origem" },
  { label: "Horário do evento",                id: "45d8babe-a7dd-4a78-952f-1aa366bf34ed", dadosKey: "horario" },
  { label: "Título do evento",                 id: "b40d49f5-341d-4671-a4f0-7cef7a643d6b", dadosKey: "nomeEvento" },
  { label: "O evento terá palestrantes?",      id: "8dbc39d5-f2e7-4669-be67-b1a24a53c2cf", dadosKey: "temPalestrante" },
  { label: "Palestrante 1 é colaborador SVN?", id: "28491235-89d7-4384-819c-66ca974d04a0", dadosKey: "palSvn1" },
  { label: "Nome do palestrante 1",            id: "5de3fdb1-3434-4820-92c8-6e7ee82cd3eb", dadosKey: "palNome1" },
  { label: "Cargo do palestrante 1",           id: "56fbcd07-eab1-465d-9055-8c5e6c0f39ac", dadosKey: "palCargo1" },
  { label: "Foto do palestrante 1",            id: "73d010f4-fb4b-4e00-bcf1-f550487c18fd", dadosKey: "palFoto1", isArquivo: true },
];

function getListId(tipoSolicitacao: string): string | null {
  const category = CLICKUP_LIST_MAP[tipoSolicitacao];
  if (!category) return null;
  return CLICKUP_LISTS[category] || null;
}

interface SolicitacaoData {
  tipo_solicitacao: string;
  subtipo?: string | null;
}

interface UserData {
  name: string;
  email: string;
}

interface FormDados {
  nomeEvento?: string;
  titulo?: string;
  nomeCompleto?: string;
  [key: string]: unknown;
}

export interface ArquivosMap {
  [campo: string]: string;
}

async function setClickUpCustomField(taskId: string, fieldId: string, value: unknown, label: string): Promise<void> {
  logger.info({ taskId, fieldId, label, value }, "ClickUp: tentando preencher custom field");

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      headers: {
        "Authorization": CLICKUP_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ taskId, fieldId, label, status: response.status, body: text }, "ClickUp: erro ao preencher custom field");
    } else {
      logger.info({ taskId, fieldId, label }, "ClickUp: custom field preenchido com sucesso");
    }
  } catch (err) {
    logger.error({ err, taskId, fieldId, label }, "ClickUp: excecao ao preencher custom field");
  }
}

async function setEventosCustomFields(taskId: string, dados: FormDados, arquivos: ArquivosMap): Promise<void> {
  for (const field of EVENTOS_CUSTOM_FIELDS) {
    let value: unknown;

    if (field.isArquivo) {
      value = arquivos[field.dadosKey] || null;
      if (!value) {
        logger.warn({ taskId, fieldId: field.id, label: field.label }, "ClickUp: campo de arquivo sem URL disponivel no payload");
        continue;
      }
    } else {
      const raw = dados[field.dadosKey];
      if (raw === undefined || raw === null || raw === "") {
        logger.warn({ taskId, fieldId: field.id, label: field.label, dadosKey: field.dadosKey }, "ClickUp: campo sem valor no payload, pulando");
        continue;
      }

      if (field.isDate) {
        const ts = new Date(String(raw)).getTime();
        value = isNaN(ts) ? String(raw) : ts;
      } else {
        value = String(raw);
      }
    }

    await setClickUpCustomField(taskId, field.id, value, field.label);
  }
}

export async function createClickUpTask(
  solicitacao: SolicitacaoData,
  user: UserData,
  dados: FormDados,
  arquivos?: ArquivosMap
): Promise<string | null> {
  if (!CLICKUP_API_TOKEN) {
    logger.warn("CLICKUP_API_TOKEN not configured, skipping task creation");
    return null;
  }

  const listId = getListId(solicitacao.tipo_solicitacao);
  if (!listId) {
    logger.warn({ tipo: solicitacao.tipo_solicitacao }, "No ClickUp list mapping found");
    return null;
  }

  const tipo = solicitacao.tipo_solicitacao;
  const subtipo = solicitacao.subtipo || "";
  const nome = dados.nomeEvento || dados.titulo || dados.nomeCompleto || "";
  const solicitante = user.name || user.email;

  const taskName = subtipo
    ? `[${tipo} ${subtipo}] ${nome} — ${solicitante}`
    : `[${tipo}] ${nome} — ${solicitante}`;

  const description = JSON.stringify(dados, null, 2);

  const category = CLICKUP_LIST_MAP[tipo] || "";
  const taskStatus = category === "eventos" ? "Solicitações" : "Para fazer";

  let taskId: string | null = null;

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: {
        "Authorization": CLICKUP_API_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: taskName,
        description,
        status: taskStatus,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, "ClickUp API error");
      return null;
    }

    const data = await response.json() as { id?: string };
    taskId = data.id || null;
  } catch (err) {
    logger.error({ err }, "ClickUp task creation failed");
    return null;
  }

  if (!taskId) return null;

  logger.info({ taskId, tipo }, "ClickUp: task criada com sucesso");

  if (tipo === "eventos") {
    await setEventosCustomFields(taskId, dados, arquivos || {});
  }

  return taskId;
}

export async function getClickUpTaskStatus(taskId: string): Promise<string | null> {
  if (!CLICKUP_API_TOKEN) return null;

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: { "Authorization": CLICKUP_API_TOKEN },
    });

    if (!response.ok) return null;

    const data = await response.json() as { status?: { status?: string } };
    const clickupStatus = data.status?.status?.toLowerCase() || "";
    return CLICKUP_STATUS_MAP[clickupStatus] || null;
  } catch {
    return null;
  }
}
