export type ArtTemplate = {
  tipo: string;
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

export type Layer = TextLineLayer | TextBlockLayer | ImageLayer;

export type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
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
    | {
        type: 'variant';
        variants: Record<string, string>;
        variant_source: string;
      };
  blend_mode?: 'normal' | 'screen' | 'multiply';
  resize_mode?: 'contain' | 'cover' | 'fill';
};

export const AVAILABLE_FONTS = [
  { family: 'Taviraj Light',           file: 'Taviraj-Light.woff2' },
  { family: 'Nunito Sans Light',       file: 'NunitoSans-Light.woff2' },
  { family: 'Ivy Journal Light',       file: 'IvyJournal-Light.ttf' },
  { family: 'Roobert PRO TRIAL Light', file: 'RoobertPROTRIAL-Light.otf' },
];

export const PLACEHOLDERS_BY_TIPO: Record<string, string[]> = {
  'assinatura-email': ['nome', 'cargo', 'telefone', 'email', 'marca_label'],
  'cartao-boas-vindas': ['nome_cliente', 'nome_assinatura', 'unidade', 'contrato_label'],
};
