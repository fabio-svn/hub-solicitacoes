import { logger } from "../lib/logger";

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN || "";

const CLICKUP_LIST_EVENTOS = process.env.CLICKUP_LIST_EVENTOS || "901303299333";
const CLICKUP_LIST_GERAL   = process.env.CLICKUP_LIST_GERAL   || "901300673533";

function normalizeStatusKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const CLICKUP_STATUS_MAP: Record<string, string> = {
  "to do":                      "recebido",
  "recebido":                   "recebido",
  "in progress":                "em-producao",
  "em analise":                 "em-analise",
  "em andamento":               "em-producao",
  "em producao":                "em-producao",
  "em producao.":               "em-producao",
  "em revisao":                 "em-revisao",
  "em revisão":                 "em-revisao",
  "em aprovacao":               "em-aprovacao",
  "em aprovação":               "em-aprovacao",
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
  "complete":                   "concluido",
  "concluido":                  "concluido",
  "done":                       "concluido",
  "closed":                     "concluido",
  "cancelled":                  "cancelado",
  "canceled":                   "cancelado",
  "cancelado":                  "cancelado",
  "reprovado":                  "reprovado",
  "reprovado / cancelado":      "reprovado",
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

const REQUEST_TYPE_LABELS: Record<string, string> = {
  "artes-divulgacao":           "Arte de Divulgação",
  "atualizacao-material":       "Atualização de Material",
  "conteudo-pdf-informativo":   "PDF Informativo",
  "conteudo-pdf-ebook":         "PDF Ebook",
  "apresentacao-nova":          "Apresentação Nova",
  "apresentacao-atualizar":     "Atualização de Apresentação",
  "pagina-assessores-dados":    "Página de Assessores",
  "pagina-assessores-atualizacao": "Página de Assessores",
};

const ARQUIVO_LABELS: Record<string, string> = {
  arquivoBase:   "Arquivo base",
  arquivoApoio:  "Arquivo de apoio",
  materialAtual: "Material atual",
  fotoPerfil:    "Foto de perfil",
  logoFile:      "Logo complementar",
};

interface FieldDef {
  label: string;
  id: string;
  dadosKey: string;
  clickupType: string;
  isArquivo?: boolean;
}

// Todos os campos de eventos no ClickUp são do tipo short_text (string simples).
// Data do evento: short_text → enviar string formatada (ex: "01/05/2026"), NÃO timestamp.
// Número de convidados: short_text → enviar string, NÃO inteiro.
// Horários: dois campos distintos; ambos recebem o mesmo valor de dados.horario.
const EVENTOS_CUSTOM_FIELDS: FieldDef[] = [
  { label: "Nome do solicitante",              id: "92db4658-70d1-430e-98ec-5e27029136fd", dadosKey: "nome",            clickupType: "short_text" },
  { label: "Data do evento",                   id: "361cb66a-8c99-43ec-a4fa-5a347e9a4fbd", dadosKey: "dataEvento",      clickupType: "short_text" },
  { label: "Origem do evento",                 id: "626bb697-d9eb-4e79-8277-8a7145e4b979", dadosKey: "origem",          clickupType: "short_text" },
  { label: "Horário do Evento",                id: "45d8babe-a7dd-4a78-952f-1aa366bf34ed", dadosKey: "horario",         clickupType: "short_text" },
  { label: "Horário descrito",                 id: "44c91638-ccb6-41fa-8f05-dcab3085f313", dadosKey: "horario",         clickupType: "short_text" },
  { label: "Horário de Brasília?",             id: "af7d26c8-f228-4985-941a-20bb6905b6d5", dadosKey: "horBrasilia",     clickupType: "short_text" },
  { label: "Título do evento",                 id: "b40d49f5-341d-4671-a4f0-7cef7a643d6b", dadosKey: "nomeEvento",      clickupType: "short_text" },
  { label: "O evento terá palestrantes?",      id: "8dbc39d5-f2e7-4669-be67-b1a24a53c2cf", dadosKey: "temPalestrante",  clickupType: "short_text" },
  { label: "Palestrante 1 — colaborador SVN?", id: "28491235-89d7-4384-819c-66ca974d04a0", dadosKey: "palSvn1",         clickupType: "short_text" },
  { label: "Palestrante 1 — Nome",             id: "5de3fdb1-3434-4820-92c8-6e7ee82cd3eb", dadosKey: "palNome1",        clickupType: "short_text" },
  { label: "Palestrante 1 — Cargo",            id: "56fbcd07-eab1-465d-9055-8c5e6c0f39ac", dadosKey: "palCargo1",       clickupType: "short_text" },
  { label: "Palestrante 1 — Foto",             id: "73d010f4-fb4b-4e00-bcf1-f550487c18fd", dadosKey: "palFoto1",        clickupType: "short_text", isArquivo: true },
  { label: "Natureza",                         id: "1e31ee81-8b88-4cfc-b8c1-754a94f5f084", dadosKey: "natureza",        clickupType: "short_text" },
  { label: "Nível de maturidade",              id: "1fe629c6-9cf4-4576-8828-bc93aae0d335", dadosKey: "maturidade",      clickupType: "short_text" },
  { label: "Tipo de evento",                   id: "c81a416c-a09d-41f4-a003-5261bf6edce6", dadosKey: "tipoEvento",      clickupType: "short_text" },
  { label: "Breve descrição do evento",        id: "4930db39-8924-4121-b432-1068e15068db", dadosKey: "descricao",       clickupType: "text"       },
  { label: "Cidade",                           id: "ded0be23-c50e-4f82-8b81-66a73dcc42a8", dadosKey: "_cidadeFormatada",clickupType: "short_text" },
  { label: "Imagem complementar de parceiro",  id: "2d45b87d-dfd0-4f8d-92d2-0a6efc27eec7", dadosKey: "imgFile",         clickupType: "short_text", isArquivo: true },
  { label: "Arquivo adicional",                id: "35d6d98f-e139-444a-a32a-699a24fe544a", dadosKey: "demaisFile",      clickupType: "short_text", isArquivo: true },
  { label: "Público-alvo",                     id: "5ffdf7e3-cde1-465c-a186-1b24d0f6b395", dadosKey: "publico",         clickupType: "short_text" },
  { label: "Número de convidados",             id: "d676846e-b66c-4c71-8173-7378d9db1f95", dadosKey: "convidados",      clickupType: "short_text" },
  { label: "Custo estimado",                   id: "de09cf5f-3e69-48de-bb7f-bececcf55f95", dadosKey: "custoEstimado",   clickupType: "short_text" },
  { label: "Rateio",                           id: "7ce379f3-fc8c-4ba4-a814-829694df1d07", dadosKey: "rateio",          clickupType: "short_text" },
  { label: "Endereço do local externo",        id: "78816dd7-89b1-470b-a812-8716cd4b8ebf", dadosKey: "localEndereco",   clickupType: "short_text" },
  { label: "Canal de transmissão",             id: "83420339-a502-4a47-ac02-17c5cb5f17c2", dadosKey: "canal",           clickupType: "short_text" },
  { label: "Link de transmissão",              id: "d4964071-a1f6-4089-9e0c-4d7723de3c1b", dadosKey: "linkTransmissao", clickupType: "short_text" },
  { label: "Ideia / Quando",                   id: "ee61335f-97d0-4f9a-91db-675aa7697671", dadosKey: "ideaQuando",      clickupType: "short_text" },
  { label: "Logo complementar de parceiro",    id: "245f050b-1827-45cb-a983-a8b6ab1596ae", dadosKey: "logoFile",        clickupType: "short_text", isArquivo: true },
  { label: "Sugestão de local",                id: "a91901e2-25e0-4224-9d23-8fe13a903ac6", dadosKey: "localSugestoes",  clickupType: "short_text" },
  { label: "Palestrante 2 — colaborador SVN?", id: "9c1d3dbe-39cf-4a84-a67b-2d33ffd6bffe", dadosKey: "palSvn2",         clickupType: "short_text" },
  { label: "Palestrante 2 — Nome",             id: "281def01-58e4-4d21-8b0e-f8bd792d947e", dadosKey: "palNome2",        clickupType: "short_text" },
  { label: "Palestrante 2 — Cargo",            id: "52391024-c4f3-4999-983a-53492e8069a5", dadosKey: "palCargo2",       clickupType: "short_text" },
  { label: "Palestrante 2 — Foto",             id: "00b1cf20-bb99-4f93-bd7b-6e06cf28e84a", dadosKey: "palFoto2",        clickupType: "short_text", isArquivo: true },
  { label: "Palestrante 3 — colaborador SVN?", id: "6467fb48-b972-40ab-a9b2-79cdc0173167", dadosKey: "palSvn3",         clickupType: "short_text" },
  { label: "Palestrante 3 — Nome",             id: "ea476985-2ec4-4a06-8e33-9d6a70ddd07a", dadosKey: "palNome3",        clickupType: "short_text" },
  { label: "Palestrante 3 — Cargo",            id: "f32b20cc-01a6-443e-a5ac-91aaee4fa9b2", dadosKey: "palCargo3",       clickupType: "short_text" },
  { label: "Palestrante 3 — Foto",             id: "53981c0c-20ef-45e9-bf11-8f95261dd4ce", dadosKey: "palFoto3",        clickupType: "short_text", isArquivo: true },
  { label: "Palestrante 4 — colaborador SVN?", id: "c70cc18e-82b7-48f4-b5db-1cc1e1fa18cb", dadosKey: "palSvn4",         clickupType: "short_text" },
  { label: "Palestrante 4 — Nome",             id: "a128e306-f734-423c-8971-9fd4ca66e354", dadosKey: "palNome4",        clickupType: "short_text" },
  { label: "Palestrante 4 — Cargo",            id: "e76af56c-0cf8-4274-970c-93333c6c2f86", dadosKey: "palCargo4",       clickupType: "short_text" },
  { label: "Palestrante 4 — Foto",             id: "2ad7d8c4-bc0d-4925-818e-cc24bedca0bc", dadosKey: "palFoto4",        clickupType: "short_text", isArquivo: true },
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

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────

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
  if (localEvento === "nao-definido") return "Local ainda não definido";
  return null;
}

function getUserDepartment(user: UserData, dados: FormDados): string {
  const setor = str(dados.setor as string);
  if (setor) return setor;
  logger.warn({ email: user.email }, "ClickUp: setor nao disponivel na sessao, usando fallback Geral");
  return "Geral";
}

function humanizeRequestType(tipo: string): string {
  return REQUEST_TYPE_LABELS[tipo] || tipo;
}

// ─────────────────────────────────────────────
// Task name builders
// ─────────────────────────────────────────────

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

function buildGeneralTaskName(tipo: string, _subtipo: string, dados: FormDados, user: UserData): string {
  const tipoHuman = humanizeRequestType(tipo);
  const setor = getUserDepartment(user, dados);
  const titulo = str(dados.titulo) || str(dados.nomeCompleto) || "";
  let name = `[${tipoHuman}]`;
  if (setor && setor !== "Geral") name += ` ${setor}`;
  if (titulo) name += ` - ${titulo}`;
  logger.info({ tipo, tipoHuman, setor, titulo, taskName: name }, "ClickUp: nome da task geral gerado");
  return name;
}

// ─────────────────────────────────────────────
// Description section builders — Eventos
// ─────────────────────────────────────────────

function buildRequesterSection(user: UserData): string {
  const items: string[] = [];
  items.push(`• Solicitante: ${user.name}`);
  items.push(`• E-mail: ${user.email}`);
  logger.info({ nome: user.name, email: user.email }, "ClickUp: bloco solicitante montado");
  return `## 👤 Solicitante\n\n${items.join("\n")}`;
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
  return `## 🎯 Resumo da solicitação\n\n${items.join("\n")}`;
}

function buildPalestrantesSection(dados: FormDados): string | null {
  if (str(dados.temPalestrante).toLowerCase() !== "sim") return null;
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
  return `## 🎤 Palestrantes\n\n${items.join("\n")}`;
}

function buildMateriaisSection(dados: FormDados): string | null {
  const materiais = dados.materiais as string[] | undefined;
  if (!materiais || !Array.isArray(materiais) || materiais.length === 0) return null;
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
  return `## 📦 Materiais solicitados\n\n${lines.join("\n").trimEnd()}`;
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
  if (obs) blocks.push(`## 📝 Observações gerais\n\n• ${obs}`);
  logger.info({ blocos: blocks.length }, "ClickUp: descricao humanizada de evento gerada, JSON bruto removido");
  return blocks.join("\n\n");
}

// ─────────────────────────────────────────────
// Description section builders — Lista Geral
// ─────────────────────────────────────────────

function buildDetailsSection(tipo: string, dados: FormDados): string | null {
  const items: string[] = [];

  if (["artes-divulgacao", "conteudo-pdf-informativo", "conteudo-pdf-ebook"].includes(tipo)) {
    const conteudo = str(dados.conteudo);
    if (conteudo) items.push(`• Conteúdo / Briefing:\n${conteudo}`);
    const canalOutro = str(dados.canalOutro);
    if (canalOutro) items.push(`• Canal personalizado: ${canalOutro}`);

  } else if (tipo === "atualizacao-material") {
    const descricao = str(dados.descricao);
    if (descricao) items.push(`• Descrição das atualizações:\n${descricao}`);

  } else if (["apresentacao-nova", "apresentacao-atualizar"].includes(tipo)) {
    const tamanho = str(dados.tamanho);
    if (tamanho) items.push(`• Formato / Tamanho: ${tamanho}`);
    const tipoCriacao = str(dados.tipoCriacao);
    if (tipoCriacao) {
      const tipoHuman = tipoCriacao === "do-zero" ? "Do zero"
        : tipoCriacao === "base-existente" ? "Com base existente"
        : tipoCriacao;
      items.push(`• Tipo de criação: ${tipoHuman}`);
    }
    const elementos = str(dados.elementos);
    if (elementos) items.push(`• Elementos desejados: ${elementos}`);
    const elementosDesc = str(dados.elementosDescricao);
    if (elementosDesc) items.push(`• Descrição dos elementos:\n${elementosDesc}`);

  } else if (["pagina-assessores-dados", "pagina-assessores-atualizacao"].includes(tipo)) {
    addLine(items, "Nome completo", str(dados.nomeCompleto));
    addLine(items, "Código do assessor", str(dados.codigoAssessor));
    addLine(items, "Unidade", str(dados.unidade));
    addLine(items, "Contrato social", str(dados.contratoSocial));
    addLine(items, "LinkedIn", str(dados.linkedin));
    addLine(items, "Instagram", str(dados.instagram));
    const miniBio = str(dados.miniBio);
    if (miniBio) items.push(`• Mini bio:\n${miniBio}`);
    const selos = dados.selos as string[] | undefined;
    if (selos && Array.isArray(selos) && selos.length > 0) {
      items.push(`• Selos: ${selos.join(", ")}`);
    }
    const depos = dados.depoimentos as Array<{ nome: string; texto: string }> | undefined;
    if (depos && Array.isArray(depos) && depos.length > 0) {
      items.push("• Depoimentos:");
      depos.forEach((d, i) => {
        if (d.nome && d.texto) items.push(`  ${i + 1}. ${d.nome}: "${d.texto}"`);
      });
    }
  }

  if (items.length === 0) return null;
  return `## 📝 Detalhes\n\n${items.join("\n")}`;
}

function buildArquivosSection(arquivos: ArquivosMap): string | null {
  const items: string[] = [];
  for (const [campo, url] of Object.entries(arquivos)) {
    if (!url) continue;
    const label = ARQUIVO_LABELS[campo] || campo;
    items.push(`• ${label}: ${url}`);
  }
  if (items.length === 0) return null;
  return `## 📎 Arquivos\n\n${items.join("\n")}`;
}

function buildGeneralDescription(
  tipo: string,
  subtipo: string,
  dados: FormDados,
  user: UserData,
  arquivos: ArquivosMap
): string {
  const blocks: string[] = [];

  blocks.push(buildRequesterSection(user));

  const tipoHuman = humanizeRequestType(tipo);
  const setor = getUserDepartment(user, dados);
  const resumoItems: string[] = [];
  addLine(resumoItems, "Tipo", tipoHuman);
  if (subtipo) addLine(resumoItems, "Subtipo", subtipo);
  if (setor && setor !== "Geral") addLine(resumoItems, "Setor", setor);
  addLine(resumoItems, "Título", str(dados.titulo) || str(dados.nomeCompleto));
  addLine(resumoItems, "Finalidade", str(dados.finalidade));
  addLine(resumoItems, "Prazo de entrega", str(dados.prazoEntrega));
  addLine(resumoItems, "Público-alvo", str(dados.publico as string) || str(dados.publicoAlvo));
  addLine(resumoItems, "Canais", str(dados.canais));
  if (resumoItems.length > 0) blocks.push(`## 📌 Resumo\n\n${resumoItems.join("\n")}`);

  const detalhes = buildDetailsSection(tipo, dados);
  if (detalhes) blocks.push(detalhes);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  const obs = str(dados.observacoes);
  if (obs) blocks.push(`## 📝 Observações gerais\n\n• ${obs}`);

  logger.info({ tipo, blocos: blocks.length }, "ClickUp: descricao geral humanizada gerada, JSON bruto removido");
  return blocks.join("\n\n");
}

// ─────────────────────────────────────────────
// ClickUp API helpers
// ─────────────────────────────────────────────

async function setClickUpCustomField(
  taskId: string,
  fieldId: string,
  value: unknown,
  label: string,
  opts?: { clickupType?: string; raw?: unknown }
): Promise<void> {
  logger.info({
    taskId,
    fieldId,
    label,
    clickupType: opts?.clickupType ?? "unknown",
    rawValue: opts?.raw !== undefined ? opts.raw : value,
    convertedValue: value,
  }, "ClickUp: enviando custom field");
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error({ taskId, fieldId, label, clickupType: opts?.clickupType, httpStatus: response.status, body: text }, "ClickUp: ERRO ao preencher custom field");
    } else {
      logger.info({ taskId, fieldId, label, clickupType: opts?.clickupType }, "ClickUp: custom field preenchido com sucesso");
    }
  } catch (err) {
    logger.error({ err, taskId, fieldId, label }, "ClickUp: excecao ao preencher custom field");
  }
}

