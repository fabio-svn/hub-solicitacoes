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

const IBGE_STATE_MAP: Record<string, string> = {
  "12": "Acre", "27": "Alagoas", "16": "Amapá", "13": "Amazonas",
  "29": "Bahia", "23": "Ceará", "53": "Distrito Federal", "32": "Espírito Santo",
  "52": "Goiás", "21": "Maranhão", "51": "Mato Grosso", "50": "Mato Grosso do Sul",
  "31": "Minas Gerais", "15": "Pará", "25": "Paraíba", "41": "Paraná",
  "26": "Pernambuco", "22": "Piauí", "33": "Rio de Janeiro", "24": "Rio Grande do Norte",
  "43": "Rio Grande do Sul", "11": "Rondônia", "14": "Roraima", "42": "Santa Catarina",
  "35": "São Paulo", "28": "Sergipe", "17": "Tocantins",
};

interface FieldDef {
  label: string;
  id: string;
  dadosKey: string;
  isArquivo?: boolean;
  isDate?: boolean;
  isNumber?: boolean;
}

const EVENTOS_CUSTOM_FIELDS: FieldDef[] = [
  { label: "Nome do solicitante",              id: "92db4658-70d1-430e-98ec-5e27029136fd", dadosKey: "nome" },
  { label: "Data do evento",                   id: "361cb66a-8c99-43ec-a4fa-5a347e9a4fbd", dadosKey: "dataEvento",       isDate: true },
  { label: "Origem do evento",                 id: "626bb697-d9eb-4e79-8277-8a7145e4b979", dadosKey: "origem" },
  { label: "Horário do evento",                id: "45d8babe-a7dd-4a78-952f-1aa366bf34ed", dadosKey: "horario" },
  { label: "Título do evento",                 id: "b40d49f5-341d-4671-a4f0-7cef7a643d6b", dadosKey: "nomeEvento" },
  { label: "O evento terá palestrantes?",      id: "8dbc39d5-f2e7-4669-be67-b1a24a53c2cf", dadosKey: "temPalestrante" },
  { label: "Palestrante 1 — colaborador SVN?", id: "28491235-89d7-4384-819c-66ca974d04a0", dadosKey: "palSvn1" },
  { label: "Palestrante 1 — Nome",             id: "5de3fdb1-3434-4820-92c8-6e7ee82cd3eb", dadosKey: "palNome1" },
  { label: "Palestrante 1 — Cargo",            id: "56fbcd07-eab1-465d-9055-8c5e6c0f39ac", dadosKey: "palCargo1" },
  { label: "Palestrante 1 — Foto",             id: "73d010f4-fb4b-4e00-bcf1-f550487c18fd", dadosKey: "palFoto1",         isArquivo: true },
  { label: "Natureza",                         id: "1e31ee81-8b88-4cfc-b8c1-754a94f5f084", dadosKey: "natureza" },
  { label: "Nível de maturidade",              id: "1fe629c6-9cf4-4576-8828-bc93aae0d335", dadosKey: "maturidade" },
  { label: "Tipo de evento",                   id: "b0261bc8-2ead-4820-9df9-6475c35cb182", dadosKey: "tipoEvento" },
  { label: "Público-alvo",                     id: "5ffdf7e3-cde1-465c-a186-1b24d0f6b395", dadosKey: "publico" },
  { label: "Número de convidados",             id: "d676846e-b66c-4c71-8173-7378d9db1f95", dadosKey: "convidados",       isNumber: true },
  { label: "Custo estimado",                   id: "de09cf5f-3e69-48de-bb7f-bececcf55f95", dadosKey: "custoEstimado" },
  { label: "Rateio",                           id: "7ce379f3-fc8c-4ba4-a814-829694df1d07", dadosKey: "rateio" },
  { label: "Endereço do local externo",        id: "78816dd7-89b1-470b-a812-8716cd4b8ebf", dadosKey: "localEndereco" },
  { label: "Canal de transmissão",             id: "83420339-a502-4a47-ac02-17c5cb5f17c2", dadosKey: "canal" },
  { label: "Link de transmissão",              id: "3ff627f5-84ed-4bcf-90e7-1b1bb73810bd", dadosKey: "linkTransmissao" },
  { label: "Ideia / Quando",                   id: "ee61335f-97d0-4f9a-91db-675aa7697671", dadosKey: "ideaQuando" },
  { label: "Logo complementar de parceiro",    id: "ecd1b31c-d6a4-4e20-bbb8-48297caf816a", dadosKey: "logoFile",         isArquivo: true },
  { label: "Palestrante 2 — colaborador SVN?", id: "9c1d3dbe-39cf-4a84-a67b-2d33ffd6bffe", dadosKey: "palSvn2" },
  { label: "Palestrante 2 — Nome",             id: "281def01-58e4-4d21-8b0e-f8bd792d947e", dadosKey: "palNome2" },
  { label: "Palestrante 2 — Cargo",            id: "52391024-c4f3-4999-983a-53492e8069a5", dadosKey: "palCargo2" },
  { label: "Palestrante 2 — Foto",             id: "00b1cf20-bb99-4f93-bd7b-6e06cf28e84a", dadosKey: "palFoto2",         isArquivo: true },
  { label: "Palestrante 3 — Nome",             id: "ea476985-2ec4-4a06-8e33-9d6a70ddd07a", dadosKey: "palNome3" },
  { label: "Palestrante 3 — Cargo",            id: "f32b20cc-01a6-443e-a5ac-91aaee4fa9b2", dadosKey: "palCargo3" },
  { label: "Palestrante 3 — Foto",             id: "53981c0c-20ef-45e9-bf11-8f95261dd4ce", dadosKey: "palFoto3",         isArquivo: true },
  { label: "Palestrante 4 — Nome",             id: "a128e306-f734-423c-8971-9fd4ca66e354", dadosKey: "palNome4" },
  { label: "Palestrante 4 — Cargo",            id: "e76af56c-0cf8-4274-970c-93333c6c2f86", dadosKey: "palCargo4" },
  { label: "Palestrante 4 — Foto",             id: "2ad7d8c4-bc0d-4925-818e-cc24bedca0bc", dadosKey: "palFoto4",         isArquivo: true },
];

