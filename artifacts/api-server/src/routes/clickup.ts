import { logger } from "../lib/logger";
import { randomInt } from "crypto";
import { db, usersTable, userTipoAssignmentsTable, tipoClickupListTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { mapClickUpStatus } from "../config/clickup-status";
import { UNIDADES_ENDERECOS } from "../config/unidades";
import { FORM_SCHEMAS, SETOR_CODIGO_MAP, TIPOS_COM_CLICKUP } from "../config/form-schemas";

const CLICKUP_API_TOKEN = process.env.CLICKUP_API_TOKEN || "";

// Valida um list_id contra o ClickUp usando o token atual.
// Usado pela tela de admin (botão Validar) e pelo save (PUT).
export async function validateClickUpList(
  listId: string
): Promise<{ ok: boolean; name?: string; error?: string }> {
  if (!CLICKUP_API_TOKEN) return { ok: false, error: "Token do ClickUp não configurado no servidor." };
  if (!/^\d+$/.test(listId)) return { ok: false, error: "O ID da lista deve conter apenas números." };
  try {
    const r = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
      headers: { Authorization: CLICKUP_API_TOKEN },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      let msg = `ClickUp respondeu ${r.status}`;
      if (body.includes("OAUTH_027") || body.includes("not authorized"))
        msg = "Essa lista não existe ou o token não tem acesso a ela (verifique se é um ID de LISTA, não de usuário).";
      else if (r.status === 404) msg = "Lista não encontrada no ClickUp.";
      return { ok: false, error: msg };
    }
    const data = await r.json().catch(() => ({})) as { name?: string };
    return { ok: true, name: data?.name };
  } catch (err) {
    return { ok: false, error: "Falha de rede ao consultar o ClickUp." };
  }
}

const CLICKUP_LIST_EVENTOS   = process.env.CLICKUP_LIST_EVENTOS   || "901303299333";
const CLICKUP_LIST_GERAL     = process.env.CLICKUP_LIST_GERAL     || "901300673533";
const CLICKUP_LIST_BRINDES   = process.env.CLICKUP_LIST_BRINDES   || "900100469662";
const CLICKUP_LIST_PATROCINIO = process.env.CLICKUP_LIST_PATROCINIO || "901324638951";


const IBGE_STATE_MAP: Record<string, string> = {
  "12": "Acre", "27": "Alagoas", "16": "Amapá", "13": "Amazonas",
  "29": "Bahia", "23": "Ceará", "53": "Distrito Federal", "32": "Espírito Santo",
  "52": "Goiás", "21": "Maranhão", "51": "Mato Grosso", "50": "Mato Grosso do Sul",
  "31": "Minas Gerais", "15": "Pará", "25": "Paraíba", "41": "Paraná",
  "26": "Pernambuco", "22": "Piauí", "33": "Rio de Janeiro", "24": "Rio Grande do Norte",
  "43": "Rio Grande do Sul", "11": "Rondônia", "14": "Roraima", "42": "Santa Catarina",
  "35": "São Paulo", "28": "Sergipe", "17": "Tocantins",
};

const IBGE_SIGLA_MAP: Record<string, string> = {
  "12":"AC","27":"AL","16":"AP","13":"AM","29":"BA","23":"CE","53":"DF",
  "32":"ES","52":"GO","21":"MA","51":"MT","50":"MS","31":"MG","15":"PA",
  "25":"PB","41":"PR","26":"PE","22":"PI","33":"RJ","24":"RN","43":"RS",
  "11":"RO","14":"RR","42":"SC","35":"SP","28":"SE","17":"TO",
};

const NATUREZA_CODIGO: Record<string, string> = {
  "presencial": "P",
  "online":     "L",
};


function gerarIdSolicitacao(dados: FormDados, tipo: string): string {
  const naturezaRaw = str(dados.natureza as string).toLowerCase();
  const tipoCode = tipo === "eventos"
    ? (NATUREZA_CODIGO[naturezaRaw] || "E")
    : "S";
  const setor = str(dados.setor as string);
  const setorCode = SETOR_CODIGO_MAP[setor] || "GRL";
  const now = new Date();
  const ano = now.getFullYear();
  const mes = String(now.getMonth() + 1).padStart(2, "0");
  const dia = String(now.getDate()).padStart(2, "0");
  const rand = String(randomInt(1000, 9999));
  return `${tipoCode}-${setorCode}-${ano}-${mes}-${dia}-${rand}`;
}


