
let URL_MANUAL = "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/Manual-de-Eventos-SVN.pdf";
let URL_APRESENTACAO = "https://hub.portalsvn.com.br/solicitacoes.html";
let URL_STORE = "https://store.portalsvn.com.br/";
let URL_TUTORIAL_TRANSMISSAO = "https://drive.google.com/file/d/1L36fFqFC-sEPWggNmlZOUNnY2DqxP8HK/view?usp=sharing";

let URL_VIDEO_HERO = "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/bg-eventos-2.mp4";
let URL_LOGO_BRANCA = "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-2.svg";
let URL_LOGO_PRETA = "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-1.svg";
let PACOTE_PADRAO_IMAGENS = [
  "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/Convite.png",
  "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/tela1.png"
];

let EMAIL_UPLOAD = "gabriela.franca@svninvest.com.br";

// FALLBACK só pra evitar tela em branco se /api/form-schemas falhar.
// FONTE DA VERDADE: src/config/form-schemas.ts (MARCAS_OPTS) — não editar aqui.
window.MARCAS_OPTS_FORM = [];

const _configReady = Promise.all([
  fetch('/api/config').then(r => r.json()).catch(() => ({})),
  fetch('/api/form-schemas').then(r => r.json()).catch(() => ({})),
]).then(([cfg, schemas]) => {
  if (cfg.urlManual) URL_MANUAL = cfg.urlManual;
  if (cfg.urlTutorialTransmissao) URL_TUTORIAL_TRANSMISSAO = cfg.urlTutorialTransmissao;
  if (cfg.urlVideoHero) URL_VIDEO_HERO = cfg.urlVideoHero;
  if (cfg.urlLogoBranca) URL_LOGO_BRANCA = cfg.urlLogoBranca;
  if (cfg.urlLogoPreta) URL_LOGO_PRETA = cfg.urlLogoPreta;
  if (cfg.emailUpload) EMAIL_UPLOAD = cfg.emailUpload;
  if (cfg.r2PublicUrl) {
    PACOTE_PADRAO_IMAGENS = [
      cfg.r2PublicUrl + '/Convite.png',
      cfg.r2PublicUrl + '/tela1.png'
    ];
  }
  if (schemas.marcas && schemas.marcas.length) {
    MARCAS_SVN = schemas.marcas.map(m => m.label);
    window.MARCAS_OPTS_FORM = schemas.marcas;
  }
  if (schemas.contratos && schemas.contratos.length) CONTRATOS_SOCIAIS = schemas.contratos.map(c => c.label);
  if (schemas.cargos && schemas.cargos.length) CARGOS_ASSESSOR = schemas.cargos.map(c => c.label);
  if (schemas.setores && schemas.setores.length) SETORES = ['Selecione seu setor', ...schemas.setores];
  if (schemas.tipos) {
    window._svnFormSchemas = schemas;
    const fl = {};
    for (const t of schemas.tipos) {
      if (!t.field_options) continue;
      for (const [k, m] of Object.entries(t.field_options)) fl[k] = Object.assign(fl[k] || {}, m);
    }
    window._svnFieldLabels = fl;   // { campo: { valor: label_autoral } }
  }
  if (schemas.labels && typeof schemas.labels === 'object') {
    Object.assign(TIPO_SOLICITACAO_LABELS, schemas.labels);
  }
});

const MSG_THANKYOU_TITULO = "Solicitação enviada com sucesso!";
const MSG_THANKYOU_SUBTITULO = "Sua solicitação foi recebida! Nossa equipe de Marketing analisará em breve e entrará em contato.";
const MSG_THANKYOU_BOTAO = "Ver minha solicitação";

