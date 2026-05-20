export type ArtTemplate = {
  id?: number;
  tipo: string;
  output_format?: 'png' | 'pdf';
  canvas: { width: number; height: number };
  bg: BgConfig;
  layers: Layer[];
};

export type BgConfig =
  | { type: 'static'; url: string }
  | {
      type: 'variant';
      variants: Record<string, string>;
      variant_source: string;
    };

export type LayerLink =
  | { type: 'static';      url: string }
  | { type: 'template';    template: string }
  | { type: 'placeholder'; placeholder: string };

export type Layer = TextLineLayer | TextBlockLayer | ImageLayer | ShapeLayer;

export type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  link?: LayerLink;
};

export type TextLineLayer = LayerBase & {
  type: 'text-line';
  w: number;
  content: string;
  font_family: string;
  font_size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  auto_fit?: {
    enabled: boolean;
    min_font_size: number;
  };
};

export type TextBlockLayer = LayerBase & {
  type: 'text-block';
  w: number;
  h: number;
  content: string;
  font_family: string;
  font_size: number;
  line_height: number;
  paragraph_spacing: number;
  color: string;
  align: 'left' | 'center' | 'right';
  vertical_align?: 'top' | 'middle' | 'bottom';
};

export type ImageLayer = LayerBase & {
  type: 'image';
  w: number;
  h: number;
  source:
    | { type: 'static'; url: string }
    | { type: 'placeholder'; field: string }
    | {
        type: 'variant';
        variants: Record<string, string>;
        variant_source: string;
      };
  blend_mode?: 'normal' | 'screen' | 'multiply';
  resize_mode?: 'contain' | 'cover' | 'fill';
  shape?: 'rectangle' | 'circle';
  border?: {
    width: number;
    color: string;
  };
};

export type ShapeLayer = LayerBase & {
  type: 'shape';
  shape: 'rectangle' | 'ellipse';
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  stroke_width?: number;
  border_radius?: number;
};

export const AVAILABLE_FONTS = [
  { family: 'Taviraj Light',           file: 'Taviraj-Light.woff2' },
  { family: 'Nunito Sans Light',       file: 'NunitoSans-Light.woff2' },
  { family: 'Ivy Journal Light',       file: 'IvyJournal-Light.ttf' },
  { family: 'Roobert PRO TRIAL Light', file: 'RoobertPROTRIAL-Light.otf' },
];

export const PLACEHOLDERS_BY_TIPO: Record<string, string[]> = {
  'assinatura-email':      ['nome', 'cargo', 'telefone', 'email', 'marca_label', 'tem_cfp', 'marca'],
  'cartao-boas-vindas':    ['telefone', 'nome_cliente', 'nome_assinatura', 'unidade', 'contrato_social', 'is_private_key', 'contrato_label'],
  'cartao-visita-digital': ['nome', 'telefone', 'email', 'contrato_social', 'foto_perfil', 'contrato_label', 'telefone_digits', 'site_url'],
  'divulgacao-nps':        ['telefone', 'nome_assinatura', 'cargo', 'agradecimento', 'modelo_arte', 'foto_perfil'],
  'convite-fp':            ['telefone', 'codigo_assessor', 'nome_assinatura', 'cargo', 'contrato_social', 'contrato_label'],
  'cartao-comemorativo':   ['telefone', 'nome_aniversariante', 'modelo_cartao', 'mensagem', 'assinatura', 'email_destinatario'],
};
