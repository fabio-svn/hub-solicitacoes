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
let URL_APRESENTACAO = "#";
let URL_STORE = "#";
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

const MSG_THANKYOU_TITULO = "Solicitacao enviada com sucesso!";
const MSG_THANKYOU_SUBTITULO = "Sua solicitacao foi recebida! Nossa equipe de Marketing analisara em breve e entrara em contato.";
const MSG_THANKYOU_BOTAO = "Ver minha solicitacao";

const CATEGORIAS_SOLICITACAO = [
  {
    categoria: "Identidade e materiais pessoais",
    itens: [
      { id: "pagina-assessores", label: "Pagina de Assessores", icon: "icon-user", ativo: true,
        subOpcoes: [
          { id: "pagina-assessores-dados", label: "Dados para pagina de assessores" },
          { id: "pagina-assessores-atualizacao", label: "Atualizacao de dados para pagina de assessores" },
        ]
      },
      { id: "assinatura-email", label: "Assinatura de E-mail", icon: "icon-mail", ativo: false },
      { id: "cartao-visita", label: "Cartao de Visita", icon: "icon-credit-card", ativo: false,
        subOpcoes: [
          { id: "cartao-visita-fisico", label: "Fisico" },
          { id: "cartao-visita-digital", label: "Digital" },
        ]
      },
      { id: "cartao-boas-vindas", label: "Cartao de Boas-vindas", icon: "icon-handshake", ativo: false },
      { id: "cartao-comemorativo", label: "Cartao Comemorativo", icon: "icon-heart", ativo: false },
      { id: "divulgacao-nps", label: "Divulgacao NPS", icon: "icon-star", ativo: false },
      { id: "convite-fp", label: "Convite Financial Planning", icon: "icon-envelope", ativo: false },
    ]
  },
  {
    categoria: "Marketing e conteudo",
    itens: [
      { id: "artes-divulgacao", label: "Artes de Divulgacao", icon: "icon-image", ativo: true },
      { id: "apresentacao", label: "Apresentacao", icon: "icon-monitor", ativo: true,
        subOpcoes: [
          { id: "apresentacao-nova", label: "Nova apresentacao" },
          { id: "apresentacao-atualizar", label: "Atualizar apresentacao" },
        ]
      },
      { id: "conteudo-pdf", label: "Conteudo em PDF", icon: "icon-file-pdf", ativo: true,
        subOpcoes: [
          { id: "conteudo-pdf-informativo", label: "Informativo" },
          { id: "conteudo-pdf-ebook", label: "Ebook" },
        ]
      },
      { id: "email-marketing", label: "E-mail Marketing", icon: "icon-send", ativo: false },
      { id: "materia-blog", label: "Materia para blog, jornal ou revista", icon: "icon-newspaper", ativo: false },
      { id: "conteudos-central", label: "Conteudos Central SVN", icon: "icon-layout", ativo: false },
      { id: "atualizacao-material", label: "Atualizacao de material", icon: "icon-refresh", ativo: true },
    ]
  },
  {
    categoria: "Eventos e relacionamento",
    itens: [
      { id: "eventos", label: "Eventos", icon: "icon-calendar", ativo: true },
      { id: "certificado-eventos", label: "Certificado para Eventos", icon: "icon-award", ativo: false },
      { id: "patrocinio", label: "Patrocinio", icon: "icon-flag", ativo: false },
      { id: "brindes", label: "Brindes", icon: "icon-gift", ativo: false },
      { id: "correios", label: "Envio de itens pelos Correios", icon: "icon-package", ativo: false },
      { id: "pagina-online", label: "Pagina Online", icon: "icon-globe", ativo: false },
    ]
  },
  {
    categoria: "Audiovisual",
    itens: [
      { id: "producao-video", label: "Producao de Video", icon: "icon-video", ativo: false },
      { id: "analise-gravacoes", label: "Analise de Elegibilidade para Gravacoes", icon: "icon-film", ativo: false },
    ]
  },
  {
    categoria: "Impressos",
    layout: "single",
    itens: [
      { id: "materiais-impressos", label: "Materiais Impressos", icon: "icon-printer", ativo: false },
    ]
  },
  {
    categoria: "Obras e manutencoes",
    layout: "single",
    itens: [
      { id: "obras-manutencao", label: "Obras, mudancas, manutencao e demandas estruturais", icon: "icon-tool", ativo: false },
    ]
  },
  {
    categoria: "Outros",
    layout: "single",
    itens: [
      { id: "outro", label: "Outro", icon: "icon-edit", ativo: false },
    ]
  },
];

const TIPO_SOLICITACAO_LABELS = {
  "eventos": "Evento",
  "pagina-assessores-dados": "Pagina de Assessores - Dados",
  "pagina-assessores-atualizacao": "Pagina de Assessores - Atualizacao",
  "apresentacao-nova": "Apresentacao - Nova",
  "apresentacao-atualizar": "Apresentacao - Atualizacao",
  "artes-divulgacao": "Arte de Divulgacao",
  "conteudo-pdf-informativo": "PDF - Informativo",
  "conteudo-pdf-ebook": "PDF - Ebook",
  "atualizacao-material": "Atualizacao de Material",
};