async function setEventosCustomFields(taskId: string, dados: FormDados, arquivos: ArquivosMap, user: UserData): Promise<void> {
  // ── E-mail do solicitante (vem do user, não do dados) ───────────────────────
  if (user.email) {
    await setClickUpCustomField(taskId, "ae56f16a-8d97-40e0-9032-c357eb0793ca", user.email, "E-mail do Solicitante", { clickupType: "short_text", raw: user.email });
  }

  // ── Campo computado: Local do evento (short_text) ───────────────────────────
  const localHuman = humanizeLocal(dados);
  if (localHuman) {
    await setClickUpCustomField(taskId, "38ac133a-13b0-4428-98eb-adb5f8cdc23a", localHuman, "Local do evento", { clickupType: "short_text" });
  }

  // ── Campo computado: Cidade - UF ────────────────────────────────────────────
  const cidadeRaw = str(dados.cidade as string);
  const estadoRaw = str(dados.estado as string);
  if (cidadeRaw) {
    const IBGE_SIGLA_MAP: Record<string, string> = {
      "12":"AC","27":"AL","16":"AP","13":"AM","29":"BA","23":"CE","53":"DF",
      "32":"ES","52":"GO","21":"MA","51":"MT","50":"MS","31":"MG","15":"PA",
      "25":"PB","41":"PR","26":"PE","22":"PI","33":"RJ","24":"RN","43":"RS",
      "11":"RO","14":"RR","42":"SC","35":"SP","28":"SE","17":"TO",
    };
    const sigla = IBGE_SIGLA_MAP[estadoRaw] || estadoRaw;
    (dados as Record<string, unknown>)._cidadeFormatada = sigla ? `${cidadeRaw} - ${sigla}` : cidadeRaw;
  }

  // ── Campo computado: endereço da unidade SVN ─────────────────────────────────
  const localEvento = str(dados.localEvento as string);
  if (localEvento === "unidade") {
    const UNIDADES_ENDERECOS: Record<string, string> = {
      "SVN Aracaju":              "R. Francisco Duarte Ramos, 34 - Jardins, Aracaju - SE",
      "SVN Campo Grande":         "Edifício Atrium - R. Euclides da Cunha, 1039 - Loja 3 - Jardim dos Estados",
      "SVN Cascavel":             "Av. Piquiri, 17 - Salas 01 e 02 - Centro",
      "SVN Cuiabá":               "R. Pres. Castelo Branco, 277 - Quilombo",
      "SVN Curitiba":             "Praça São Paulo da Cruz, 50 - Sala 1605 - Juveve, Curitiba - PR",
      "SVN Foz do Iguaçu":        "R. Alm. Barroso, 1139 - Centro",
      "SVN Londrina":             "Av. Higienópolis, 602 - Sala 2 - Centro, Londrina - PR",
      "SVN Maringá":              "Av. Cerro Azul, 123 - Zona 2, Maringá - PR",
      "SVN Salvador":             "Torre Nova York, Av. Tancredo Neves, 2539 - Sala 2104, Salvador - BA",
      "SVN São Paulo":            "Av. Dr. Cardoso de Melo, 1855 - Conjunto 51 - Vila Olímpia, São Paulo - SP",
      "SVN Toledo":               "Rua Nossa Senhora do Rocio, 2279 - Sala 02 - Jardim La Salle, Toledo - PR",
      "SVN Vitória da Conquista":  "Av. Jorge Teixeira, 29 - Salas 16 e 17",
    };
    const unidade = str(dados.unidadeSVN as string);
    const enderecoUnidade = UNIDADES_ENDERECOS[unidade];
    if (enderecoUnidade) {
      (dados as Record<string, unknown>).localEndereco = enderecoUnidade;
      logger.info({ unidade, endereco: enderecoUnidade }, "ClickUp: endereço da unidade SVN injetado");
    }
  }

  // ── Campo Solicitações: lista de materiais selecionados (text) ─────────────
  const materiaisArr = dados.materiais as string[] | undefined;
  if (Array.isArray(materiaisArr) && materiaisArr.length > 0) {
    const materiaisText = materiaisArr
      .map(id => `• ${MATERIAL_LABELS[id] || id}`)
      .join("\n");
    await setClickUpCustomField(taskId, "3266524c-febc-47ac-a76d-0d9c4256d9dc", materiaisText, "Solicitações", { clickupType: "text", raw: materiaisArr });
  }

  // ── Campos da lista EVENTOS_CUSTOM_FIELDS ───────────────────────────────────
  for (const field of EVENTOS_CUSTOM_FIELDS) {
    let value: string | null;

    if (field.isArquivo) {
      const url = arquivos[field.dadosKey] || null;
      if (!url) { logger.warn({ taskId, label: field.label }, "ClickUp: arquivo sem URL, pulando"); continue; }
      value = url;
    } else {
      const raw = dados[field.dadosKey];
      if (raw === undefined || raw === null || str(raw as string) === "") {
        logger.warn({ taskId, label: field.label, dadosKey: field.dadosKey }, "ClickUp: campo sem valor, pulando");
        continue;
      }

      if (field.dadosKey === "dataEvento") {
        // short_text → enviar como "DD/MM/YYYY", NÃO timestamp
        value = formatDate(String(raw)) ?? String(raw);
      } else if (field.dadosKey === "natureza") {
        // Capitalizar: "presencial" → "Presencial", "online" → "Online"
        const n = str(raw as string).toLowerCase();
        value = n === "presencial" ? "Presencial" : n === "online" ? "Online" : str(raw as string);
      } else {
        value = str(raw as string);
      }
    }

    await setClickUpCustomField(taskId, field.id, value, field.label, {
      clickupType: field.clickupType,
      raw: dados[field.dadosKey],
    });
  }
}

