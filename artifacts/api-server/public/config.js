const URL_FORM_EVENTOS = "form-eventos.html";
const URL_FORM_PAGINA_ASSESSORES = "form-pagina-assessores.html";
const URL_FORM_APRESENTACOES = "form-apresentacoes.html";
const URL_FORM_ARTES_DIVULGACAO = "form-artes-divulgacao.html";
const URL_FORM_ATUALIZACAO_MATERIAL = "form-atualizacao-material.html";
const URL_FORM_CRIACAO_PDF = "form-criacao-pdf.html";
const URL_SOLICITACOES = "solicitacoes.html";
const URL_DASHBOARD = "dashboard.html";
const URL_ADMIN = "admin.html";

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

const _configReady = fetch('/api/config').then(r => r.json()).then(cfg => {
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
}).catch(() => {});

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
      { id: "cartao-boas-vindas", label: "Cartão de Boas-vindas", icon: "icon-handshake", ativo: true },
      { id: "cartao-comemorativo", label: "Cartão Comemorativo", icon: "icon-heart", ativo: false },
      { id: "divulgacao-nps", label: "Divulgação NPS", icon: "icon-star", ativo: true },
      { id: "convite-fp", label: "Convite Financial Planning", icon: "icon-envelope", ativo: true },
    ]
  },
  {
    categoria: "Eventos e relacionamento",
    itens: [
      { id: "eventos", label: "Eventos", icon: "icon-calendar", ativo: true },
      { id: "certificado-eventos", label: "Certificado para Eventos", icon: "icon-award", ativo: true },
      { id: "patrocinio", label: "Patrocínio", icon: "icon-flag", ativo: false },
      { id: "brindes", label: "Brindes", icon: "icon-gift", ativo: false },
      { id: "pagina-online", label: "Página Online", icon: "icon-globe", ativo: true },
    ]
  },
  {
    categoria: "Marketing e conteúdo",
    itens: [
      { id: "artes-divulgacao", label: "Artes de Divulgação", icon: "icon-image", ativo: true },
      { id: "apresentacao", label: "Apresentação", icon: "icon-monitor", ativo: true },
      { id: "conteudo-pdf", label: "Conteúdo em PDF", icon: "icon-file-pdf", ativo: true },
      { id: "email-marketing", label: "E-mail Marketing", icon: "icon-send", ativo: false },
      { id: "materia-blog", label: "Matéria para blog, jornal ou revista", icon: "icon-newspaper", ativo: false },
      { id: "conteudos-central", label: "Conteúdos Central SVN", icon: "icon-layout", ativo: false },
      { id: "atualizacao-material", label: "Atualização de material", icon: "icon-refresh", ativo: true },
    ]
  },
  {
    categoria: "Audiovisual",
    layout: "trio",
    itens: [
      { id: "producao-video", label: "Produção de Vídeo", icon: "icon-video", ativo: false },
    ]
  },
  {
    categoria: "Impressos",
    layout: "trio",
    itens: [
      { id: "materiais-impressos", label: "Materiais Impressos", icon: "icon-printer", ativo: false },
    ]
  },
  {
    categoria: "Obras e manutenções",
    layout: "trio",
    itens: [
      { id: "obras-manutencao", label: "Obras, mudanças, manutenção e demandas estruturais", icon: "icon-tool", ativo: false },
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
  "materia-blog":                   "Matéria para Blog/Jornal/Revista",
  "conteudos-central":              "Conteúdos Central SVN",
  "certificado-eventos":            "Certificado para Eventos",
  "patrocinio":                     "Patrocínio",
  "brindes":                        "Brindes",
  "pagina-online":                  "Página Online",
  "producao-video":                 "Produção de Vídeo",
  "analise-gravacoes":              "Análise de Elegibilidade para Gravações",
  "materiais-impressos":            "Materiais Impressos",
  "obras-manutencao":               "Obras e Manutenções",
  "outro":                          "Outro",
};

const CONTRATOS_SOCIAIS = ["SVN Capital", "SVN Connect", "SVN Investimentos"];

const MARCAS_SVN = [
  "SVN",
  "SVN Investimentos",
  "SVN Capital",
  "SVN Connect",
  "SVN Agro, Câmbio & Commodities",
  "SVN Gestão",
  "SVN Global",
  "SVN Proteção Patrimonial",
  "SVN Investment & Merchant Banking",
  "SVN Wealth Planning",
];

const CARGOS_ASSESSOR = [
  "Assessor de Investimentos",
  "Assessora de Investimentos",
  "Sócio e Assessor de Investimentos",
  "Sócia e Assessora de Investimentos",
];

const DRAWER_FIELD_LABELS = {
  nomeCartao:       "Nome no cartão",
  whatsapp:         "WhatsApp",
  emailCorporativo: "E-mail corporativo",
  marca:            "Marca",
  nomeCliente:      "Nome do cliente",
  isPrivate:        "Cliente Private?",
  nomeAssinatura:   "Nome para assinatura",
  cargo:            "Cargo",
  agradecimento:    "Agradecimento",
  modeloArte:       "Modelo de arte",
  idEvento:         "ID do evento",
  cargaHoraria:     "Carga horária",
  tituloPagina:     "Título da página",
};

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
  { id: "reprovado",              label: "Reprovado / Cancelado",      bg: "#C82828", text: "#FFFFFF",  cor: "--ruby-red"      },
  { id: "cancelado",              label: "Cancelado",                  bg: "#C82828", text: "#FFFFFF",  cor: "--carbon-black"  },
  { id: "em-espera",              label: "Em espera",                  bg: "#4D545F", text: "#FFFFFF",  cor: "--carbon-black"  },
];

