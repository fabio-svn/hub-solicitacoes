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

export const SETORES_LIST = [
  "Administração", "Alocação", "Aracaju", "Câmbio", "Campo Grande",
  "Capital Humano", "Cascavel", "Commodities", "Connect", "Corporate",
  "Cuiabá", "Curitiba", "Curitiba Digital", "Digital", "Financeiro",
  "Foz do Iguaçu", "Institucional", "Jurídico", "Londrina", "Marketing",
  "Marketing Digital", "Maringá", "Maringá Digital", "Middle", "Performance",
  "Produto", "Proteção Patrimonial", "Renda Fixa", "Renda Variável", "Salvador",
  "São Paulo", "São Paulo Digital", "SVN Gestão", "SVN Global",
  "SVN Investment & Merchant Banking (M&A)", "Toledo", "Universidade SVN",
  "Vitória da Conquista", "Wealth Planning",
];

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
    ],
  },

  'certificado-eventos': {
    tipo: 'certificado-eventos',
    label: 'Certificado para Eventos',
    is_automation: true,
    has_clickup: false,
    has_approval_flow: false,
    has_downloadable_artifact: true,
    fields: [
      { name: 'telefone',       label: 'Telefone',          type: 'tel',   required: true },
      { name: 'nome_completo',  label: 'Nome completo',      type: 'text',  required: true },
      { name: 'email',          label: 'E-mail',             type: 'email', required: true },
      { name: 'nome_evento',    label: 'Nome do evento',     type: 'text',  required: true },
      { name: 'id_evento',      label: 'ID do evento',       type: 'text',  required: true },
      { name: 'carga_horaria',  label: 'Carga horária',      type: 'text',  required: true },
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