const CATEGORIAS_SOLICITACAO = [
  {
    categoria: "Identidade e materiais pessoais",
    itens: [
      { id: "pagina-assessores", label: "Página de Assessores", icon: "icon-user", ativo: true },
      { id: "assinatura-email", label: "Assinatura de E-mail", icon: "icon-mail", ativo: true },
      { id: "cartao-visita", label: "Cartão de Visita", icon: "icon-credit-card", ativo: true },
      { id: "cartao-boas-vindas", label: "Cartão de Boas-vindas", icon: "icon-user-plus", ativo: true },
      { id: "cartao-comemorativo", label: "Cartão Comemorativo", icon: "icon-party-popper", ativo: true },
      { id: "divulgacao-nps", label: "Divulgação NPS", icon: "icon-star", ativo: true },
      { id: "convite-fp", label: "Convite Financial Planning", icon: "icon-envelope", ativo: true },
    ]
  },
  {
    categoria: "Eventos e relacionamento",
    itens: [
      { id: "eventos", label: "Eventos", icon: "icon-calendar", ativo: true },
      { id: "patrocinio", label: "Patrocínio", icon: "icon-flag", ativo: true },
      { id: "brindes", label: "Brindes", icon: "icon-gift", ativo: true },
      { id: "pagina-online", label: "Página Online", icon: "icon-globe", ativo: true },
    ]
  },
  {
    categoria: "Marketing e conteúdo",
    itens: [
      { id: "artes-divulgacao", label: "Artes de Divulgação", icon: "icon-image", ativo: true },
      { id: "apresentacao", label: "Apresentação", icon: "icon-monitor", ativo: true },
      { id: "conteudo-pdf", label: "Conteúdo em PDF", icon: "icon-file-pdf", ativo: true },
      { id: "email-marketing", label: "E-mail Marketing", icon: "icon-send", ativo: true },
      { id: "atualizacao-material", label: "Atualização de material", icon: "icon-refresh", ativo: true },
      { id: "materiais-impressos", label: "Materiais Impressos", icon: "icon-printer", ativo: true },
    ]
  },
  {
    categoria: "Audiovisual",
    itens: [
      { id: "producao-audiovisual", label: "Produção Audiovisual", icon: "icon-video", ativo: true },
    ]
  },
  {
    categoria: "Outros",
    layout: "single",
    itens: [
      { id: "outro", label: "Outro", icon: "icon-edit", ativo: true },
    ]
  },
];

const TIPO_SOLICITACAO_LABELS = {
  "eventos":                        "Evento",
  "pagina-assessores-dados":        "Página de Assessores — Dados",
  "pagina-assessores-atualizacao":  "Página de Assessores — Atualização",
  "pagina-assessores":              "Página de Assessores",
  "apresentacao-nova":              "Apresentação — Nova",
  "apresentacao-atualizar":         "Apresentação — Atualização",
  "apresentacao":                   "Apresentação",
  "artes-divulgacao":               "Arte de Divulgação",
  "conteudo-pdf-informativo":       "PDF — Informativo",
  "conteudo-pdf-ebook":             "PDF — Ebook",
  "conteudo-pdf":                   "Conteúdo em PDF",
  "atualizacao-material":           "Atualização de Material",
  "assinatura-email":               "Assinatura de E-mail",
  "cartao-visita-fisico":           "Cartão de Visita — Físico",
  "cartao-visita-digital":          "Cartão de Visita — Digital",
  "cartao-visita":                  "Cartão de Visita",
  "cartao-boas-vindas":             "Cartão de Boas-vindas",
  "cartao-comemorativo":            "Cartão Comemorativo",
  "divulgacao-nps":                 "Arte NPS",
  "convite-fp":                     "Convite Financial Planning",
  "email-marketing":                "E-mail Marketing",
  "patrocinio":                     "Patrocínio",
  "brindes":                        "Brindes",
  "pagina-online":                  "Página Online",
  "producao-video":                 "Produção de Vídeo",
  "sessao-fotos":                   "Sessão de Fotos",
  "materiais-impressos":            "Materiais Impressos",
  "outro":                          "Outro",
  // Capital Humano
  "ch-kit-onboarding":              "Kit Onboarding",
  "ch-atualizacao-pessoas":         "Atualização de Pessoas nos Sites",
  "ch-conteudo-pdf":                "Conteúdo em PDF (CH)",
  "ch-arte-divulgacao":             "Arte de Divulgação (CH)",
  "ch-atualizacao-books":           "Atualização de Books",
  "ch-linha-do-tempo":              "Linha do Tempo",
  "ch-aniversariantes":             "Aniversariantes do Mês",
};

// FALLBACK só pra evitar tela em branco se /api/form-schemas falhar.
// FONTE DA VERDADE: src/config/form-schemas.ts — não editar aqui.
let CONTRATOS_SOCIAIS = [];

// FALLBACK só pra evitar tela em branco se /api/form-schemas falhar.
// FONTE DA VERDADE: src/config/form-schemas.ts — não editar aqui.
let MARCAS_SVN = [];

let CARGOS_ASSESSOR = [
  "Assessor de Investimentos",
  "Assessora de Investimentos",
  "Sócio e Assessor de Investimentos",
  "Sócia e Assessora de Investimentos",
];