const CONTRATOS_SOCIAIS = ["SVN Capital", "SVN Connect", "SVN Investimentos"];

const SELOS_ASSESSOR = [
  { id: "ancord", label: "Ancord", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/ancord.webp" },
  { id: "cea", label: "CEA", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cea.webp" },
  { id: "cfa", label: "CFA", icon_url: "" },
  { id: "cfp", label: "CFP", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/CFP-Logo.webp" },
  { id: "cga", label: "CGA", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cga.webp" },
  { id: "cnpi", label: "CNPI", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cnpj.webp" },
  { id: "cpa10", label: "CPA-10", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cpa10.avif" },
  { id: "cpa20", label: "CPA-20", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cpa20.webp" },
  { id: "xp-private", label: "XP Private", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/xp-private-24.webp" },
  { id: "palestrante-svn", label: "Palestrante SVN", icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/palestrante_certificado.webp" },
];

const STATUS_SOLICITACAO = [
  { id: "recebido", label: "Recebido", cor: "--sage-green" },
  { id: "em-analise", label: "Em analise", cor: "--ruby-red" },
  { id: "em-producao", label: "Em producao", cor: "--ruby-red" },
  { id: "aguardando", label: "Aguardando informacao", cor: "--leather-brown" },
  { id: "concluido", label: "Concluido", cor: "--sage-green" },
  { id: "cancelado", label: "Cancelado", cor: "--carbon-black" },
];

const SETORES = [
  "Selecione seu setor",
  "Marketing", "Comercial", "Operacoes",
  "Tecnologia", "RH", "Financeiro", "Diretoria",
];

const ORIGENS_EVENTO = [
  "Selecione a origem",
  "Iniciativa interna", "Demanda de cliente",
  "Parceria externa", "Calendario corporativo",
];

const ORIGENS_EVENTO_ONLINE = [
  "Selecione a origem",
  "Parceria", "Independente", "Universidade SVN",
];

const CANAIS_TRANSMISSAO = ["Selecione o canal", "Meet", "YouTube", "Zoom"];
const CANAIS_SEM_LINK_OBRIGATORIO = ["Meet", "Zoom"];

const TIPOS_EVENTO = [
  "Selecione o tipo", "Palestra", "Workshop",
  "Confraternizacao", "Reuniao", "Experiencia com clientes",
  "Treinamento",
];

const TIPOS_EVENTO_FORM3 = [
  "Palestra", "Cafe da Manha", "Almoco", "Jantar",
  "Palestra com coffee break", "Palestra com coquetel",
  "Evento esportivo", "Evento beneficente", "Feira de Exposicao",
];

const OPCOES_RATEIO = [
  "Selecione o rateio",
  "100% Unidade", "100% Assessor",
  "50% Unidade - 50% Assessores",
  "Area", "Outros",
];

const UNIDADES_SVN = [
  { nome: "SVN Aracaju", endereco: "R. Francisco Duarte Ramos, 34 - Jardins, Aracaju - SE" },
  { nome: "SVN Campo Grande", endereco: "Edificio Atrium - R. Euclides da Cunha, 1039 - Loja 3 - Jardim dos Estados" },
  { nome: "SVN Cascavel", endereco: "Av. Piquiri, 17 - Salas 01 e 02 - Centro" },
  { nome: "SVN Cuiaba", endereco: "R. Pres. Castelo Branco, 277 - Quilombo" },
  { nome: "SVN Curitiba", endereco: "Praca Sao Paulo da Cruz, 50 - Sala 1605 - Juveve, Curitiba - PR" },
  { nome: "SVN Foz do Iguacu", endereco: "R. Alm. Barroso, 1139 - Centro" },
  { nome: "SVN Londrina", endereco: "Av. Higienopolis, 602 - Sala 2 - Centro, Londrina - PR" },
  { nome: "SVN Maringa", endereco: "Av. Cerro Azul, 123 - Zona 2, Maringa - PR" },
  { nome: "SVN Salvador", endereco: "Torre Nova York, Av. Tancredo Neves, 2539 - Sala 2104, Salvador - BA" },
  { nome: "SVN Sao Paulo", endereco: "Av. Dr. Cardoso de Melo, 1855 - Conjunto 51 - Vila Olimpia, Sao Paulo - SP" },
  { nome: "SVN Toledo", endereco: "Rua Nossa Senhora do Rocio, 2279 - Sala 02 - Jardim La Salle, Toledo - PR" },
  { nome: "SVN Vitoria da Conquista", endereco: "Av. Jorge Teixeira, 29 - Salas 16 e 17" },
];

const ITENS_MATERIAIS = [
  { id: "pacote-padrao", label: "Pacote de Divulgacao Padrao (convite + pagina de inscricao)", icon: "icon-envelope-star" },
  { id: "pacote-personalizado", label: "Pacote de Divulgacao Personalizado", icon: "icon-palette" },
  { id: "banner-impresso", label: "Banner Impresso", icon: "icon-image" },
  { id: "flyer", label: "Flyer", icon: "icon-file-text" },
  { id: "brindes-store", label: "Brindes (solicitar na Store)", icon: "icon-gift" },
  { id: "brindes-personalizados", label: "Brindes Personalizados", icon: "icon-gift" },
  { id: "captacao-audiovisual", label: "Captacao Audiovisual", icon: "icon-video" },
  { id: "coffee-break", label: "Coffee Break ou Coquetel", icon: "icon-coffee" },
  { id: "instagram", label: "Divulgacao no Instagram da SVN", icon: "icon-instagram" },
  { id: "email-marketing", label: "E-mail Marketing", icon: "icon-mail" },
  { id: "equipe-staff", label: "Equipe Staff (Marketing)", icon: "icon-users" },
  { id: "jantar-almoco", label: "Jantar / Almoco (Restaurante)", icon: "icon-utensils" },
  { id: "pagina-sorteio", label: "Pagina para Sorteio", icon: "icon-star" },
  { id: "projeto-stand", label: "Projeto de Stand", icon: "icon-layout" },
];

const ITENS_MATERIAIS_ONLINE = [
  { id: "pacote-padrao-online", label: "Pacote de Divulgacao Padrao - 2 dias uteis", icon: "icon-envelope-star" },
  { id: "pacote-personalizado-online", label: "Pacote de Divulgacao Personalizado - 7 dias", icon: "icon-palette" },
  { id: "instagram-online", label: "Divulgacao no Instagram da SVN - 1 dia util", icon: "icon-instagram" },
  { id: "link-youtube-online", label: "Link da live no Youtube - 2 dias uteis", icon: "icon-youtube" },
  { id: "apoio-live-online", label: "Apoio em live - 5 dias uteis", icon: "icon-video" },
  { id: "email-marketing-online", label: "E-mail Marketing - 3-5 dias uteis", icon: "icon-mail" },
];

const PRAZOS_MATERIAIS = {
  "pacote-padrao": { label: "15 dias de antecedencia" },
  "pacote-personalizado": { label: "20 dias de antecedencia" },
  "banner-impresso": { label: "30 dias de antecedencia" },
  "flyer": { label: "30 dias de antecedencia" },
  "brindes-store": { label: "30 dias de antecedencia" },
  "brindes-personalizados": { label: "45 dias de antecedencia" },
  "captacao-audiovisual": { label: "15 dias de antecedencia" },
  "coffee-break": { label: "15 dias de antecedencia" },
  "instagram": { label: "15 dias de antecedencia" },
  "email-marketing": { label: "15 dias de antecedencia" },
  "equipe-staff": { label: "15 dias de antecedencia" },
  "jantar-almoco": { label: "30 dias de antecedencia" },
  "pagina-sorteio": { label: "15 dias de antecedencia" },
  "projeto-stand": { label: "45 dias de antecedencia" },
  "pacote-padrao-online": { label: "2 dias uteis" },
  "pacote-personalizado-online": { label: "7 dias" },
  "instagram-online": { label: "1 dia util" },
  "link-youtube-online": { label: "2 dias uteis" },
  "apoio-live-online": { label: "5 dias uteis" },
  "email-marketing-online": { label: "3-5 dias uteis" },
};

const CAMPOS_ETAPA2_FORM2 = [
  { id: "nome-evento", label: "Nome do evento" },
  { id: "data-evento", label: "Data do evento" },
  { id: "horario", label: "Horario do evento" },
  { id: "descricao", label: "Descricao do evento" },
  { id: "origem", label: "Origem do evento" },
  { id: "tipo-evento", label: "Tipo de evento" },
  { id: "publico", label: "Publico do evento" },
  { id: "estado-cidade", label: "Estado e Cidade" },
  { id: "local", label: "Local do evento" },
  { id: "convidados", label: "Numero de convidados" },
];

const CAMPOS_ETAPA2_FORM2_ONLINE = [
  { id: "titulo-evento", label: "Titulo do evento" },
  { id: "descricao", label: "Descricao do evento" },
  { id: "publico", label: "Publico do evento" },
  { id: "objetivos", label: "Objetivos de retorno" },
  { id: "canal", label: "Canal de transmissao" },
  { id: "link-transmissao", label: "Link da transmissao" },
  { id: "origem", label: "Origem do evento" },
  { id: "data-evento", label: "Data do evento" },
  { id: "horario", label: "Horario do evento" },
];

const FORM_ROUTES = {
  "eventos": "form-eventos.html",
  "pagina-assessores-dados": "form-pagina-assessores.html?subtipo=dados",
  "pagina-assessores-atualizacao": "form-pagina-assessores.html?subtipo=atualizacao",
  "artes-divulgacao": "form-artes-divulgacao.html",
  "apresentacao-nova": "form-apresentacoes.html?subtipo=nova",
  "apresentacao-atualizar": "form-apresentacoes.html?subtipo=atualizar",
  "conteudo-pdf-informativo": "form-criacao-pdf.html?subtipo=informativo",
  "conteudo-pdf-ebook": "form-criacao-pdf.html?subtipo=ebook",
  "atualizacao-material": "form-atualizacao-material.html",
};