// Mapa de tipo de solicitação → orderindex do dropdown "Tipo de Demanda" no ClickUp.
// Todos os tipos da Lista Geral são classificados como "Conteúdo" (orderindex 3).
const TIPO_DEMANDA_ORDERINDEX: Record<string, number> = {
  "artes-divulgacao":              3,
  "atualizacao-material":          3,
  "conteudo-pdf-informativo":      3,
  "conteudo-pdf-ebook":            3,
  "apresentacao-nova":             3,
  "apresentacao-atualizar":        3,
  "pagina-assessores-dados":       3,
  "pagina-assessores-atualizacao": 3,
};

async function setGeneralCustomFields(
  taskId: string,
  tipo: string,
  subtipo: string,
  dados: FormDados,
  arquivos: ArquivosMap
): Promise<void> {
  const titulo = str(dados.titulo) || str(dados.nomeCompleto) || null;
  const publicoAlvo = str(dados.publico as string) || str(dados.publicoAlvo as string) || null;
  const arquivoPrincipal = arquivos.materialAtual || arquivos.arquivoBase || null;
  const arquivoApoio = arquivos.arquivoApoio || arquivos.fotoPerfil || null;

  // ── Campos short_text e text ───────────────────────────────────────────────
  const textFields: Array<{ id: string; value: unknown; label: string; clickupType: string }> = [
    { id: "6e36326f-2501-4ce2-9894-13d4ddf222d4", value: str(dados.nome) || null,        label: "Nome do solicitante", clickupType: "short_text" },
    { id: "b727b647-0da1-43a5-a82d-70c33dedf0fd", value: titulo,                         label: "Título",              clickupType: "short_text" },
    { id: "5d7ae6e5-8528-4df3-bf0c-ed3bb05ebee1", value: str(dados.finalidade) || null,  label: "Finalidade",          clickupType: "text" },
    { id: "c7585104-7f53-4dcb-95d6-c75d55c4c57b", value: publicoAlvo,                    label: "Público-alvo",        clickupType: "short_text" },
    { id: "ea38779d-385c-410b-972e-ba97499e9252", value: str(dados.canais) || null,       label: "Canais",              clickupType: "short_text" },
    { id: "f80ba423-ccae-464c-9d20-6665c7f1da00", value: str(dados.observacoes) || null, label: "Observações",         clickupType: "text" },
  ];

  for (const { id, value, label, clickupType } of textFields) {
    if (!value) { logger.warn({ taskId, fieldId: id, label }, "ClickUp: campo geral sem valor, pulando"); continue; }
    await setClickUpCustomField(taskId, id, value, label, { clickupType, raw: value });
  }

  // ── Dropdown: Tipo de Demanda (drop_down) → enviar orderindex numérico ─────
  // Subtipo (ba1bccb2) omitido: opções ainda são placeholder ("Option 1", "Option 2")
  const tipoDemandaOrderindex = TIPO_DEMANDA_ORDERINDEX[tipo] ?? 3;
  await setClickUpCustomField(
    taskId, "ea901547-2f65-42ee-ab6c-5fbf0ceaa79b", tipoDemandaOrderindex, "Tipo de Demanda",
    { clickupType: "drop_down", raw: tipo }
  );

  // ── Date: Prazo de entrega → enviar Unix timestamp em milissegundos ─────────
  const prazoRaw = str(dados.prazoEntrega as string);
  if (prazoRaw) {
    const d = new Date(prazoRaw + "T12:00:00");
    if (!isNaN(d.getTime())) {
      await setClickUpCustomField(
        taskId, "33c5d4c5-1e0d-48ba-b0a5-6decdea6e138", d.getTime(), "Prazo de entrega",
        { clickupType: "date", raw: prazoRaw }
      );
    } else {
      logger.warn({ taskId, prazoRaw }, "ClickUp: data de prazo inválida, pulando");
    }
  }

  // ── URL: Arquivo principal e arquivo de apoio ──────────────────────────────
  if (arquivoPrincipal) {
    await setClickUpCustomField(taskId, "294f47eb-82a7-416e-998e-ea79b77d296b", arquivoPrincipal, "Arquivo principal", { clickupType: "url" });
  }
  if (arquivoApoio) {
    await setClickUpCustomField(taskId, "67d565fd-ca4f-472b-969b-4b5228459e0f", arquivoApoio, "Arquivo de apoio", { clickupType: "url" });
  }
}