// DRAWER_FIELD_LABELS — labels exibidos no detalhe da solicitação.
// As 9 chaves camelCase do KEY_MAP (contratoSocial, nomeAssinatura, etc) servem só
// pra retrocompatibilidade com dados legacy do banco. Forms novos enviam snake_case.
const DRAWER_FIELD_LABELS = {
  mes:                 { label: "Mês" },
  objetivo:            { label: "Objetivo da sessão",          wide: true },
  qtdParticipantes:    { label: "Quantidade de participantes" },
  localSessao:         { label: "Local da sessão" },
  subTipo:             { label: "Subtipo" },
  nomeCartao:          { label: "Nome no cartão" },
  whatsapp:            { label: "WhatsApp" },
  emailCorporativo:    { label: "E-mail" },
  marca:               { label: "Marca" },
  nomeCliente:         { label: "Nome do cliente" },
  isPrivate:           { label: "Cliente Private?" },
  nomeAssinatura:      { label: "Nome para assinatura" },
  cargo:               { label: "Cargo" },
  agradecimento:       { label: "Agradecimento",              wide: true },
  modeloArte:          { label: "Modelo de arte" },
  idEvento:            { label: "ID do evento" },
  cargaHoraria:        { label: "Carga horária" },
  tituloPagina:        { label: "Título da página" },
  cfp:                 { label: "Possui CFP?" },
  nomeCompleto:        { label: "Nome completo" },
  telefone:            { label: "Telefone" },
  setor:               { label: "Setor",                      skip: true },
  codigoAssessor:      { label: "Código do assessor" },
  contratoSocial:      { label: "Contrato social" },
  unidade:             { label: "Unidade" },
  nomeAniversariante:  { label: "Nome do aniversariante" },
  modeloCartao:        { label: "Modelo do cartão" },
  mensagem:            { label: "Mensagem",                   wide: true },
  assinatura:          { label: "Assinatura",                 wide: true },
  dataEntrega:         { label: "Data de entrega" },
  prazoEntrega:        { label: "Prazo desejado" },
  itens:               { label: "Itens solicitados",          wide: true },
  centroCusto:         { label: "Centro de custo" },
  valorCota:           { label: "Valor da cota" },
  orcamentoTotal:      { label: "Orçamento total" },
  expectativaRetorno:  { label: "Expectativa de retorno",     wide: true },
  assunto:             { label: "Assunto do e-mail" },
  tema:                { label: "Tema e resumo",              wide: true },
  dataDisparo:         { label: "Data de disparo" },
  assinaturaEmail:     { label: "Assinatura do e-mail" },
  ideia:               { label: "Ideia / Descrição",          wide: true },
  formato:             { label: "Formato" },
  tipoMaterial:        { label: "Tipo de material" },
  orientacao:          { label: "Orientação" },
  formatoPapel:        { label: "Formato do papel" },
  conteudoMaterial:    { label: "Conteúdo do material",       wide: true },
  finalidade:          { label: "Finalidade",                 wide: true },
  descricao:           { label: "Descrição",                  wide: true },
  tituloEvento:        { label: "Título do evento" },
  dataEvento:          { label: "Data do evento" },
  horario:             { label: "Horário" },
  local:               { label: "Local" },
  tipoEvento:          { label: "Tipo de evento" },
  publico:             { label: "Público",                    wide: true },
  explicacao:          { label: "Explicação / justificativa", wide: true },
  conteudo:            { label: "Conteúdo",                   wide: true },
  observacoes:         { label: "Observações",                wide: true },
  observacoesFinais:   { label: "Observações finais",         wide: true },
  briefing:            { label: "Briefing",                   wide: true },
  descricaoEvento:     { label: "Descrição do evento",        wide: true },
  texto:               { label: "Texto",                      wide: true },
  detalhes:            { label: "Detalhes",                   wide: true },
  contexto:            { label: "Contexto",                   wide: true },
  informacaoAdicional: { label: "Informação adicional",       wide: true },
  resumo:              { label: "Resumo",                     wide: true },
  expectativas:        { label: "Expectativas",               wide: true },
  objetivos:           { label: "Objetivos",                  wide: true },
  estrategia:          { label: "Estratégia",                 wide: true },
  canais:              { label: "Canais",                     wide: true },
  materiais:           { label: "Materiais",                  wide: true },
  selos:               { label: "Selos",                      wide: true },
  ideaQuando:          { label: "Ideia / Quando",             wide: true },
  localSugestoes:      { label: "Local (sugestões)",          wide: true },
  linkTransmissao:     { label: "Link da transmissão",        wide: true },
  personalizacao:      { label: "Personalização",             wide: true },
  textoCartaoPresente: { label: "Texto do cartão presente",   wide: true },
  idSolicitacao:       { label: "ID",                         skip: true },
  natureza:            { label: "Natureza",                   skip: true },
  nome:                { label: "Nome",                       skip: true },
  materiaisDetalhes:   { label: "Detalhes dos materiais",     skip: true },
  contrato_label:      { label: "Contrato (label)",           skip: true },
  contratoLabel:       { label: "Contrato (label)",           skip: true },
  // Versões snake_case canônicas (criadas pelo backend normalizeFormDados)
  contrato_social:     { label: "Contrato social" },
  is_private_key:      { label: "Cliente Private?" },
  modelo_cartao:       { label: "Modelo do cartão" },
  modelo_arte:         { label: "Modelo de arte" },
  nome_cliente:        { label: "Nome do cliente" },
  nome_assinatura:     { label: "Nome para assinatura" },
  nome_completo:       { label: "Nome completo" },
  codigo_assessor:     { label: "Código do assessor" },
  foto_perfil:         { label: "Foto de perfil" },
};