const ARQUIVO_LABELS: Record<string, string> = {
  arquivoBase:     "Arquivo base",
  arquivoApoio:    "Arquivo de apoio",
  materialAtual:   "Material atual",
  fotoPerfil:      "Foto de perfil",
  logoFile:        "Logo complementar de parceiro",
  imgFile:         "Imagem complementar",
  demaisFile:      "Demais arquivos de apoio",
  arquivoBaseNova: "Arquivo base (nova apresentação)",
  matEmailBase:    "Base para disparo de e-mail",
  palFoto1:        "Foto — Palestrante 1",
  palFoto2:        "Foto — Palestrante 2",
  palFoto3:        "Foto — Palestrante 3",
  palFoto4:        "Foto — Palestrante 4",
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
  { label: "Setor",                            id: "f0180f5e-1173-4905-8f57-01772a35806e", dadosKey: "setor",          clickupType: "short_text" },
  { label: "WhatsApp do Solicitante",          id: "852c5fcb-c50f-4b46-bba8-8173e19b2810", dadosKey: "whatsapp",       clickupType: "short_text" },
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
  const d = new Date(s + "T00:00:00-03:00");
  if (isNaN(d.getTime())) return s;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function humanizeEstado(raw: string | undefined): string | null {
  const s = str(raw);
  if (!s) return null;
  const mapped = IBGE_STATE_MAP[s];
  if (!mapped) {
    logger.warn({ raw: s }, "ClickUp: estado não encontrado no mapa IBGE, mantendo valor original");
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
  logger.warn({ email: user.email }, "ClickUp: setor não disponível na sessão, usando fallback Geral");
  return "Geral";
}

function humanizeRequestType(tipo: string): string {
  return FORM_SCHEMAS[tipo]?.label
    || TIPOS_COM_CLICKUP.find(t => t.tipo === tipo)?.label
    || tipo;
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
  const setor = getUserDepartment(user, dados);

  switch (tipo) {
    case "cartao-visita-fisico":
      return `[Cartão de Visita] ${str(dados.nomeCartao) || user.name}`;

    case "patrocinio": {
      const cidade = str(dados.cidade);
      const tituloEv = str(dados.tituloEvento);
      return cidade ? `[Patrocínio] ${tituloEv} - ${cidade}` : `[Patrocínio] ${tituloEv}`;
    }

    case "brindes":
      return `[Brinde] ${user.name} - ${setor}`;

    case "pagina-online":
      return `[Página Online] ${str(dados.titulo)} - ${setor}`;

    case "materiais-impressos": {
      const tipoMat = str(dados.tipoMaterial) || str(dados.tipoImpresso) || "Material";
      const tipoMatLabel = tipoMat.charAt(0).toUpperCase() + tipoMat.slice(1);
      return `[Material Impresso] ${tipoMatLabel} - ${setor}`;
    }

    case "ch-kit-onboarding":      return "[Capital Humano] Kit Onboarding";
    case "ch-atualizacao-pessoas": return "[Capital Humano] Atualização de Pessoas";
    case "ch-conteudo-pdf":        return "[Capital Humano] Conteúdo em PDF";
    case "ch-arte-divulgacao":     return "[Capital Humano] Arte de Divulgação";
    case "ch-atualizacao-books":   return "[Capital Humano] Atualização de Books";
    case "ch-linha-do-tempo": {
      const mes = str(dados.mes);
      return mes ? `[Capital Humano] Linha do Tempo - ${mes}` : "[Capital Humano] Linha do Tempo";
    }
    case "ch-aniversariantes": {
      const mes = str(dados.mes);
      return mes ? `[Capital Humano] Aniversariantes do Mês - ${mes}` : "[Capital Humano] Aniversariantes do Mês";
    }

    default: {
      const PREFIX_OVERRIDE: Record<string, string> = {
        "conteudo-pdf-informativo": "PDF", "conteudo-pdf-ebook": "PDF",
        "email-marketing": "E-mail", "email-marketing-online": "E-mail",
        "atualizacao-material": "Atualização",
      };
      const tipoHuman = PREFIX_OVERRIDE[tipo] || humanizeRequestType(tipo);
      const titulo = str(dados.titulo) || str(dados.nome_completo) || "";
      let name = `[${tipoHuman}]`;
      if (setor && setor !== "Geral") name += ` ${setor}`;
      if (titulo) name += ` - ${titulo}`;
      logger.info({ tipo, tipoHuman, setor, titulo, taskName: name }, "ClickUp: nome da task geral gerado");
      return name;
    }
  }
}

// ─────────────────────────────────────────────
// Description section builders — Eventos
// ─────────────────────────────────────────────

function buildRequesterSection(user: UserData, dados?: FormDados): string {
  const items: string[] = [];
  items.push(`• Solicitante: ${user.name}`);
  items.push(`• E-mail: ${user.email}`);
  if (dados) addLine(items, "Telefone", str(dados.telefone as string));
  logger.info({ nome: user.name, email: user.email }, "ClickUp: bloco solicitante montado");
  return `👤 SOLICITANTE\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
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
  addLine(items, "Setor solicitante", str(dados.setor as string));
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
  return `🎯 RESUMO DA SOLICITAÇÃO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
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
  return `🎤 PALESTRANTES\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
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
  return `📦 MATERIAIS SOLICITADOS\n━━━━━━━━━━━━━━━━━━━━━━\n\n${lines.join("\n").trimEnd()}`;
}

function buildEventDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));
  blocks.push(buildResumoSection(dados));
  const palestrantes = buildPalestrantesSection(dados);
  if (palestrantes) blocks.push(palestrantes);
  const materiais = buildMateriaisSection(dados);
  if (materiais) blocks.push(materiais);
  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);
  const obs = str(dados.observacoes);
  if (obs) blocks.push(`📝 OBSERVAÇÕES GERAIS\n━━━━━━━━━━━━━━━━━━━━━━\n\n• ${obs}`);
  logger.info({ blocos: blocks.length }, "ClickUp: descricao humanizada de evento gerada");
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
    addLine(items, "Nome completo", str(dados.nome_completo));
    addLine(items, "Código do assessor", str(dados.codigo_assessor));
    addLine(items, "Unidade", str(dados.unidade));
    addLine(items, "Contrato social", str(dados.contrato_social));
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
  return `📝 DETALHES\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
}

function buildArquivosSection(arquivos: ArquivosMap): string | null {
  const items: string[] = [];
  for (const [campo, url] of Object.entries(arquivos)) {
    if (!url) continue;
    const label = ARQUIVO_LABELS[campo] || campo.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, c => c.toUpperCase());
    items.push(`• ${label}: ${url}`);
  }
  if (items.length === 0) return null;
  return `📎 ARQUIVOS\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
}

function buildGeneralDescription(
  tipo: string,
  subtipo: string,
  dados: FormDados,
  user: UserData,
  arquivos: ArquivosMap
): string {
  const blocks: string[] = [];

  blocks.push(buildRequesterSection(user, dados));

  const tipoHuman = humanizeRequestType(tipo);
  const setor = getUserDepartment(user, dados);
  const resumoItems: string[] = [];
  addLine(resumoItems, "Tipo", tipoHuman);
  if (subtipo) addLine(resumoItems, "Subtipo", subtipo);
  if (setor) addLine(resumoItems, "Setor", setor);
  addLine(resumoItems, "Título", str(dados.titulo) || str(dados.nome_completo));
  addLine(resumoItems, "Finalidade", str(dados.finalidade));
  addLine(resumoItems, "Prazo desejado", str(dados.prazoEntrega));
  addLine(resumoItems, "Público-alvo", str(dados.publico as string) || str(dados.publicoAlvo));
  addLine(resumoItems, "Canais", str(dados.canais));
  if (resumoItems.length > 0) blocks.push(`📌 RESUMO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${resumoItems.join("\n")}`);

  const detalhes = buildDetailsSection(tipo, dados);
  if (detalhes) blocks.push(detalhes);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  const obs = str(dados.observacoes);
  if (obs) blocks.push(`📝 OBSERVAÇÕES GERAIS\n━━━━━━━━━━━━━━━━━━━━━━\n\n• ${obs}`);

  logger.info({ tipo, blocos: blocks.length }, "ClickUp: descricao geral humanizada gerada, JSON bruto removido");
  return blocks.join("\n\n");
}

// ─────────────────────────────────────────────
// Description builders — específicos por tipo
// ─────────────────────────────────────────────

function buildCartaoFisicoDescription(dados: FormDados, user: UserData): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));
  const items: string[] = [];
  items.push(`• Nome: ${str(dados.nomeCartao)}`);
  items.push(`• WhatsApp: ${str(dados.whatsapp)}`);
  items.push(`• E-mail: ${str(dados.emailCorporativo)}`);
  items.push(`• Contrato social: ${str(dados.contrato_social)}`);
  items.push(`• Unidade: ${str(dados.unidade)}`);
  items.push(`• Link para planilha: https://svninvest-my.sharepoint.com/:x:/r/personal/gabriela_franca_svninvest_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B7D66B897-EA4E-4C43-AB8C-20DB6B8B745C%7D&file=Solicitac%25u0327o%25u0303es%20Marketing.xlsx&nav=MTVfezAwMDAwMDAwLTAwMDEtMDAwMC0wNjAwLTAwMDAwMDAwMDAwMH0&action=default&mobileredirect=true`);
  blocks.push(`📇 CARTÃO DE VISITA\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);
  return blocks.join("\n\n");
}

function buildPatrocinioDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const resumoItems: string[] = [];
  addLine(resumoItems, "Título do evento", str(dados.tituloEvento));
  addLine(resumoItems, "Marcas parceiras", str(dados.marcasParceiras));
  addLine(resumoItems, "CPF/CNPJ das marcas", str(dados.cnpjParceiros));
  addLine(resumoItems, "Data do evento", formatDate(dados.dataEvento as string));
  addLine(resumoItems, "Horário", str(dados.horario));
  addLine(resumoItems, "Horário de Brasília?", str(dados.horBrasilia));
  addLine(resumoItems, "Estado", humanizeEstado(dados.estado as string));
  addLine(resumoItems, "Cidade", str(dados.cidade));
  addLine(resumoItems, "Local", str(dados.local));
  addLine(resumoItems, "Tipo de evento", str(dados.tipoEvento));
  addLine(resumoItems, "Público", str(dados.publico));
  if (resumoItems.length > 0)
    blocks.push(`📋 RESUMO DO EVENTO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${resumoItems.join("\n")}`);

  const explicacao = str(dados.explicacao);
  if (explicacao)
    blocks.push(`💡 IDEIA DO PATROCÍNIO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${explicacao}`);

  const matSection = buildMateriaisSection(dados);
  if (matSection) blocks.push(matSection);

  const finItems: string[] = [];
  addLine(finItems, "Centro de custo", str(dados.centroCusto));
  addLine(finItems, "Valor da cota", str(dados.valorCota));
  addLine(finItems, "Orçamento total", str(dados.orcamentoTotal));
  addLine(finItems, "Expectativa de retorno", str(dados.expectativaRetorno));
  addLine(finItems, "Orç. alimentação/pessoa", str(dados.orcAlimentacao));
  addLine(finItems, "Orç. material gráfico", str(dados.orcGrafico));
  addLine(finItems, "Orç. brindes", str(dados.orcBrindes));
  addLine(finItems, "Orç. equipe staff", str(dados.orcStaff));
  if (finItems.length > 0)
    blocks.push(`💰 FINANCEIRO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${finItems.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildBrindesDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Título", str(dados.titulo));
  addLine(items, "Finalidade", str(dados.finalidade));
  addLine(items, "Data de entrega", formatDate(dados.dataEntrega as string));
  addLine(items, "Itens solicitados", Array.isArray(dados.itens)
    ? (dados.itens as string[]).join(", ")
    : str(dados.itens));
  addLine(items, "Personalização", str(dados.personalizacao));
  addLine(items, "Texto cartão presente", str(dados.textoCartaoPresente));
  if (items.length > 0)
    blocks.push(`📦 BRINDE\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildPaginaOnlineDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Título da página", str(dados.titulo));
  addLine(items, "Finalidade", str(dados.finalidade));
  if (items.length > 0)
    blocks.push(`🌐 PÁGINA ONLINE\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildMateriaisImpressosDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Tipo de material", str(dados.tipoMaterial) || str(dados.tipoImpresso));
  addLine(items, "Formato do papel", str(dados.formatoPapel));
  addLine(items, "Orientação", str(dados.orientacao));
  addLine(items, "Tamanho", str(dados.tamanhoBanner) || str(dados.tamanhoAdesivo));
  addLine(items, "Tipo de adesivo", str(dados.tipoAdesivo));
  addLine(items, "Tipo de camiseta", str(dados.tipoCamiseta));
  addLine(items, "Cor", str(dados.corCamiseta));
  addLine(items, "Quantidade/tamanhos", str(dados.qtdTamanhos));
  addLine(items, "Fornecedor", str(dados.fornecedor));
  addLine(items, "Conteúdo selecionado", str(dados.conteudoSelecionado));
  addLine(items, "Link do QR Code", str(dados.qrLink));
  if (items.length > 0)
    blocks.push(`🖨️ MATERIAL IMPRESSO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const conteudo = str(dados.conteudoMaterial);
  if (conteudo)
    blocks.push(`📝 CONTEÚDO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${conteudo}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildEmailMarketingDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Assunto", str(dados.assunto));
  addLine(items, "Finalidade", str(dados.finalidade));
  addLine(items, "Tema e resumo", str(dados.tema));
  addLine(items, "Data de disparo", formatDate(dados.dataDisparo as string));
  addLine(items, "Enviar por (remetente)", str(dados.remetente));
  addLine(items, "Assinatura do e-mail", str(dados.assinaturaEmail));
  if (items.length > 0)
    blocks.push(`✉️ E-MAIL MARKETING\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildProducaoAudiovisualDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap, tipo: string): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const isVideo = tipo === "producao-video";

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Modalidade", isVideo ? "Produção de Vídeo" : "Sessão de Fotos");
  addLine(items, "Título", str(dados.titulo) || str(dados.tituloFotos));
  addLine(items, "Objetivo / Ideia", str(dados.ideia) || str(dados.objetivo) || str(dados.descricaoFotos));
  addLine(items, "Participantes", str(dados.qtdParticipantes));
  addLine(items, "Local", str(dados.localSessao));
  addLine(items, "Formato", Array.isArray(dados.formato)
    ? (dados.formato as string[]).join(", ")
    : str(dados.formato));
  addLine(items, "Restrições", str(dados.restricoes));
  if (items.length > 0)
    blocks.push(`🎥 PRODUÇÃO AUDIOVISUAL\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

  return blocks.join("\n\n");
}

function buildOutroDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user, dados));

  const items: string[] = [];
  addLine(items, "Setor", str(dados.setor as string));
  addLine(items, "Título", str(dados.titulo));
  addLine(items, "Finalidade", str(dados.finalidade));
  if (items.length > 0)
    blocks.push(`📋 RESUMO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);

  const descricao = str(dados.descricao);
  if (descricao)
    blocks.push(`📝 DESCRIÇÃO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${descricao}`);

  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);

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
  // ── Cópia local para campos computados — não muta o objeto original ────────
  const dadosLocal: Record<string, unknown> = { ...dados };

  // ── Campos computados: calcular antes do Promise.all ──────────────────────
  const localHuman = humanizeLocal(dados);

  const cidadeRaw = str(dados.cidade as string);
  const estadoRaw = str(dados.estado as string);
  if (cidadeRaw) {
    const sigla = IBGE_SIGLA_MAP[estadoRaw] || estadoRaw;
    dadosLocal._cidadeFormatada = sigla ? `${cidadeRaw} - ${sigla}` : cidadeRaw;
  }

  const localEvento = str(dados.localEvento as string);
  // UNIDADES_ENDERECOS vem de ../config/unidades (fonte única).
  if (localEvento === "unidade") {
    const unidade = str(dados.unidadeSVN as string);
    const enderecoUnidade = UNIDADES_ENDERECOS[unidade];
    if (enderecoUnidade) {
      dadosLocal.localEndereco = enderecoUnidade;
      logger.info({ unidade, endereco: enderecoUnidade }, "ClickUp: endereço da unidade SVN injetado");
    }
  }

  const materiaisArr = dados.materiais as string[] | undefined;
  const materiaisText = (Array.isArray(materiaisArr) && materiaisArr.length > 0)
    ? materiaisArr.map(id => `• ${MATERIAL_LABELS[id] || id}`).join("\n")
    : null;

  // ── Campos fixos computados em paralelo ────────────────────────────────────
  await Promise.all([
    user.email
      ? setClickUpCustomField(taskId, "ae56f16a-8d97-40e0-9032-c357eb0793ca", user.email, "E-mail do Solicitante", { clickupType: "short_text", raw: user.email })
      : Promise.resolve(),
    localHuman
      ? setClickUpCustomField(taskId, "38ac133a-13b0-4428-98eb-adb5f8cdc23a", localHuman, "Local do evento", { clickupType: "short_text" })
      : Promise.resolve(),
    materiaisText
      ? setClickUpCustomField(taskId, "3266524c-febc-47ac-a76d-0d9c4256d9dc", materiaisText, "Solicitações", { clickupType: "text", raw: materiaisArr })
      : Promise.resolve(),
  ]);

  // ── Campos da lista EVENTOS_CUSTOM_FIELDS — paralelo em lotes de 10 ────────
  const fieldThunks: Array<() => Promise<void>> = [];

  for (const field of EVENTOS_CUSTOM_FIELDS) {
    let value: string | null;

    if (field.isArquivo) {
      const url = arquivos[field.dadosKey] || null;
      if (!url) { logger.warn({ taskId, label: field.label }, "ClickUp: arquivo sem URL, pulando"); continue; }
      value = url;
    } else {
      const raw = field.dadosKey in dadosLocal ? dadosLocal[field.dadosKey] : dados[field.dadosKey];
      if (raw === undefined || raw === null || str(raw as string) === "") {
        logger.warn({ taskId, label: field.label, dadosKey: field.dadosKey }, "ClickUp: campo sem valor, pulando");
        continue;
      }
      if (field.dadosKey === "dataEvento") {
        value = formatDate(String(raw)) ?? String(raw);
      } else if (field.dadosKey === "natureza") {
        const n = str(raw as string).toLowerCase();
        value = n === "presencial" ? "Presencial" : n === "online" ? "Online" : str(raw as string);
      } else {
        value = str(raw as string);
      }
    }

    const capturedValue = value;
    fieldThunks.push(
      () => setClickUpCustomField(taskId, field.id, capturedValue, field.label, {
        clickupType: field.clickupType,
        raw: field.dadosKey in dadosLocal ? dadosLocal[field.dadosKey] : dados[field.dadosKey],
      })
    );
  }

  const BATCH_SIZE = 10;
  for (let i = 0; i < fieldThunks.length; i += BATCH_SIZE) {
    await Promise.all(fieldThunks.slice(i, i + BATCH_SIZE).map(t => t()));
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
  const titulo = str(dados.titulo) || str(dados.nome_completo) || null;
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

  // ── Campos short_text e text — paralelo ───────────────────────────────────
  await Promise.all(
    textFields
      .filter(({ value }) => {
        if (!value) { logger.warn({ taskId, label: "campo geral" }, "ClickUp: campo geral sem valor, pulando"); return false; }
        return true;
      })
      .map(({ id, value, label, clickupType }) =>
        setClickUpCustomField(taskId, id, value, label, { clickupType, raw: value })
      )
  );

  // ── Dropdown, prazo e arquivos — paralelo ──────────────────────────────────
  const tipoDemandaOrderindex = TIPO_DEMANDA_ORDERINDEX[tipo] ?? 3;
  const prazoRaw = str(dados.prazoEntrega as string);
  const prazoDate = prazoRaw ? new Date(prazoRaw + "T12:00:00-03:00") : null;
  if (prazoRaw && prazoDate && isNaN(prazoDate.getTime())) {
    logger.warn({ taskId, prazoRaw }, "ClickUp: data de prazo inválida, pulando");
  }

  await Promise.all([
    setClickUpCustomField(
      taskId, "ea901547-2f65-42ee-ab6c-5fbf0ceaa79b", tipoDemandaOrderindex, "Tipo de Demanda",
      { clickupType: "drop_down", raw: tipo }
    ),
    prazoDate && !isNaN(prazoDate.getTime())
      ? setClickUpCustomField(taskId, "33c5d4c5-1e0d-48ba-b0a5-6decdea6e138", prazoDate.getTime(), "Prazo de entrega", { clickupType: "date", raw: prazoRaw })
      : Promise.resolve(),
    arquivoPrincipal
      ? setClickUpCustomField(taskId, "294f47eb-82a7-416e-998e-ea79b77d296b", arquivoPrincipal, "Arquivo principal", { clickupType: "url" })
      : Promise.resolve(),
    arquivoApoio
      ? setClickUpCustomField(taskId, "67d565fd-ca4f-472b-969b-4b5228459e0f", arquivoApoio, "Arquivo de apoio", { clickupType: "url" })
      : Promise.resolve(),
  ]);
}

// ─────────────────────────────────────────────
// Custom-field payload builders (used in initial task creation POST)
// ─────────────────────────────────────────────

function buildEventosCustomFieldsArray(
  dados: FormDados,
  arquivos: ArquivosMap,
  user: UserData,
): Array<{ id: string; value: unknown }> {
  const fields: Array<{ id: string; value: unknown }> = [];
  const dadosLocal: Record<string, unknown> = { ...dados };

  const localHuman = humanizeLocal(dados);

  const cidadeRaw = str(dados.cidade as string);
  const estadoRaw = str(dados.estado as string);
  if (cidadeRaw) {
    const sigla = IBGE_SIGLA_MAP[estadoRaw] || estadoRaw;
    dadosLocal._cidadeFormatada = sigla ? `${cidadeRaw} - ${sigla}` : cidadeRaw;
  }

  const localEvento = str(dados.localEvento as string);
  if (localEvento === "unidade") {
    const unidade = str(dados.unidadeSVN as string);
    const enderecoUnidade = UNIDADES_ENDERECOS[unidade];
    if (enderecoUnidade) dadosLocal.localEndereco = enderecoUnidade;
  }

  const materiaisArr = dados.materiais as string[] | undefined;
  const materiaisText = (Array.isArray(materiaisArr) && materiaisArr.length > 0)
    ? materiaisArr.map(id => `• ${MATERIAL_LABELS[id] || id}`).join("\n")
    : null;

  if (user.email) fields.push({ id: "ae56f16a-8d97-40e0-9032-c357eb0793ca", value: user.email });
  if (localHuman) fields.push({ id: "38ac133a-13b0-4428-98eb-adb5f8cdc23a", value: localHuman });
  if (materiaisText) fields.push({ id: "3266524c-febc-47ac-a76d-0d9c4256d9dc", value: materiaisText });

  for (const field of EVENTOS_CUSTOM_FIELDS) {
    let value: string | null;
    if (field.isArquivo) {
      const url = arquivos[field.dadosKey] || null;
      if (!url) continue;
      value = url;
    } else {
      const raw = field.dadosKey in dadosLocal ? dadosLocal[field.dadosKey] : dados[field.dadosKey];
      if (raw === undefined || raw === null || str(raw as string) === "") continue;
      if (field.dadosKey === "dataEvento") {
        value = formatDate(String(raw)) ?? String(raw);
      } else if (field.dadosKey === "natureza") {
        const n = str(raw as string).toLowerCase();
        value = n === "presencial" ? "Presencial" : n === "online" ? "Online" : str(raw as string);
      } else {
        value = str(raw as string);
      }
    }
    if (value !== null) fields.push({ id: field.id, value });
  }

  return fields;
}

function buildPatrocinioCustomFieldsArray(
  dados: FormDados,
  user: UserData,
): Array<{ id: string; value: unknown }> {
  const fields: Array<{ id: string; value: unknown }> = [];
  const cidadeRaw = str(dados.cidade as string);
  const estadoRaw = str(dados.estado as string);
  const sigla = IBGE_SIGLA_MAP[estadoRaw] || estadoRaw;
  const cidadeFmt = cidadeRaw ? (sigla ? `${cidadeRaw} - ${sigla}` : cidadeRaw) : null;

  const pairs: Array<[string, unknown]> = [
    ["92db4658-70d1-430e-98ec-5e27029136fd", str(dados.nome as string) || null],
    ["852c5fcb-c50f-4b46-bba8-8173e19b2810", str(dados.telefone as string) || str(dados.whatsapp as string) || null],
    ["f0180f5e-1173-4905-8f57-01772a35806e", str(dados.setor as string) || null],
    ["ae56f16a-8d97-40e0-9032-c357eb0793ca", user.email || null],
    ["b40d49f5-341d-4671-a4f0-7cef7a643d6b", str(dados.tituloEvento as string) || null],
    ["751276aa-588f-4f01-a6b1-da298c9d6679", str(dados.marcasParceiras as string) || null],
    ["a464441b-a308-419b-9342-2b88f2d97fc8", str(dados.cnpjParceiros as string) || null],
    ["361cb66a-8c99-43ec-a4fa-5a347e9a4fbd", str(dados.dataEvento as string) || null],
    ["45d8babe-a7dd-4a78-952f-1aa366bf34ed", str(dados.horario as string) || null],
    ["af7d26c8-f228-4985-941a-20bb6905b6d5", str(dados.horBrasilia as string) || null],
    ["38ac133a-13b0-4428-98eb-adb5f8cdc23a", str(dados.local as string) || null],
    ["ded0be23-c50e-4f82-8b81-66a73dcc42a8", cidadeFmt],
    ["c81a416c-a09d-41f4-a003-5261bf6edce6", str(dados.tipoEvento as string) || null],
    ["c7585104-7f53-4dcb-95d6-c75d55c4c57b", str(dados.publico as string) || null],
    ["c3469fb5-7274-4233-8845-8d3762d0682c", str(dados.centroCusto as string) || null],
    ["8157ba96-658f-4bab-8364-fa443d9d582b", str(dados.valorCota as string) || null],
    ["de09cf5f-3e69-48de-bb7f-bececcf55f95", str(dados.orcamentoTotal as string) || null],
  ];
  for (const [id, value] of pairs) {
    if (value) fields.push({ id, value });
  }
  fields.push({ id: "ea901547-2f65-42ee-ab6c-5fbf0ceaa79b", value: 10 });
  return fields;
}

function buildGeneralCustomFieldsArray(
  tipo: string,
  dados: FormDados,
  arquivos: ArquivosMap,
): Array<{ id: string; value: unknown }> {
  const fields: Array<{ id: string; value: unknown }> = [];

  const titulo = str(dados.titulo) || str(dados.nome_completo) || null;
  const publicoAlvo = str(dados.publico as string) || str(dados.publicoAlvo as string) || null;
  const arquivoPrincipal = arquivos.materialAtual || arquivos.arquivoBase || null;
  const arquivoApoio = arquivos.arquivoApoio || arquivos.fotoPerfil || null;

  const textPairs: Array<[string, unknown, string]> = [
    ["6e36326f-2501-4ce2-9894-13d4ddf222d4", str(dados.nome) || null,        "Nome do solicitante"],
    ["b727b647-0da1-43a5-a82d-70c33dedf0fd", titulo,                         "Título"],
    ["5d7ae6e5-8528-4df3-bf0c-ed3bb05ebee1", str(dados.finalidade) || null,  "Finalidade"],
    ["c7585104-7f53-4dcb-95d6-c75d55c4c57b", publicoAlvo,                    "Público-alvo"],
    ["ea38779d-385c-410b-972e-ba97499e9252", str(dados.canais) || null,       "Canais"],
    ["f80ba423-ccae-464c-9d20-6665c7f1da00", str(dados.observacoes) || null, "Observações"],
  ];

  for (const [id, value, label] of textPairs) {
    if (!value) { logger.warn({ label }, "ClickUp: campo geral sem valor, pulando"); continue; }
    fields.push({ id, value });
  }

  fields.push({ id: "ea901547-2f65-42ee-ab6c-5fbf0ceaa79b", value: TIPO_DEMANDA_ORDERINDEX[tipo] ?? 3 });

  const prazoRaw = str(dados.prazoEntrega as string);
  if (prazoRaw) {
    const prazoDate = new Date(prazoRaw + "T12:00:00-03:00");
    if (!isNaN(prazoDate.getTime())) {
      fields.push({ id: "33c5d4c5-1e0d-48ba-b0a5-6decdea6e138", value: prazoDate.getTime() });
    }
  }

  if (arquivoPrincipal) fields.push({ id: "294f47eb-82a7-416e-998e-ea79b77d296b", value: arquivoPrincipal });
  if (arquivoApoio) fields.push({ id: "67d565fd-ca4f-472b-969b-4b5228459e0f", value: arquivoApoio });

  return fields;
}

// ─────────────────────────────────────────────
// Core public functions
// ─────────────────────────────────────────────

async function getListId(tipoSolicitacao: string): Promise<string> {
  try {
    // 1) lista específica configurada para este tipo
    const [row] = await db
      .select({ list_id: tipoClickupListTable.list_id })
      .from(tipoClickupListTable)
      .where(eq(tipoClickupListTable.tipo, tipoSolicitacao));
    if (row?.list_id) {
      logger.info({ tipo: tipoSolicitacao, listId: row.list_id }, "ClickUp: lista por tipo (banco)");
      return row.list_id;
    }
    // 2) fallback configurável: linha "_default" (Geral), também editável na interface
    const [def] = await db
      .select({ list_id: tipoClickupListTable.list_id })
      .from(tipoClickupListTable)
      .where(eq(tipoClickupListTable.tipo, "_default"));
    if (def?.list_id) {
      logger.info({ tipo: tipoSolicitacao, listId: def.list_id }, "ClickUp: lista default (banco)");
      return def.list_id;
    }
  } catch (err) {
    logger.error({ err, tipo: tipoSolicitacao }, "getListId: erro ao ler config do banco");
  }
  // 3) fallback final hardcoded — segurança pra nunca enviar lista vazia
  logger.warn({ tipo: tipoSolicitacao, listId: CLICKUP_LIST_GERAL }, "ClickUp: usando lista default hardcoded (sem config no banco)");
  return CLICKUP_LIST_GERAL;
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

const PRAZO_DIAS_UTEIS: Record<string, number> = {
  "pagina-assessores-dados":       3,
  "pagina-assessores-atualizacao": 2,
  "apresentacao-nova":             5,
  "apresentacao-atualizar":        5,
  "artes-divulgacao":              3,
  "atualizacao-material":          3,
  "conteudo-pdf-informativo":      4,
  "conteudo-pdf-ebook":            15,
  "pagina-online":                 5,
  "outro":                         7,
  "email-marketing":               3,
  "producao-video":                7,
  "sessao-fotos":                  7,
  "materiais-impressos":           5,
  "brindes":                       15,
  "patrocinio":                    30,
};


function proximaQuarta(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const dow = d.getDay();
  const diasAte = (3 - dow + 7) % 7 || 7;
  d.setDate(d.getDate() + diasAte);
  return d;
}

async function getAssigneesForTipo(tipo: string): Promise<Array<{ id: number; name: string }>> {
  try {
    const rows = await db
      .select({
        clickup_user_id: usersTable.clickup_user_id,
        name: usersTable.name,
      })
      .from(userTipoAssignmentsTable)
      .innerJoin(usersTable, eq(userTipoAssignmentsTable.user_id, usersTable.id))
      .where(eq(userTipoAssignmentsTable.tipo, tipo));
    return rows
      .map(r => ({ id: parseInt(r.clickup_user_id ?? "", 10), name: r.name ?? "" }))
      .filter(r => !isNaN(r.id));
  } catch (err) {
    logger.error({ err, tipo }, "getAssigneesForTipo: erro ao buscar assignees no DB");
    return [];
  }
}

export async function createClickUpTask(
  solicitacao: SolicitacaoData,
  user: UserData,
  dados: FormDados,
  arquivos?: ArquivosMap
): Promise<{ taskId: string | null; taskName: string; responsavel: string }> {
  if (!CLICKUP_API_TOKEN) {
    logger.warn("CLICKUP_API_TOKEN not configured, skipping task creation");
    return { taskId: null, taskName: "", responsavel: "" };
  }

  const tipo = solicitacao.tipo_solicitacao;

  if (FORM_SCHEMAS[tipo]?.has_clickup === false) {
    logger.info({ tipo }, "ClickUp: tipo sem integração, pulando");
    return { taskId: null, taskName: "", responsavel: "" };
  }
  const subtipo = solicitacao.subtipo || "";
  const safeArquivos = arquivos || {};
  const listId = await getListId(tipo);

  let taskName: string;
  let description: string;

  if (tipo === "eventos") {
    taskName = buildClickUpEventTaskName(dados);
    description = buildEventDescription(dados, user, safeArquivos);
  } else if (tipo === "cartao-visita-fisico") {
    taskName = `[Cartão de Visita] ${str(dados.nomeCartao) || user.name}`;
    description = buildCartaoFisicoDescription(dados, user);
  } else if (tipo === "patrocinio") {
    const cidade = str(dados.cidade);
    const tituloEv = str(dados.tituloEvento);
    taskName = cidade ? `[Patrocínio] ${tituloEv} - ${cidade}` : `[Patrocínio] ${tituloEv}`;
    description = buildPatrocinioDescription(dados, user, safeArquivos);
  } else if (tipo === "brindes") {
    const setor = getUserDepartment(user, dados);
    taskName = `[Brinde] ${user.name} - ${setor}`;
    description = buildBrindesDescription(dados, user, safeArquivos);
  } else if (tipo === "pagina-online") {
    const setor = getUserDepartment(user, dados);
    taskName = `[Página Online] ${str(dados.titulo)} - ${setor}`;
    description = buildPaginaOnlineDescription(dados, user, safeArquivos);
  } else if (tipo === "materiais-impressos") {
    const setor = getUserDepartment(user, dados);
    const tipoMat = str(dados.tipoMaterial) || str(dados.tipoImpresso) || "Material";
    const tipoLabel = tipoMat.charAt(0).toUpperCase() + tipoMat.slice(1);
    taskName = `[Material Impresso] ${tipoLabel} - ${setor}`;
    description = buildMateriaisImpressosDescription(dados, user, safeArquivos);
  } else if (tipo === "email-marketing") {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildEmailMarketingDescription(dados, user, safeArquivos);
  } else if (tipo === "producao-video" || tipo === "sessao-fotos") {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildProducaoAudiovisualDescription(dados, user, safeArquivos, tipo);
  } else if (tipo === "outro") {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildOutroDescription(dados, user, safeArquivos);
  } else {
    taskName = buildGeneralTaskName(tipo, subtipo, dados, user);
    description = buildGeneralDescription(tipo, subtipo, dados, user, safeArquivos);
  }

  logger.info({ tipo, listId, taskName, descriptionLength: description.length }, "ClickUp: criando task");

  const taskPayload: Record<string, unknown> = { name: taskName, description };
  if (tipo === "eventos") taskPayload.status = "Solicitações";

  // Datas de início e prazo
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  taskPayload.start_date = hoje.getTime();
  taskPayload.start_date_time = false;

  let prazoDate: Date;
  if (tipo === "cartao-visita-fisico") {
    prazoDate = proximaQuarta();
  } else {
    let diasUteis = PRAZO_DIAS_UTEIS[tipo] ?? 3;
    if (tipo === "apresentacao-nova" || tipo === "apresentacao-atualizar") {
      const qtd = parseInt(String((dados as Record<string, unknown>).qtdPaginas || "0"), 10);
      if (qtd > 20) diasUteis = 15;
    }
    prazoDate = addBusinessDays(new Date(), diasUteis);
    prazoDate.setHours(12, 0, 0, 0);
  }
  taskPayload.due_date = prazoDate.getTime();
  taskPayload.due_date_time = false;
  logger.info({ tipo, prazo: prazoDate.toISOString() }, "ClickUp: prazo calculado");

  // Eventos: prazo (due_date) = data do evento; prioridade pela proximidade
  if (tipo === "eventos") {
    const dataEvento = str((dados as Record<string, unknown>).dataEvento);
    const evDate = dataEvento ? new Date(dataEvento + "T12:00:00-03:00") : null;
    if (evDate && !isNaN(evDate.getTime())) {
      taskPayload.due_date = evDate.getTime();
      taskPayload.due_date_time = false;
      const diasAteEvento = Math.ceil((evDate.getTime() - hoje.getTime()) / 86400000);
      taskPayload.priority = diasAteEvento <= 3 ? 1 : diasAteEvento <= 7 ? 2 : 3;
      logger.info({ dataEvento, diasAteEvento, priority: taskPayload.priority }, "ClickUp: evento — due_date e prioridade definidos");
    }
  }

  // Responsáveis por tipo (via DB)
  const assignees = await getAssigneesForTipo(tipo);
  if (assignees.length > 0) {
    taskPayload.assignees = assignees.map(a => a.id);
    logger.info({ assigneeIds: assignees.map(a => a.id), tipo }, "ClickUp: assignees definidos via DB");
  } else {
    logger.warn({ tipo }, "ClickUp: nenhum assignee encontrado no DB para este tipo");
  }

  // Agrupa todos os custom_fields no payload inicial (evita N PATCH requests pós-criação)
  const idSolicitacao = gerarIdSolicitacao(dados, tipo);
  const customFieldsBase: Array<{ id: string; value: unknown }> = [
    { id: "4a8493f1-dfc8-49b4-9372-f6df80d62816", value: idSolicitacao },
  ];
  const customFieldsSpecific = tipo === "eventos"
    ? buildEventosCustomFieldsArray(dados, safeArquivos, user)
    : tipo === "patrocinio"
    ? buildPatrocinioCustomFieldsArray(dados, user)
    : buildGeneralCustomFieldsArray(tipo, dados, safeArquivos);
  taskPayload.custom_fields = [...customFieldsSpecific, ...customFieldsBase];

  logger.info({ tipo, listId, taskName, customFieldCount: (taskPayload.custom_fields as unknown[]).length }, "ClickUp: payload final antes do POST");

  let taskId: string | null = null;

  try {
    const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: "POST",
      headers: { "Authorization": CLICKUP_API_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(taskPayload),
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error({ tipo, listId, taskName, httpStatus: response.status, body: text }, "ClickUp: erro ao criar task");
      return { taskId: null, taskName, responsavel: "" };
    }
    const data = await response.json() as { id?: string };
    taskId = data.id || null;
  } catch (err) {
    logger.error({ err, tipo, listId }, "ClickUp: falha na criação da task");
    return { taskId: null, taskName, responsavel: "" };
  }

  if (!taskId) return { taskId: null, taskName, responsavel: "" };
  logger.info({ taskId, tipo, listId, taskName, idSolicitacao }, "ClickUp: task criada com sucesso");

  const responsavel = assignees.length > 0 ? assignees[0].name : "";

  return { taskId, taskName, responsavel };
}

export async function getClickUpTaskStatus(taskId: string): Promise<string | null> {
  if (!CLICKUP_API_TOKEN) return null;
  try {
    const response = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      headers: { "Authorization": CLICKUP_API_TOKEN },
    });
    if (!response.ok) return null;
    const data = await response.json() as { status?: { status?: string } };
    return mapClickUpStatus(data.status?.status || "");
  } catch {
    return null;
  }
}