const MATERIAL_LABELS: Record<string, string> = {
  "pacote-padrao":               "Pacote de Divulgação Padrão",
  "pacote-personalizado":        "Pacote de Divulgação Personalizado",
  "banner-impresso":             "Banner Impresso",
  "flyer":                       "Flyer",
  "brindes-store":               "Brindes (solicitar na Store)",
  "brindes-personalizados":      "Brindes Personalizados",
  "captacao-audiovisual":        "Captação Audiovisual",
  "coffee-break":                "Coffee Break ou Coquetel",
  "instagram":                   "Divulgação no Instagram da SVN",
  "email-marketing":             "E-mail Marketing",
  "equipe-staff":                "Equipe Staff (Marketing)",
  "jantar-almoco":               "Jantar / Almoço (Restaurante)",
  "pagina-sorteio":              "Página para Sorteio",
  "projeto-stand":               "Projeto de Stand",
  "pacote-padrao-online":        "Pacote de Divulgação Padrão (online)",
  "pacote-personalizado-online": "Pacote de Divulgação Personalizado (online)",
  "instagram-online":            "Divulgação no Instagram da SVN (online)",
  "link-youtube-online":         "Link da live no Youtube",
  "apoio-live-online":           "Apoio em live",
  "email-marketing-online":      "E-mail Marketing (online)",
};

const MATERIAL_COND_LABELS: Record<string, Record<string, string>> = {
  "pacote-personalizado":        { personConvite: "O que personalizar no convite", personPagina: "O que incluir na página de inscrição" },
  "pacote-personalizado-online": { personConvite: "O que personalizar no convite", personPagina: "O que incluir na página de inscrição" },
  "banner-impresso":             { tamanho: "Tamanho", conteudo: "Conteúdo" },
  "flyer":                       { tipo: "Tipo", tamanho: "Tamanho", conteudo: "Conteúdo" },
  "brindes-personalizados":      { descricao: "Descrição do brinde" },
  "captacao-audiovisual":        { tipo: "Tipo de captação" },
  "instagram":                   { formaDiv: "Forma de divulgação", arroba: "Perfil" },
  "instagram-online":            { formaDiv: "Forma de divulgação", arroba: "Perfil" },
  "email-marketing":             { conteudo: "Conteúdo do e-mail" },
  "email-marketing-online":      { conteudo: "Conteúdo do e-mail" },
  "apoio-live-online":           { descricao: "Tipo de apoio" },
  "pagina-sorteio":              { premioDefinido: "Prêmio definido", descricao: "Descrição do prêmio" },
  "projeto-stand":               { materiais: "Materiais necessários" },
};

interface SolicitacaoData {
  tipo_solicitacao: string;
  subtipo?: string | null;
}

interface UserData {
  name: string;
  email: string;
  role?: string;
}

interface FormDados {
  nomeEvento?: string;
  titulo?: string;
  nomeCompleto?: string;
  materiais?: unknown;
  materiaisDetalhes?: unknown;
  [key: string]: unknown;
}

