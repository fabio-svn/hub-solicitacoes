export type FormFieldSchema = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'radio' | 'textarea' | 'file';
  options?: { value: string; label: string }[];
  required?: boolean;
};

export type ComputedField = {
  name: string;
  label: string;
  derived_from?: string;
  transform?: 'digits_only' | 'website_by_value' | 'label_by_value';
  lookup?: Record<string, string>;
};

export type FormSchema = {
  tipo: string;
  label: string;
  description?: string;
  fields: FormFieldSchema[];
  computed?: ComputedField[];
  template_variant_field?: string;
  is_automation: boolean;
  has_clickup: boolean;
  has_approval_flow: boolean;
  has_downloadable_artifact: boolean;
};

export const CONTRATOS_OPTS = [
  { value: 'svn-investimentos', label: 'SVN Investimentos' },
  { value: 'svn-capital',       label: 'SVN Capital' },
  { value: 'svn-connect',       label: 'SVN Connect' },
];

export const MARCAS_OPTS = [
  { value: 'svn', label: 'SVN' },
  { value: 'svn-investimentos',           label: 'SVN Investimentos' },
  { value: 'svn-capital',                 label: 'SVN Capital' },
  { value: 'svn-connect',                 label: 'SVN Connect' },
  { value: 'svn-gestao',                  label: 'SVN Gestão' },
  { value: 'svn-global',                  label: 'SVN Global' },
  { value: 'svn-imb',                     label: 'SVN Investment & Merchant Banking' },
  { value: 'svn-agro-cambio-commodities', label: 'SVN Agro, Câmbio & Commodities' },
  { value: 'svn-protecao-patrimonial',    label: 'SVN Proteção Patrimonial' },
  { value: 'svn-wealth-planning',         label: 'SVN Wealth Planning' },
];

export const CARGOS_OPTS = [
  { value: 'assessor',        label: 'Assessor de Investimentos' },
  { value: 'assessora',       label: 'Assessora de Investimentos' },
  { value: 'socio-assessor',  label: 'Sócio e Assessor de Investimentos' },
  { value: 'socia-assessora', label: 'Sócia e Assessora de Investimentos' },
];

// Fonte única de setores: nome (exibição/dropdown) + code (geração de ID no ClickUp).
// Adicione um setor novo APENAS aqui — a lista de nomes e o mapa de códigos
// são derivados automaticamente, então não há mais risco de desync.
export const SETORES = [
  { name: "Administração",                           code: "ADM" },
  { name: "Alocação",                                code: "ALO" },
  { name: "Aracaju",                                 code: "AJU" },
  { name: "Câmbio",                                  code: "CAM" },
  { name: "Campo Grande",                            code: "CGR" },
  { name: "Capital Humano",                          code: "RH" },
  { name: "Cascavel",                                code: "CVV" },
  { name: "Commodities",                             code: "CMO" },
  { name: "Connect",                                 code: "CONN" },
  { name: "Corporate",                               code: "COR" },
  { name: "Cuiabá",                                  code: "CBA" },
  { name: "Curitiba",                                code: "CTB" },
  { name: "Curitiba Digital",                        code: "CTBDGT" },
  { name: "Digital",                                 code: "DIG" },
  { name: "Financeiro",                              code: "FIN" },
  { name: "Foz do Iguaçu",                           code: "FOZ" },
  { name: "Institucional",                           code: "INST" },
  { name: "Jurídico",                                code: "JUR" },
  { name: "Londrina",                                code: "LDN" },
  { name: "Marketing",                               code: "MKT" },
  { name: "Marketing Digital",                       code: "MKTDGT" },
  { name: "Maringá",                                 code: "MGF" },
  { name: "Maringá Digital",                         code: "MGFDGT" },
  { name: "Middle",                                  code: "MID" },
  { name: "Performance",                             code: "PER" },
  { name: "Produto",                                 code: "PRO" },
  { name: "Proteção Patrimonial",                    code: "PPA" },
  { name: "Renda Fixa",                              code: "RF" },
  { name: "Renda Variável",                          code: "RV" },
  { name: "Salvador",                                code: "SSA" },
  { name: "São Paulo",                               code: "SAO" },
  { name: "São Paulo Digital",                       code: "SAODGT" },
  { name: "SVN Gestão",                              code: "GEST" },
  { name: "SVN Global",                              code: "GLO" },
  { name: "SVN Investment & Merchant Banking (M&A)", code: "IMB" },
  { name: "Toledo",                                  code: "TLD" },
  { name: "Universidade SVN",                        code: "USVN" },
  { name: "Vitória da Conquista",                    code: "VDC" },
  { name: "Wealth Planning",                         code: "WEAL" },
] as const;

