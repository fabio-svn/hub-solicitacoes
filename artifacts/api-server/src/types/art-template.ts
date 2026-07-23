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
  letter_spacing?: number;                 // px extras entre glifos (kerning); default 0
  text_transform?: 'none' | 'uppercase' | 'capitalize-first'; // caixa do texto no render; default 'none'
  auto_fit?: {
    enabled: boolean;
    min_font_size: number;
    /** Se definido e o texto couber, a fonte cresce ate este tamanho. */
    max_font_size?: number;
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
  letter_spacing?: number;                 // px extras entre glifos (kerning); default 0
  text_transform?: 'none' | 'uppercase' | 'capitalize-first'; // caixa do texto no render; default 'none'
  auto_fit?: {
    enabled?: boolean;
    min_font_size?: number;
    /** Se definido e o texto couber, a fonte cresce ate este tamanho. */
    max_font_size?: number;
  };
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
  // Ponto de foco do recorte quando a imagem é cortada (círculo ou resize 'cover').
  // 'attention' = sharp detecta a região mais saliente (tipicamente o rosto). default 'center'.
  crop_focus?: 'center' | 'top' | 'bottom' | 'attention';
  shape?: 'rectangle' | 'circle';
  border?: {
    width: number;
    color: string;
  };
  /** Sombra projetada da forma que recorta a imagem. Ausente = sem sombra. */
  shadow?: {
    color?: string;
    blur?: number;       // 0 = sem sombra
    offset_x?: number;
    offset_y?: number;
    opacity?: number;    // 0..1 (default 0.35)
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
  /** Sombra projetada. Ausente = sem sombra (comportamento padrao). */
  shadow?: {
    color?: string;      // default '#000000'
    blur?: number;       // raio do desfoque em px (default 0 = sem sombra)
    offset_x?: number;   // deslocamento horizontal (default 0)
    offset_y?: number;   // deslocamento vertical (default 0)
    opacity?: number;    // 0..1 (default 0.35)
  };
};

export const AVAILABLE_FONTS = [
  { family: 'Taviraj Light',              file: 'Taviraj-Light.woff2' },
  { family: 'Nunito Sans Light',          file: 'NunitoSans-Light.woff2' },
  { family: 'Ivy Journal Thin',           file: 'IvyJournal-Thin.ttf' },
  { family: 'Ivy Journal Light',          file: 'IvyJournal-Light.ttf' },
  { family: 'Ivy Journal Regular',        file: 'IvyJournal-Regular.ttf' },
  { family: 'Ivy Journal SemiBold',       file: 'IvyJournal-SemiBold.ttf' },
  { family: 'Ivy Journal Bold',           file: 'IvyJournal-Bold.ttf' },
  { family: 'Roobert PRO TRIAL Light',    file: 'RoobertPROTRIAL-Light.otf' },
  { family: 'Roobert PRO TRIAL Regular',  file: 'RoobertPROTRIAL-Regular.otf' },
  { family: 'Roobert PRO TRIAL Medium',   file: 'RoobertPROTRIAL-Medium.otf' },
  { family: 'Roobert PRO TRIAL SemiBold', file: 'RoobertPROTRIAL-SemiBold.otf' },
  { family: 'Roobert PRO TRIAL Bold',     file: 'RoobertPROTRIAL-Bold.otf' },
  { family: 'Roobert PRO TRIAL Heavy',    file: 'RoobertPROTRIAL-Heavy.otf' },
];

/* PLACEHOLDERS-REMOVIDO: a lista de placeholders por tipo vivia aqui sem
   nenhum importador, e o admin-templates.js mantinha uma copia propria.
   A fonte viva e getFormSchemaList(), que ja devolve `placeholders` por tipo
   (campos + computed) no /api/form-schemas. */