export interface ArquivosMap {
  [campo: string]: string;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function addLine(items: string[], label: string, value: string | null | undefined): void {
  const v = str(value);
  if (v) items.push(`• ${label}: ${v}`);
}

function formatDate(raw: string | undefined): string | null {
  const s = str(raw);
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function humanizeEstado(raw: string | undefined): string | null {
  const s = str(raw);
  if (!s) return null;
  const mapped = IBGE_STATE_MAP[s];
  if (!mapped) {
    logger.warn({ raw: s }, "ClickUp: estado nao encontrado no mapa IBGE, mantendo valor original");
    return s;
  }
  return mapped;
}

function humanizeLocal(dados: FormDados): string | null {
  const localEvento = str(dados.localEvento);
  if (!localEvento) return null;
  if (localEvento === "unidade") {
    const unidade = str(dados.unidadeSVN);
    return unidade ? `Unidade SVN — ${unidade}` : "Unidade SVN";
  }
  if (localEvento === "externo") {
    const nome = str(dados.localNome);
    const endereco = str(dados.localEndereco);
    const parts = [nome, endereco].filter(Boolean);
    return parts.length ? parts.join(" — ") : "Local externo (não especificado)";
  }
  if (localEvento === "nao-definido") {
    return "Local ainda não definido";
  }
  return null;
}

function buildRequesterSection(user: UserData): string {
  const items: string[] = [];
  items.push(`• Solicitante: ${user.name}`);
  items.push(`• E-mail: ${user.email}`);
  logger.info({ nome: user.name, email: user.email }, "ClickUp: bloco solicitante montado (telefone e unidade nao disponivel na sessao atual)");
  return `👤 Solicitante\n\n${items.join("\n")}`;
}

function buildResumoSection(dados: FormDados): string {
  const naturezaRaw = str(dados.natureza);
  const natureza = naturezaRaw === "presencial" ? "Presencial"
    : naturezaRaw === "online" ? "Online"
    : naturezaRaw || null;

  const tipoAproxRaw = str(dados.tipoAprox);
  const tipoAprox = tipoAproxRaw === "ao-vivo" ? "Ao vivo"
    : tipoAproxRaw === "gravado" ? "Gravado"
    : tipoAproxRaw || null;

  const items: string[] = [];
  addLine(items, "Natureza", natureza);
  addLine(items, "Nível de maturidade", str(dados.maturidade));
  addLine(items, "Título do evento", str(dados.nomeEvento));
  addLine(items, "Data do evento", formatDate(dados.dataEvento as string));
  addLine(items, "Horário do evento", str(dados.horario));
  addLine(items, "Origem do evento", str(dados.origem));
  addLine(items, "Tipo de evento", str(dados.tipoEvento));
  addLine(items, "Público-alvo", str(dados.publico));
  addLine(items, "Estado", humanizeEstado(dados.estado as string));
  addLine(items, "Cidade", str(dados.cidade));
  addLine(items, "Local", humanizeLocal(dados));
  addLine(items, "Número estimado de convidados", str(dados.convidados));
  addLine(items, "Custo estimado", str(dados.custoEstimado));
  addLine(items, "Rateio", str(dados.rateio));
  addLine(items, "Canal de transmissão", str(dados.canal));
  addLine(items, "Link de transmissão", str(dados.linkTransmissao));
  addLine(items, "Tipo de transmissão", tipoAprox);
  addLine(items, "Ideia / Quando", str(dados.ideaQuando));
  addLine(items, "Objetivos", str(dados.objetivos));
  addLine(items, "Descrição", str(dados.descricao));

  logger.info({ itens: items.length }, "ClickUp: bloco de resumo montado");
  return `🎯 Resumo da solicitação\n\n${items.join("\n")}`;
}

function buildPalestrantesSection(dados: FormDados): string | null {
  const tem = str(dados.temPalestrante).toLowerCase();
  if (tem !== "sim") return null;

  const items: string[] = [];
  items.push("• O evento terá palestrantes?: Sim");

  const lista = [
    { svn: dados.palSvn1, nome: dados.palNome1, cargo: dados.palCargo1, n: 1 },
    { svn: dados.palSvn2, nome: dados.palNome2, cargo: dados.palCargo2, n: 2 },
    { svn: dados.palSvn3, nome: dados.palNome3, cargo: dados.palCargo3, n: 3 },
    { svn: dados.palSvn4, nome: dados.palNome4, cargo: dados.palCargo4, n: 4 },
  ];

  let count = 0;
  for (const { svn, nome, cargo, n } of lista) {
    const nomeStr = str(nome as string);
    if (!nomeStr) continue;
    count++;
    const svnStr = str(svn as string);
    if (svnStr) items.push(`• Palestrante ${n} é colaborador da SVN?: ${svnStr}`);
    items.push(`• Nome do palestrante ${n}: ${nomeStr}`);
    const cargoStr = str(cargo as string);
    if (cargoStr) items.push(`• Cargo do palestrante ${n}: ${cargoStr}`);
  }

  if (count === 0) return null;

  logger.info({ count }, "ClickUp: bloco de palestrantes montado");
  return `🎤 Palestrantes\n\n${items.join("\n")}`;
}

function buildMateriaisSection(dados: FormDados): string | null {
  const materiais = dados.materiais as string[] | undefined;
  if (!materiais || !Array.isArray(materiais) || materiais.length === 0) {
    logger.warn("ClickUp: nenhum material encontrado no payload para secao de materiais");
    return null;
  }

  const detalhes = (dados.materiaisDetalhes || {}) as Record<string, Record<string, string>>;
  const lines: string[] = [];

  for (const materialId of materiais) {
    const label = MATERIAL_LABELS[materialId] || materialId;
    lines.push(`✅ ${label}`);

    const condLabels = MATERIAL_COND_LABELS[materialId];
    const condValues = detalhes[materialId];
    if (condLabels && condValues && typeof condValues === "object") {
      for (const [key, fieldLabel] of Object.entries(condLabels)) {
        const val = str(condValues[key]);
        if (val) lines.push(`• ${fieldLabel}: ${val}`);
      }
    }
    lines.push("");
  }

  logger.info({ count: materiais.length }, "ClickUp: bloco de materiais montado");
  return `📦 Materiais solicitados\n\n${lines.join("\n").trimEnd()}`;
}

function buildEventDescription(dados: FormDados, user: UserData): string {
  const blocks: string[] = [];

  blocks.push(buildRequesterSection(user));
  blocks.push(buildResumoSection(dados));

  const palestrantes = buildPalestrantesSection(dados);
  if (palestrantes) blocks.push(palestrantes);

  const materiais = buildMateriaisSection(dados);
  if (materiais) blocks.push(materiais);

  const obs = str(dados.observacoes);
  if (obs) {
    blocks.push(`📝 Observações gerais\n\n• ${obs}`);
  }

  logger.info({ blocos: blocks.length }, "ClickUp: descricao humanizada gerada com sucesso, JSON bruto removido");
  return blocks.join("\n\n");
}

function buildClickUpEventTaskName(dados: FormDados): string {
  const naturezaRaw = str(dados.natureza);
  const natureza = naturezaRaw === "presencial" ? "Presencial"
    : naturezaRaw === "online" ? "Online"
    : naturezaRaw || "Evento";

  const titulo = str(dados.nomeEvento) || "Evento sem título";
  const cidade = str(dados.cidade);

  logger.info({ natureza, titulo, cidade }, "ClickUp: nome da task de evento gerado");

  return cidade
    ? `[Evento ${natureza}] ${titulo} - ${cidade}`
    : `[Evento ${natureza}] ${titulo}`;
}

function getListId(tipoSolicitacao: string): string | null {
  const category = CLICKUP_LIST_MAP[tipoSolicitacao];
  if (!category) return null;
  return CLICKUP_LISTS[category] || null;
}

async function setClickUpCustomField(taskId: string, fieldId: string, value: unknown, label: string): Promise<void> {
  logger.info({ taskId, fieldId, label, value }, "ClickUp: tentando preencher custom field");
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
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
        logger.warn({ taskId, fieldId: field.id, label: field.label }, "ClickUp: arquivo sem URL, pulando");
        continue;
      }
    } else {
      const raw = dados[field.dadosKey];
      if (raw === undefined || raw === null || String(raw).trim() === "") {
        logger.warn({ taskId, fieldId: field.id, label: field.label }, "ClickUp: campo sem valor, pulando");
        continue;
      }
      if (field.isDate) {
        const ts = new Date(String(raw)).getTime();
        value = isNaN(ts) ? String(raw) : ts;
      } else if (field.isNumber) {
        const n = parseInt(String(raw).replace(/\D/g, ""));
        if (isNaN(n)) {
          logger.warn({ taskId, fieldId: field.id, label: field.label, raw }, "ClickUp: valor numerico invalido, pulando");
          continue;
        }
        value = n;
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

  let taskName: string;
  let description: string;

  if (tipo === "eventos") {
    taskName = buildClickUpEventTaskName(dados);
    description = buildEventDescription(dados, user);
  } else {
    const nome = str(dados.nomeEvento) || str(dados.titulo) || str(dados.nomeCompleto);
    const solicitante = user.name || user.email;
    taskName = subtipo
      ? `[${tipo} ${subtipo}] ${nome} — ${solicitante}`
      : `[${tipo}] ${nome} — ${solicitante}`;
    description = JSON.stringify(dados, null, 2);
  }

  const taskStatus = tipo === "eventos" ? "Solicitações" : "Para fazer";

  let taskId: string | null = null;

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ name: taskName, description, status: taskStatus }),
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

  logger.info({ taskId, tipo, taskName }, "ClickUp: task criada com sucesso");

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