const DRAWER_FIELD_LABELS_FLAT = Object.fromEntries(
  Object.entries(DRAWER_FIELD_LABELS).map(([k, v]) => [k, v.label])
);

const SELOS_ASSESSOR = [
  { id: "ancord",          label: "Ancord",         icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/ancord.webp" },
  { id: "cea",             label: "CEA",            icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cea.webp" },
  { id: "cfp",             label: "CFP",            icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/CFP-Logo.webp" },
  { id: "cga",             label: "CGA",            icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cga.webp" },
  { id: "cnpi",            label: "CNPI",           icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cnpj.webp" },
  { id: "cpa10",           label: "CPA-10",         icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cpa10.avif" },
  { id: "cpa20",           label: "CPA-20",         icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cpa20.webp" },
  { id: "xp-private",      label: "XP Private",     icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/xp-private-24.webp" },
  { id: "palestrante-svn", label: "Palestrante SVN", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/palestrante_certificado.webp" },
];

const STATUS_SOLICITACAO = [
  { id: "recebido",               label: "Recebido",                   bg: "#4D545F", text: "#FFFFFF",  cor: "--carbon-black"  },
  { id: "alinhamentos",           label: "Alinhamentos",               bg: "#2563C0", text: "#FFFFFF",  cor: "--sage-green"    },
  { id: "em-analise",             label: "Em análise",                 bg: "#C98A00", text: "#FFFFFF",  cor: "--ruby-red"      },
  { id: "em-andamento",           label: "Em andamento",               bg: "#C98A00", text: "#FFFFFF",  cor: "--leather-brown" },
  { id: "em-producao",            label: "Em produção",                bg: "#C85C00", text: "#FFFFFF",  cor: "--ruby-red"      },
  { id: "em-revisao",             label: "Em revisão",                 bg: "#7438B0", text: "#FFFFFF",  cor: "--leather-brown" },
  { id: "em-aprovacao",           label: "Em aprovação",               bg: "#2563C0", text: "#FFFFFF",  cor: "--sage-green"    },
  { id: "cotacao-aprovacao",      label: "Em cotação / aprovação",     bg: "#2563C0", text: "#FFFFFF",  cor: "--leather-brown" },
  { id: "aguardando",             label: "Aguardando informação",      bg: "#8A6040", text: "#FFFFFF",  cor: "--leather-brown" },
  { id: "aguardando-rh",          label: "Aguardando aprovação do RH", bg: "#8A6040", text: "#FFFFFF",  cor: "--leather-brown" },
  { id: "aguardando-pagamento",   label: "Aguardando pagamento",       bg: "#8A6040", text: "#FFFFFF",  cor: "--leather-brown" },
  { id: "aguardando-finalizacao", label: "Aguardando finalização",     bg: "#7438B0", text: "#FFFFFF",  cor: "--leather-brown" },
  { id: "concluido",              label: "Concluído",                  bg: "#0A9060", text: "#FFFFFF",  cor: "--sage-green"    },
  { id: "cancelado",              label: "Cancelado",                  bg: "#C82828", text: "#FFFFFF",  cor: "--carbon-black"  },
  { id: "em-espera",              label: "Em espera",                  bg: "#4D545F", text: "#FFFFFF",  cor: "--carbon-black"  },
  { id: "gerando",                label: "Gerando arte",               bg: "#dbeafe", text: "#1e40af" },
  { id: "erro",                   label: "Erro",                       bg: "#fee2e2", text: "#991b1b" },
  { id: "aguardando-validacao",   label: "Aguardando validação",       bg: "#fee2e2", text: "#b91c1c" },
  { id: "aguardando-contrato",    label: "Aguardando contrato",        bg: "#f1f5f9", text: "#475569" },
  { id: "validado",               label: "Validado",                   bg: "#d1fae5", text: "#047857" },
  { id: "liberado-design",        label: "Em design",                  bg: "#ede9fe", text: "#6d28d9" },
  { id: "arte-finalizada",        label: "Arte finalizada",            bg: "#fef9c3", text: "#a16207" },
  { id: "envio-grafica",          label: "Envio gráfica",              bg: "#dbeafe", text: "#1d4ed8" },
  { id: "envio-assessor",         label: "Envio assessor",             bg: "#dcfce7", text: "#15803d" },
  { id: "reprovado",              label: "Reprovado",                  bg: "#fecaca", text: "#dc2626", cor: "--ruby-red" },
];

const STATUS_MAP = Object.fromEntries(STATUS_SOLICITACAO.map(s => [s.id, s]));
function getStatus(id) {
  return STATUS_MAP[id] || { label: id, bg: '#f1f5f9', text: '#475569', cor: '--carbon-black' };
}

let SETORES = [
  "Selecione seu setor",
  "Administração",
  "Alocação",
  "Aracaju",
  "Câmbio",
  "Campo Grande",
  "Capital Humano",
  "Cascavel",
  "Commodities",
  "Connect",
  "Corporate",
  "Cuiabá",
  "Curitiba",
  "Curitiba Digital",
  "Digital",
  "Financeiro",
  "Foz do Iguaçu",
  "Institucional",
  "Jurídico",
  "Londrina",
  "Marketing",
  "Marketing Digital",
  "Maringá",
  "Maringá Digital",
  "Middle",
  "Performance",
  "Produto",
  "Proteção Patrimonial",
  "Renda Fixa",
  "Renda Variável",
  "Salvador",
  "São Paulo",
  "São Paulo Digital",
  "SVN Gestão",
  "SVN Global",
  "SVN Investment & Merchant Banking (M&A)",
  "Toledo",
  "Universidade SVN",
  "Vitória da Conquista",
  "Wealth Planning",
];

const IBGE_ESTADOS = {
  "12":"Acre","27":"Alagoas","16":"Amapá","13":"Amazonas",
  "29":"Bahia","23":"Ceará","53":"Distrito Federal","32":"Espírito Santo",
  "52":"Goiás","21":"Maranhão","51":"Mato Grosso","50":"Mato Grosso do Sul",
  "31":"Minas Gerais","15":"Pará","25":"Paraíba","41":"Paraná",
  "26":"Pernambuco","22":"Piauí","33":"Rio de Janeiro","24":"Rio Grande do Norte",
  "43":"Rio Grande do Sul","11":"Rondônia","14":"Roraima","42":"Santa Catarina",
  "35":"São Paulo","28":"Sergipe","17":"Tocantins",
};


const ORIGENS_EVENTO = [
  "Selecione a origem",
  "Iniciativa interna", "Demanda de cliente",
  "Parceria externa", "Calendário corporativo",
];

const ORIGENS_EVENTO_ONLINE = [
  "Selecione a origem",
  "Parceria", "Independente", "Universidade SVN",
];

const CANAIS_TRANSMISSAO = ["Selecione o canal", "Meet", "YouTube", "Zoom"];
const CANAIS_SEM_LINK_OBRIGATORIO = ["Meet", "Zoom"];

const TIPOS_EVENTO = [
  "Selecione o tipo", "Palestra", "Workshop",
  "Confraternização", "Reunião", "Experiência com clientes",
  "Treinamento",
];

const TIPOS_EVENTO_FORM3 = [
  "Palestra", "Café da Manhã", "Almoço", "Jantar",
  "Palestra com coffee break", "Palestra com coquetel",
  "Evento esportivo", "Evento beneficente", "Feira de Exposição",
];

const OPCOES_RATEIO = [
  "Selecione o rateio",
  "100% Unidade", "100% Assessor",
  "50% Unidade - 50% Assessores",
  "Área", "Outros",
];

const UNIDADES_SVN = [
  { nome: "SVN Aracaju", endereco: "R. Francisco Duarte Ramos, 34 - Jardins, Aracaju - SE" },
  { nome: "SVN Campo Grande", endereco: "Edifício Atrium - R. Euclides da Cunha, 1039 - Loja 3 - Jardim dos Estados" },
  { nome: "SVN Cascavel", endereco: "Av. Piquiri, 17 - Salas 01 e 02 - Centro" },
  { nome: "SVN Cuiabá", endereco: "R. Pres. Castelo Branco, 277 - Quilombo" },
  { nome: "SVN Curitiba", endereco: "Praça São Paulo da Cruz, 50 - Sala 1605 - Juveve, Curitiba - PR" },
  { nome: "SVN Foz do Iguaçu", endereco: "R. Alm. Barroso, 1139 - Centro" },
  { nome: "SVN Londrina", endereco: "Av. Higienópolis, 602 - Sala 2 - Centro, Londrina - PR" },
  { nome: "SVN Maringá", endereco: "Av. Cerro Azul, 123 - Zona 2, Maringá - PR" },
  { nome: "SVN Salvador", endereco: "Torre Nova York, Av. Tancredo Neves, 2539 - Sala 2104, Salvador - BA" },
  { nome: "SVN São Paulo", endereco: "Av. Dr. Cardoso de Melo, 1855 - Conjunto 51 - Vila Olímpia, São Paulo - SP" },
  { nome: "SVN Toledo", endereco: "Rua Nossa Senhora do Rocio, 2279 - Sala 02 - Jardim La Salle, Toledo - PR" },
  { nome: "SVN Vitória da Conquista", endereco: "Av. Jorge Teixeira, 29 - Salas 16 e 17" },
];

const ITENS_MATERIAIS = [
  { id: "pacote-padrao", label: "Pacote de Divulgação Padrão (convite + página de inscrição)", icon: "icon-envelope-star" },
  { id: "pacote-personalizado", label: "Pacote de Divulgação Personalizado", icon: "icon-palette" },
  { id: "banner-impresso", label: "Banner Impresso", icon: "icon-image" },
  { id: "flyer", label: "Flyer", icon: "icon-file-text" },
  { id: "brindes-store", label: "Brindes (solicitar na Store)", icon: "icon-gift" },
  { id: "brindes-personalizados", label: "Brindes Personalizados", icon: "icon-gift" },
  { id: "captacao-audiovisual", label: "Captação Audiovisual", icon: "icon-video" },
  { id: "coffee-break", label: "Coffee Break ou Coquetel", icon: "icon-coffee" },
  { id: "instagram", label: "Divulgação no Instagram da SVN", icon: "icon-instagram" },
  { id: "email-marketing", label: "E-mail Marketing", icon: "icon-mail" },
  { id: "equipe-staff", label: "Equipe Staff (Marketing)", icon: "icon-users" },
  { id: "jantar-almoco", label: "Jantar / Almoço (Restaurante)", icon: "icon-utensils" },
  { id: "pagina-sorteio", label: "Página para Sorteio", icon: "icon-star" },
  { id: "projeto-stand", label: "Projeto de Stand", icon: "icon-layout" },
];

const ITENS_MATERIAIS_ONLINE = [
  { id: "pacote-padrao-online", label: "Pacote de Divulgação Padrão - 2 dias úteis", icon: "icon-envelope-star" },
  { id: "pacote-personalizado-online", label: "Pacote de Divulgação Personalizado - 7 dias", icon: "icon-palette" },
  { id: "instagram-online", label: "Divulgação no Instagram da SVN - 1 dia útil", icon: "icon-instagram" },
  { id: "link-youtube-online", label: "Link da live no Youtube - 2 dias úteis", icon: "icon-youtube" },
  { id: "apoio-live-online", label: "Apoio em live - 5 dias úteis", icon: "icon-video" },
  { id: "email-marketing-online", label: "E-mail Marketing - 3-5 dias úteis", icon: "icon-mail" },
];

const PRAZOS_MATERIAIS = {
  "pacote-padrao": { label: "15 dias de antecedência" },
  "pacote-personalizado": { label: "20 dias de antecedência" },
  "banner-impresso": { label: "30 dias de antecedência" },
  "flyer": { label: "30 dias de antecedência" },
  "brindes-store": { label: "30 dias de antecedência" },
  "brindes-personalizados": { label: "45 dias de antecedência" },
  "captacao-audiovisual": { label: "15 dias de antecedência" },
  "coffee-break": { label: "15 dias de antecedência" },
  "instagram": { label: "15 dias de antecedência" },
  "email-marketing": { label: "15 dias de antecedência" },
  "equipe-staff": { label: "15 dias de antecedência" },
  "jantar-almoco": { label: "30 dias de antecedência" },
  "pagina-sorteio": { label: "15 dias de antecedência" },
  "projeto-stand": { label: "45 dias de antecedência" },
  "pacote-padrao-online": { label: "2 dias úteis" },
  "pacote-personalizado-online": { label: "7 dias" },
  "instagram-online": { label: "1 dia útil" },
  "link-youtube-online": { label: "2 dias úteis" },
  "apoio-live-online": { label: "5 dias úteis" },
  "email-marketing-online": { label: "3-5 dias úteis" },
};

const FORM_ROUTES = {
  "eventos":               "form-eventos.html",
  "pagina-assessores":     "form-pagina-assessores.html",
  "artes-divulgacao":      "form-artes-divulgacao.html",
  "apresentacao":          "form-apresentacoes.html",
  "conteudo-pdf":          "form-criacao-pdf.html",
  "atualizacao-material":  "form-atualizacao-material.html",
  "assinatura-email":      "form-assinatura-email.html",
  "cartao-visita":         "form-cartao-visita.html",
  "cartao-boas-vindas":    "form-cartao-boas-vindas.html",
  "cartao-comemorativo":   "form-cartao-comemorativo.html",
  "divulgacao-nps":        "form-divulgacao-nps.html",
  "convite-fp":            "form-convite-fp.html",
  "pagina-online":         "form-pagina-online.html",
  "outro":                 "form-outro.html",
  "brindes":               "form-brindes.html",
  "patrocinio":            "form-patrocinio.html",
  "email-marketing":       "form-email-marketing.html",
  "producao-audiovisual":  "form-producao-audiovisual.html",
  "materiais-impressos":   "form-materiais-impressos.html",
};

const FLUXOS_ETAPAS = {
  "eventos": [
    { id: "recebido",               label: "Recebido",                  visivel: true  },
    { id: "alinhamentos",           label: "Alinhamentos",              visivel: true  },
    { id: "em-andamento",           label: "Em andamento",              visivel: true  },
    { id: "cotacao-aprovacao",      label: "Em cotação / aprovação",    visivel: true  },
    { id: "aguardando-pagamento",   label: "Aguardando pagamento",      visivel: true  },
    { id: "aguardando-finalizacao", label: "Aguardando finalização",    visivel: true  },
    { id: "concluido",              label: "Concluído",                 visivel: true  },
    { id: "em-espera",              label: "Em espera",                 visivel: false },
    { id: "cancelado",              label: "Cancelado",                 visivel: false },
  ],
  "cartao-visita-fisico": [
    { id: "aguardando-validacao", label: "Aguardando validação", visivel: true  },
    { id: "aguardando-contrato",  label: "Aguardando contrato",  visivel: true  },
    { id: "validado",             label: "Validado",             visivel: true  },
    { id: "envio-grafica",        label: "Envio gráfica",        visivel: true  },
    { id: "envio-assessor",       label: "Envio assessor",       visivel: true  },
    { id: "reprovado",            label: "Reprovado",            visivel: false },
    { id: "liberado-design",      label: "Em design",            visivel: false },
    { id: "arte-finalizada",      label: "Arte finalizada",      visivel: false },
  ],
  "_default": [
    { id: "recebido",     label: "Recebido",              visivel: true  },
    { id: "em-analise",   label: "Em análise",            visivel: true  },
    { id: "aguardando",   label: "Aguardando informação", visivel: true  },
    { id: "em-producao",  label: "Em produção",           visivel: true  },
    { id: "em-revisao",   label: "Em revisão",            visivel: true  },
    { id: "em-aprovacao", label: "Em aprovação",          visivel: true  },
    { id: "concluido",    label: "Concluído",             visivel: true  },
    { id: "cancelado",    label: "Cancelado",             visivel: false },
    { id: "em-espera",    label: "Em espera",             visivel: false },
  ],
};