// Lista de nomes — mantém compatibilidade com quem já consome SETORES_LIST
// (rota /form-schemas → dropdown do frontend).
export const SETORES_LIST: string[] = SETORES.map(s => s.name);

// Mapa nome → código, consumido pelo clickup.ts na geração do ID.
export const SETOR_CODIGO_MAP: Record<string, string> =
  Object.fromEntries(SETORES.map(s => [s.name, s.code]));

export const FORM_SCHEMAS: Record<string, FormSchema> = {
  'cartao-boas-vindas': {
    tipo: 'cartao-boas-vindas',
    label: 'Cartão de Boas-vindas',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',        label: 'Telefone',              type: 'tel',    required: true },
      { name: 'nome_cliente',    label: 'Nome do cliente',        type: 'text',   required: true },
      { name: 'nome_assinatura', label: 'Nome para assinatura',   type: 'text',   required: true },
      { name: 'unidade',         label: 'Unidade',                type: 'text',   required: true },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
      {
        name: 'is_private_key', label: 'Cliente Private?', type: 'radio', required: true,
        options: [
          { value: 'padrao',  label: 'Padrão' },
          { value: 'private', label: 'Private' },
        ],
      },
    ],
    computed: [
      { name: 'contrato_label', label: 'Contrato (label)', derived_from: 'contrato_social' },
    ],
    template_variant_field: 'is_private_key',
  },

  'cartao-visita-fisico': {
    tipo: 'cartao-visita-fisico',
    label: 'Cartão de Visita — Físico',
    is_automation: false,
    has_clickup: true,
    has_approval_flow: true,
    has_downloadable_artifact: false,
    fields: [
      { name: 'nome',            label: 'Nome completo',   type: 'text',   required: true },
      { name: 'whatsapp',        label: 'WhatsApp',         type: 'tel',    required: true },
      { name: 'email',           label: 'E-mail corporativo', type: 'email', required: true },
      { name: 'unidade',         label: 'Unidade',          type: 'text',   required: true },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
    ],
    computed: [
      { name: 'contrato_label', label: 'Contrato (label)', derived_from: 'contrato_social' },
    ],
  },

  'cartao-visita-digital': {
    tipo: 'cartao-visita-digital',
    label: 'Cartão de Visita — Digital',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    template_variant_field: 'contrato_social',
    fields: [
      { name: 'nome',            label: 'Nome completo',       type: 'text',   required: true },
      { name: 'telefone',        label: 'Telefone',             type: 'tel',    required: true },
      { name: 'email',           label: 'E-mail corporativo',   type: 'email',  required: true },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
      { name: 'foto_perfil', label: 'Foto de perfil', type: 'file' },
    ],
    computed: [
      {
        name: 'contrato_label', label: 'Contrato (label)',
        derived_from: 'contrato_social', transform: 'label_by_value',
        lookup: {
          'svn-investimentos': 'SVN Investimentos',
          'svn-connect':       'SVN Connect',
          'svn-capital':       'SVN Capital',
        },
      },
      { name: 'telefone_digits', label: 'Telefone (só dígitos + 55)', derived_from: 'telefone', transform: 'digits_only' },
      {
        name: 'site_url', label: 'URL do site da marca',
        derived_from: 'contrato_social', transform: 'website_by_value',
        lookup: {
          'svn-investimentos': 'https://svninvestimentos.com.br',
          'svn-connect':       'https://svnconnect.com.br',
          'svn-capital':       'https://svncapital.com.br',
        },
      },
    ],
  },

  'divulgacao-nps': {
    tipo: 'divulgacao-nps',
    label: 'Arte NPS',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',        label: 'Telefone',            type: 'tel',      required: true },
      { name: 'nome_assinatura', label: 'Nome para assinatura', type: 'text',    required: true },
      {
        name: 'cargo', label: 'Cargo', type: 'select', required: true,
        options: CARGOS_OPTS,
      },
      { name: 'agradecimento',   label: 'Mensagem de agradecimento', type: 'textarea', required: true },
      {
        name: 'modelo_arte', label: 'Modelo da arte', type: 'select', required: true,
        options: [
          { value: 'com-foto',  label: 'Com foto' },
          { value: 'sem-foto',  label: 'Sem foto' },
        ],
      },
      { name: 'foto_perfil', label: 'Foto de perfil', type: 'file' },
    ],
    template_variant_field: 'modelo_arte',
  },

  'convite-fp': {
    tipo: 'convite-fp',
    label: 'Convite Financial Planning',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',         label: 'Telefone',            type: 'tel',    required: true },
      { name: 'codigo_assessor',  label: 'Código do assessor',  type: 'text',   required: true },
      { name: 'nome_assinatura',  label: 'Nome para assinatura', type: 'text',  required: true },
      {
        name: 'cargo', label: 'Cargo', type: 'select', required: true,
        options: CARGOS_OPTS,
      },
      {
        name: 'contrato_social', label: 'Contrato Social', type: 'select', required: true,
        options: CONTRATOS_OPTS,
      },
    ],
    computed: [
      { name: 'contrato_label', label: 'Contrato (label)', derived_from: 'contrato_social' },
      {
        name: 'fp_link', label: 'Link Financial Planning',
        derived_from: 'contrato_social', transform: 'website_by_value',
        lookup: {
          'svn-investimentos': 'https://svninvestimentos.com.br/financial-planning/',
          'svn-connect':       'https://svnconnect.com.br/financial-planning/',
          'svn-capital':       'https://svncapital.com.br/financial-planning/',
        },
      },
    ],
  },


  'cartao-comemorativo': {
    tipo: 'cartao-comemorativo',
    label: 'Cartão Comemorativo',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',           label: 'Telefone',           type: 'tel',      required: true },
      { name: 'nome_aniversariante', label: 'Nome do aniversariante', type: 'text', required: true },
      {
        name: 'modelo_cartao', label: 'Modelo do cartão', type: 'select', required: true,
        options: [
          { value: 'dourado',   label: 'Dourado' },
          { value: 'vermelho',  label: 'Vermelho' },
        ],
      },
      { name: 'mensagem',           label: 'Mensagem',           type: 'textarea' },
      { name: 'assinatura',         label: 'Assinatura',         type: 'textarea' },
      { name: 'email_destinatario', label: 'E-mail do destinatário', type: 'email', required: true },
    ],
    template_variant_field: 'modelo_cartao',
  },

  'assinatura-email': {
    tipo: 'assinatura-email',
    label: 'Assinatura de E-mail',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    template_variant_field: 'marca',
    fields: [
      { name: 'nome',              label: 'Nome completo',    type: 'text',  required: true },
      { name: 'telefone',          label: 'Telefone',          type: 'tel',   required: true },
      { name: 'email',             label: 'E-mail corporativo', type: 'email', required: true },
      {
        name: 'marca', label: 'Marca / empresa', type: 'select', required: true,
        options: MARCAS_OPTS,
      },
      { name: 'cargo',             label: 'Cargo',             type: 'text',  required: true },
      {
        name: 'tem_cfp', label: 'Tem CFP?', type: 'radio', required: true,
        options: [
          { value: 'sim', label: 'Sim' },
          { value: 'nao', label: 'Não' },
        ],
      },
    ],
    computed: [
      { name: 'marca_label', label: 'Marca (label)', derived_from: 'marca' },
    ],
  },
};

