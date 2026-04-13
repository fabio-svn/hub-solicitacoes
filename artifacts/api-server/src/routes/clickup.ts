import { logger } from "../lib/logger";

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN || "";

const CLICKUP_LISTS: Record<string, string> = {
  "eventos": "901303299333",
  "identidade-pessoal": "901300673533",
  "marketing-conteudo": "901300673533",
  "audiovisual": "901300673533",
  "impressos": "901300673533",
  "obras-manutencao": "901300673533",
  "outros": "901300673533",
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

function getListId(tipoSolicitacao: string): string | null {
  const category = CLICKUP_LIST_MAP[tipoSolicitacao];
  if (!category) return null;
  return CLICKUP_LISTS[category] || null;
}

export async function createClickUpTask(solicitacao: any, user: any, dados: any): Promise<string | null> {
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
        status: "to do",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, body: text }, "ClickUp API error");
      return null;
    }

    const data = await response.json();
    return data.id || null;
  } catch (err) {
    logger.error({ err }, "ClickUp task creation failed");
    return null;
  }
}

export async function getClickUpTaskStatus(taskId: string): Promise<string | null> {
  if (!CLICKUP_API_TOKEN) return null;

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: { "Authorization": CLICKUP_API_TOKEN },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const clickupStatus = data.status?.status?.toLowerCase() || "";
    return CLICKUP_STATUS_MAP[clickupStatus] || null;
  } catch {
    return null;
  }
}