// ─────────────────────────────────────────────
// Core public functions
// ─────────────────────────────────────────────

function getListId(tipoSolicitacao: string): string {
  if (tipoSolicitacao === "eventos") {
    logger.info({ tipo: tipoSolicitacao, listId: CLICKUP_LIST_EVENTOS }, "ClickUp: roteando para Lista Eventos");
    return CLICKUP_LIST_EVENTOS;
  }
  logger.info({ tipo: tipoSolicitacao, listId: CLICKUP_LIST_GERAL }, "ClickUp: roteando para Lista Geral");
  return CLICKUP_LIST_GERAL;
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

  const tipo = solicitacao.tipo_solicitacao;
  const subtipo = solicitacao.subtipo || "";
  const safeArquivos = arquivos || {};
  const listId = getListId(tipo);

  let taskName: string;
  let description: string;

  if (tipo === "eventos") {
    taskName = buildClickUpEventTaskName(dados);
    description = buildEventDescription(dados, user);
  } else {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildGeneralDescription(tipo, subtipo, dados, user, safeArquivos);
  }

  logger.info({ tipo, listId, taskName, descriptionLength: description.length }, "ClickUp: criando task");

  const taskPayload: Record<string, unknown> = { name: taskName, description };
  if (tipo === "eventos") taskPayload.status = "Solicitações";
  let taskId: string | null = null;

  logger.info({ tipo, listId, taskName, payload: taskPayload }, "ClickUp: payload final antes do POST");

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(taskPayload),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error({ tipo, listId, taskName, httpStatus: response.status, body: text }, "ClickUp: erro ao criar task");
      return null;
    }
    const data = await response.json() as { id?: string };
    taskId = data.id || null;
  } catch (err) {
    logger.error({ err, tipo, listId }, "ClickUp: falha na criação da task");
    return null;
  }

  if (!taskId) return null;
  logger.info({ taskId, tipo, listId, taskName }, "ClickUp: task criada com sucesso");

  if (tipo === "eventos") {
    await setEventosCustomFields(taskId, dados, safeArquivos, user);
  } else {
    await setGeneralCustomFields(taskId, tipo, subtipo, dados, safeArquivos);
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
    const clickupStatus = normalizeStatusKey(data.status?.status || "");
    return CLICKUP_STATUS_MAP[clickupStatus] || null;
  } catch {
    return null;
  }
}