export const VALID_TIPOS: string[] = [
  "eventos",
  "artes-divulgacao",
  "atualizacao-material",
  "conteudo-pdf-informativo",
  "conteudo-pdf-ebook",
  "apresentacao-nova",
  "apresentacao-atualizar",
  "pagina-assessores-dados",
  "pagina-assessores-atualizacao",
  "assinatura-email",
  "cartao-visita-fisico",
  "cartao-visita-digital",
  "cartao-boas-vindas",
  "divulgacao-nps",
  "convite-fp",
  "pagina-online",
  "outro",
  "cartao-comemorativo",
  "brindes",
  "patrocinio",
  "email-marketing",
  "producao-video",
  "sessao-fotos",
  "materiais-impressos",
  "ch-kit-onboarding",
  "ch-atualizacao-pessoas",
  "ch-atualizacao-books",
  "ch-linha-do-tempo",
  "ch-aniversariantes",
];

export const TIPOS_COM_CLICKUP: Array<{ tipo: string; label: string }> = [
  { tipo: "ch-kit-onboarding",      label: "Kit Onboarding" },
  { tipo: "ch-atualizacao-pessoas", label: "Atualização de Pessoas nos Sites" },
  { tipo: "ch-atualizacao-books",   label: "Atualização de Books" },
  { tipo: "ch-linha-do-tempo",      label: "Linha do Tempo" },
  { tipo: "ch-aniversariantes",     label: "Aniversariantes do Mês" },
  { tipo: "eventos",                       label: "Eventos" },
  { tipo: "artes-divulgacao",              label: "Artes de Divulgação" },
  { tipo: "atualizacao-material",          label: "Atualização de Material" },
  { tipo: "conteudo-pdf-informativo",      label: "PDF — Informativo" },
  { tipo: "conteudo-pdf-ebook",            label: "PDF — Ebook" },
  { tipo: "apresentacao-nova",             label: "Apresentação — Nova" },
  { tipo: "apresentacao-atualizar",        label: "Apresentação — Atualização" },
  { tipo: "pagina-assessores-dados",       label: "Página de Assessores — Dados" },
  { tipo: "pagina-assessores-atualizacao", label: "Página de Assessores — Atualização" },
  { tipo: "cartao-visita-fisico",          label: "Cartão de Visita — Físico" },
  { tipo: "pagina-online",                 label: "Página Online" },
  { tipo: "outro",                         label: "Outro" },
  { tipo: "brindes",                       label: "Brindes" },
  { tipo: "patrocinio",                    label: "Patrocínio" },
  { tipo: "email-marketing",               label: "E-mail Marketing" },
  { tipo: "producao-video",                label: "Produção de Vídeo" },
  { tipo: "sessao-fotos",                  label: "Sessão de Fotos" },
  { tipo: "materiais-impressos",           label: "Materiais Impressos" },
];

export function getFormSchemaList() {
  return Object.values(FORM_SCHEMAS).map(s => {
    const variantField = s.template_variant_field;
    const variantOptions = variantField
      ? (s.fields.find(f => f.name === variantField)?.options ?? [])
      : [];
    return {
      tipo: s.tipo,
      label: s.label,
      description: s.description,
      template_variant_field: variantField ?? null,
      template_variant_options: variantOptions,
      field_options: Object.fromEntries(
        s.fields
          .filter(fl => Array.isArray(fl.options) && fl.options.length > 0)
          .map(fl => [fl.name, Object.fromEntries((fl.options ?? []).map(o => [o.value, o.label]))]),
      ),
      is_automation: s.is_automation,
      has_clickup: s.has_clickup,
      has_approval_flow: s.has_approval_flow,
      has_downloadable_artifact: s.has_downloadable_artifact,
      placeholders: [
        ...s.fields.map(f => f.name),
        ...(s.computed || []).map(c => c.name),
      ],
    };
  });
}