const SETORES = [
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

// NOTA: Este mapa é intencionalmente duplicado de SETOR_CODIGO_MAP em clickup.ts.
// config.js roda no browser, clickup.ts no Node.js — não há como compartilhar.
// Ao adicionar ou alterar setores, atualizar AMBOS os arquivos.
const SETOR_CODIGOS = {
  "Administração":                           "ADM",
  "Alocação":                                "ALO",
  "Aracaju":                                 "AJU",
  "Câmbio":                                  "CAM",
  "Campo Grande":                            "CGR",
  "Capital Humano":                          "RH",
  "Cascavel":                                "CVV",
  "Commodities":                             "CMO",
  "Connect":                                 "CONN",
  "Corporate":                               "COR",
  "Cuiabá":                                  "CBA",
  "Curitiba":                                "CTB",
  "Curitiba Digital":                        "CTBDGT",
  "Digital":                                 "DIG",
  "Financeiro":                              "FIN",
  "Foz do Iguaçu":                           "FOZ",
  "Institucional":                           "INST",
  "Jurídico":                                "JUR",
  "Londrina":                                "LDN",
  "Marketing":                               "MKT",
  "Marketing Digital":                       "MKTDGT",
  "Maringá":                                 "MGF",
  "Maringá Digital":                         "MGFDGT",
  "Middle":                                  "MID",
  "Performance":                             "PER",
  "Produto":                                 "PRO",
  "Proteção Patrimonial":                    "PPA",
  "Renda Fixa":                              "RF",
  "Renda Variável":                          "RV",
  "Salvador":                                "SSA",
  "São Paulo":                               "SAO",
  "São Paulo Digital":                       "SAODGT",
  "SVN Gestão":                              "GEST",
  "SVN Global":                              "GLO",
  "SVN Investment & Merchant Banking (M&A)": "IMB",
  "Toledo":                                  "TLD",
  "Universidade SVN":                        "USVN",
  "Vitória da Conquista":                    "VDC",
  "Wealth Planning":                         "WEAL",
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

// Usados em form-eventos.html para o modo de maturidade 2 (informação parcial)
const CAMPOS_ETAPA2_FORM2 = [
  { id: "nome-evento", label: "Nome do evento" },
  { id: "data-evento", label: "Data do evento" },
  { id: "horario", label: "Horário do evento" },
  { id: "descricao", label: "Descrição do evento" },
  { id: "origem", label: "Origem do evento" },
  { id: "tipo-evento", label: "Tipo de evento" },
  { id: "publico", label: "Público do evento" },
  { id: "estado-cidade", label: "Estado e Cidade" },
  { id: "local", label: "Local do evento" },
  { id: "convidados", label: "Número de convidados" },
];

const CAMPOS_ETAPA2_FORM2_ONLINE = [
  { id: "titulo-evento", label: "Título do evento" },
  { id: "descricao", label: "Descrição do evento" },
  { id: "publico", label: "Público do evento" },
  { id: "objetivos", label: "Objetivos de retorno" },
  { id: "canal", label: "Canal de transmissão" },
  { id: "link-transmissao", label: "Link da transmissão" },
  { id: "origem", label: "Origem do evento" },
  { id: "data-evento", label: "Data do evento" },
  { id: "horario", label: "Horário do evento" },
];

const FORM_ROUTES = {
  "eventos":              "form-eventos.html",
  "pagina-assessores":    "form-pagina-assessores.html",
  "artes-divulgacao":     "form-artes-divulgacao.html",
  "apresentacao":         "form-apresentacoes.html",
  "conteudo-pdf":         "form-criacao-pdf.html",
  "atualizacao-material": "form-atualizacao-material.html",
  "assinatura-email":     "form-assinatura-email.html",
  "cartao-visita":        "form-cartao-visita.html",
  "cartao-boas-vindas":   "form-cartao-boas-vindas.html",
  "divulgacao-nps":       "form-divulgacao-nps.html",
  "convite-fp":           "form-convite-fp.html",
  "certificado-eventos":  "form-certificado-eventos.html",
  "pagina-online":        "form-pagina-online.html",
  "outro":                "form-outro.html",
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
    { id: "reprovado",              label: "Reprovado / Cancelado",     visivel: false },
    { id: "em-espera",              label: "Em espera",                 visivel: false },
    { id: "cancelado",              label: "Cancelado",                 visivel: false },
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
