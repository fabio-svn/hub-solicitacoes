# Hub de Solicitações SVN — Template Editor visual para geradores de arte

Este prompt transforma o sistema de geração de arte (assinatura de e-mail + cartão de boas-vindas) em uma plataforma data-driven com editor visual. Em vez de coordenadas hardcoded no código, cada tipo de arte tem um **template configurável via UI** que admins podem editar com drag/resize, controle de fonte, cor etc.

A entrega elimina a necessidade de mudanças de código pra ajustar layouts e prepara terreno pra qualquer arte futura (cartão de aniversário, evento, etc.) usar o mesmo editor.

São 8 etapas. Execute na ordem. Após terminar, `cd artifacts/api-server && pnpm run build` + restart.

---

## Etapa 1 — Schema do banco

### 1.1 Nova tabela `art_templates`

```sql
CREATE TABLE art_templates (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(100) NOT NULL UNIQUE,
  config JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_art_templates_tipo ON art_templates(tipo);
```

A coluna `config` armazena a estrutura completa do template (canvas, layers, bg, etc.) em JSONB. Atualizar via Drizzle schema correspondente.

---

## Etapa 2 — Modelo de dados (TypeScript)

Criar `src/types/art-template.ts`:

```ts
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
      variants: Record<string, string>;  // ex: { padrao: 'url1', private: 'url2' }
      variant_source: string;             // nome do campo do form que decide
    };

export type Layer = TextLineLayer | TextBlockLayer | ImageLayer;

export type LayerBase = {
  id: string;          // identificador único, ex: 'nome_cliente'
  name: string;        // label humanizado, ex: 'Nome do cliente'
  x: number;
  y: number;
};

export type TextLineLayer = LayerBase & {
  type: 'text-line';
  w: number;
  content: string;     // suporta placeholders: '{{nome_cliente}}'
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
  content: string;     // suporta \n\n pra parágrafos e {{placeholders}}
  font_family: string;
  font_size: number;
  line_height: number;
  paragraph_spacing: number;
  color: string;
  align: 'left' | 'center' | 'right';
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
  resize_mode?: 'contain' | 'cover' | 'fill';  // default 'contain'
};
```

### Fontes disponíveis (hardcoded no editor)

```ts
export const AVAILABLE_FONTS = [
  { family: 'Taviraj Light',           file: 'Taviraj-Light.ttf' },
  { family: 'Nunito Sans Light',       file: 'NunitoSans-Light.ttf' },
  { family: 'Ivy Journal Light',       file: 'IvyJournal-Light.ttf' },
  { family: 'Roobert PRO TRIAL Light', file: 'RoobertPROTRIAL-Light.otf' },
];
```

Garantir que os 4 arquivos estão em `assets/fonts/`. Se algum estiver faltando, adicionar (Taviraj/Nunito conforme rodada anterior).

### Placeholders disponíveis por tipo

```ts
export const PLACEHOLDERS_BY_TIPO: Record<string, string[]> = {
  'assinatura-email': [
    'nome', 'cargo', 'telefone', 'email', 'marca_label'
  ],
  'cartao-boas-vindas': [
    'nome_cliente', 'nome_assinatura', 'unidade', 'contrato_label'
  ],
};
```

Editor lista essas opções como sugestões quando admin edita o campo `content` de uma layer.

---

## Etapa 3 — Refactor do generator (engine data-driven)

Criar `src/services/template-renderer.ts` — engine única que substitui `welcome-card-generator.ts` e parte do `assinatura-generator.ts`:

```ts
import sharp from 'sharp';
import fontkit from 'fontkit';
import fs from 'fs';
import path from 'path';
import { ArtTemplate, TextLineLayer, TextBlockLayer, ImageLayer } from '../types/art-template';

const ASSETS_DIR = path.resolve(__dirname, '../../assets');

// Cache de fontes carregadas
const fontCache = new Map<string, any>();
function loadFont(file: string): any {
  if (fontCache.has(file)) return fontCache.get(file);
  const font = fontkit.openSync(path.join(ASSETS_DIR, 'fonts', file));
  fontCache.set(file, font);
  return font;
}

// Mapping family → file
const FONT_FILES: Record<string, string> = {
  'Taviraj Light':           'Taviraj-Light.ttf',
  'Nunito Sans Light':       'NunitoSans-Light.ttf',
  'Ivy Journal Light':       'IvyJournal-Light.ttf',
  'Roobert PRO TRIAL Light': 'RoobertPROTRIAL-Light.otf',
};

function getFont(family: string): any {
  const file = FONT_FILES[family];
  if (!file) throw new Error(`Fonte desconhecida: ${family}`);
  return loadFont(file);
}

// Cache de assets remotos (mesmo padrão do gerador atual)
const assetCache = new Map<string, Buffer>();
async function getRemoteAsset(url: string): Promise<Buffer> {
  if (url.startsWith('http')) {
    const cached = assetCache.get(url);
    if (cached) return cached;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    assetCache.set(url, buf);
    return buf;
  }
  // path local
  return fs.promises.readFile(url.startsWith('/') ? url : path.join(ASSETS_DIR, url));
}

// ============================================================
// Funções de medição e rendering (mesmas dos geradores atuais)
// ============================================================
function measureTextWidth(font: any, text: string, fontSize: number): number {
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  return run.positions.reduce((s: number, p: any) => s + p.xAdvance, 0) * scale;
}

function wrapTextToLines(font: any, text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (measureTextWidth(font, test, fontSize) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderTextBuffer(font: any, text: string, fontSize: number, fill: string) {
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  const ascent = font.ascent * scale;
  const descent = Math.abs(font.descent) * scale;
  const baselineY = Math.ceil(ascent);
  const svgHeight = Math.ceil(ascent + descent);

  let x = 0;
  const pathElements: string[] = [];
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i];
    const pos = run.positions[i];
    const pathData = glyph.path.toSVG();
    if (pathData) {
      const tx = (x + pos.xOffset) * scale;
      const ty = baselineY + pos.yOffset * scale;
      pathElements.push(
        `<path d="${pathData}" transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(5)},-${scale.toFixed(5)})" fill="${fill}"/>`
      );
    }
    x += pos.xAdvance;
  }
  const totalWidth = Math.ceil(x * scale) + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${svgHeight}">${pathElements.join('')}</svg>`;
  return {
    buffer: await sharp(Buffer.from(svg)).png().toBuffer(),
    width: totalWidth,
    ascent,
  };
}

function topForText(font: any, fontSize: number, yTop: number): number {
  const scale = fontSize / font.unitsPerEm;
  const capHeight = (font.capHeight || font.ascent * 0.7) * scale;
  const ascentPx = font.ascent * scale;
  return Math.round(yTop - (ascentPx - capHeight));
}

function alignedLeft(boxX: number, boxW: number, textWidth: number, align: string): number {
  if (align === 'center') return Math.round(boxX + (boxW - textWidth) / 2);
  if (align === 'right')  return Math.round(boxX + boxW - textWidth);
  return boxX;
}

// ============================================================
// Substituição de placeholders
// ============================================================
function substitute(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

// ============================================================
// Renderização por tipo de layer
// ============================================================
async function renderTextLine(
  layer: TextLineLayer,
  data: Record<string, string>,
  composites: sharp.OverlayOptions[]
) {
  const text = substitute(layer.content, data);
  const font = getFont(layer.font_family);

  let fontSize = layer.font_size;
  if (layer.auto_fit?.enabled) {
    const natural = measureTextWidth(font, text, fontSize);
    if (natural > layer.w) {
      const scaled = Math.floor(fontSize * (layer.w / natural));
      fontSize = Math.max(scaled, layer.auto_fit.min_font_size);
    }
  }

  const { buffer, width } = await renderTextBuffer(font, text, fontSize, layer.color);
  composites.push({
    input: buffer,
    top: topForText(font, fontSize, layer.y),
    left: alignedLeft(layer.x, layer.w, width, layer.align),
  });
}

async function renderTextBlock(
  layer: TextBlockLayer,
  data: Record<string, string>,
  composites: sharp.OverlayOptions[]
) {
  const text = substitute(layer.content, data);
  const font = getFont(layer.font_family);
  const paragraphs = text.split(/\n\n+/);

  let yCursor = layer.y;
  for (let p = 0; p < paragraphs.length; p++) {
    const lines = wrapTextToLines(font, paragraphs[p], layer.font_size, layer.w);
    for (const line of lines) {
      const { buffer, width } = await renderTextBuffer(font, line, layer.font_size, layer.color);
      composites.push({
        input: buffer,
        top: topForText(font, layer.font_size, yCursor),
        left: alignedLeft(layer.x, layer.w, width, layer.align),
      });
      yCursor += layer.line_height;
    }
    if (p < paragraphs.length - 1) {
      yCursor += layer.paragraph_spacing;
    }
  }
}

async function renderImage(
  layer: ImageLayer,
  data: Record<string, string>,
  composites: sharp.OverlayOptions[]
) {
  let url: string;
  if (layer.source.type === 'static') {
    url = layer.source.value!;
  } else {
    const variantKey = data[layer.source.variant_source!];
    url = layer.source.variants![variantKey];
    if (!url) throw new Error(`Variante de imagem não encontrada: ${variantKey}`);
  }

  const raw = await getRemoteAsset(url);
  const resized = await sharp(raw)
    .resize(layer.w, layer.h, { fit: layer.resize_mode ?? 'contain' })
    .toBuffer();

  const composite: sharp.OverlayOptions = {
    input: resized,
    top: layer.y,
    left: layer.x,
  };
  if (layer.blend_mode && layer.blend_mode !== 'normal') {
    composite.blend = layer.blend_mode as any;
  }
  composites.push(composite);
}

// ============================================================
// API principal
// ============================================================
export async function renderFromTemplate(
  template: ArtTemplate,
  data: Record<string, any>
): Promise<Buffer> {
  // Stringify all data values
  const dataStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    dataStr[k] = String(v ?? '');
  }

  // 1) Resolver bg
  let bgUrl: string;
  if (template.bg.type === 'static') {
    bgUrl = template.bg.url;
  } else {
    const variantKey = dataStr[template.bg.variant_source];
    bgUrl = template.bg.variants[variantKey];
    if (!bgUrl) throw new Error(`Variante de bg não encontrada: ${variantKey}`);
  }
  const bgBuf = await getRemoteAsset(bgUrl);

  // 2) Renderizar cada layer
  const composites: sharp.OverlayOptions[] = [];
  for (const layer of template.layers) {
    if (layer.type === 'text-line')   await renderTextLine(layer, dataStr, composites);
    if (layer.type === 'text-block')  await renderTextBlock(layer, dataStr, composites);
    if (layer.type === 'image')       await renderImage(layer, dataStr, composites);
  }

  // 3) Composição final
  return sharp(bgBuf).composite(composites).png().toBuffer();
}
```

---

## Etapa 4 — Seed das templates iniciais

Criar `src/scripts/seed-art-templates.ts`. Idempotente — usar `ON CONFLICT (tipo) DO UPDATE` ou checar antes de inserir.

### Template 1: `cartao-boas-vindas`

```ts
const CARTAO_BOAS_VINDAS_TEMPLATE: ArtTemplate = {
  tipo: 'cartao-boas-vindas',
  canvas: { width: 1446, height: 1770 },
  bg: {
    type: 'variant',
    variants: {
      padrao:  'assets/cartao_boas_vindas/bg-welcome-padrao.png',
      private: 'assets/cartao_boas_vindas/bg-welcome-private.png',
    },
    variant_source: 'is_private_key', // 'padrao' ou 'private' (boolean → key no handler)
  },
  layers: [
    {
      id: 'nome_cliente', name: 'Nome do cliente', type: 'text-line',
      x: 338, y: 188, w: 764,
      content: '{{nome_cliente}}',
      font_family: 'Taviraj Light', font_size: 70, color: '#FFF8F3', align: 'center',
    },
    {
      id: 'frase_inicial', name: 'Frase inicial', type: 'text-line',
      x: 296, y: 278, w: 848,
      content: 'Que privilégio ter você conosco na SVN!',
      font_family: 'Taviraj Light', font_size: 40, color: '#FFF8F3', align: 'center',
    },
    {
      id: 'mensagem', name: 'Mensagem', type: 'text-block',
      x: 297, y: 528, w: 847, h: 596,
      content:
        'Acreditamos que cada cliente é único e estamos dedicados a entender suas necessidades, fornecendo a assessoria necessária para maximizar seus resultados financeiros. Nossa equipe de especialistas está sempre à disposição para oferecer consultoria de qualidade, análise de mercado e estratégias de investimento sob medida.\n\n' +
        'Na {{contrato_label}}, nossa missão é proporcionar as melhores soluções financeiras e orientações personalizadas para alcançar seus objetivos de investimento. Nosso compromisso é com a transparência, a confiança e a excelência no atendimento.\n\n' +
        'Estamos animados para iniciar esta jornada com você!',
      font_family: 'Nunito Sans Light',
      font_size: 37, line_height: 45, paragraph_spacing: 20,
      color: '#221B19', align: 'center',
    },
    {
      id: 'frase_boas_vindas', name: 'Frase de boas-vindas', type: 'text-line',
      x: 297, y: 1169, w: 847,
      content: 'Bem-vindo(a) à {{contrato_label}}.',
      font_family: 'Nunito Sans Light', font_size: 35, color: '#221B19', align: 'center',
    },
    {
      id: 'nome_assinatura', name: 'Nome para assinatura', type: 'text-line',
      x: 349, y: 1281, w: 743,
      content: '{{nome_assinatura}}',
      font_family: 'Taviraj Light', font_size: 40, color: '#221B19', align: 'center',
    },
    {
      id: 'unidade', name: 'Unidade', type: 'text-line',
      x: 349, y: 1346, w: 743,
      content: '{{unidade}}',
      font_family: 'Taviraj Light', font_size: 40, color: '#221B19', align: 'center',
    },
    {
      id: 'logo', name: 'Logo', type: 'image',
      x: 419, y: 1585, w: 603, h: 62,
      source: {
        type: 'variant',
        variants: {
          'svn-investimentos': 'https://solicitacoes.portalsvn.com.br/assinatura_email/assinaturas_assinatura_svn.png',
          'svn-capital':       'https://solicitacoes.portalsvn.com.br/assinatura_email/assinaturas_assinatura_logo_svn_capital.png',
          'svn-connect':       'https://solicitacoes.portalsvn.com.br/assinatura_email/assinaturas_assinatura_logo_svn_connect.png',
        },
        variant_source: 'contrato_social',
      },
      blend_mode: 'screen',
      resize_mode: 'contain',
    },
  ],
};
```

### Template 2: `assinatura-email`

Replicar **exatamente** o layout atual em formato de template — pegar coordenadas, fontes, etc. do `assinatura-generator.ts` existente e converter pro novo formato. Garantir auto-fit nos campos `nome` e `email` (`auto_fit: { enabled: true, min_font_size: 90 }` pro nome, `42` pro email). Inclui as 9 marcas conhecidas no `variant_source: 'marca'` da layer do logo.

Salvar ambos com `ON CONFLICT (tipo) DO UPDATE SET config = EXCLUDED.config`.

Adicionar script ao `package.json`:
```json
"seed-art-templates": "tsx src/scripts/seed-art-templates.ts"
```

---

## Etapa 5 — Endpoints CRUD (admin only)

Todos com middleware `requireAdmin`.

### `GET /api/admin/art-templates`
Retorna lista de templates com `tipo`, `updated_at`, `updated_by` (sem o config inteiro pra ser leve).

### `GET /api/admin/art-templates/:tipo`
Retorna template completo incluindo `config`.

### `PUT /api/admin/art-templates/:tipo`
Body: `{ config: ArtTemplate }`. Validação básica de schema (todos os campos required presentes). Atualiza `updated_by = req.user.id`, `updated_at = NOW()`.

### `POST /api/admin/art-templates/:tipo/preview`
Body:
```ts
{
  config: ArtTemplate,    // template em edição (pode estar não salvo)
  data: Record<string, any>  // dados de teste pro preview
}
```
Renderiza usando `renderFromTemplate` e retorna o PNG no response com `Content-Type: image/png`.

### `GET /api/admin/art-templates/:tipo/sample-data`
Busca a solicitação mais recente daquele tipo, retorna os campos relevantes pra pré-popular o painel de dados de teste. Se não houver, retorna defaults sensatos:
```ts
{
  // cartao-boas-vindas
  nome_cliente: 'Cliente Teste',
  nome_assinatura: 'João Sardeto',
  unidade: 'SVN Maringá',
  contrato_social: 'svn-investimentos',
  contrato_label: 'SVN Investimentos',
  is_private_key: 'padrao',
}
```

---

## Etapa 6 — Frontend: Editor visual

Adicionar nova página/rota `/admin/templates` no dashboard. Visível apenas pra admins.

### 6.1 Estrutura visual

Layout em 3 colunas:

```
┌─────────────────┬───────────────────────────┬─────────────────────┐
│ Templates       │ Canvas (bg + layers)      │ Propriedades        │
│                 │                           │                     │
│ • Cartão BV     │  [imagem bg em escala]    │ Layer: Mensagem     │
│ • Assinatura    │                           │                     │
│                 │  ┌─[Nome cliente]───┐    │ Posição:            │
│                 │  └──────────────────┘    │   X: 297            │
│                 │                           │   Y: 528            │
│                 │  ┌─[Frase inicial]───┐   │ Tamanho:            │
│                 │  └───────────────────┘   │   W: 847            │
│                 │                           │   H: 596            │
│                 │  ┌─[Mensagem]──────┐    │                     │
│                 │  │                 │    │ Fonte: [select]     │
│                 │  └─────────────────┘    │ Tamanho: 37         │
│                 │                           │ Cor: [picker]       │
│                 │  ...                      │ Align: [c]          │
│                 │                           │ Line height: 45     │
│ + Novo template │                           │ Parag. spacing: 20  │
│                 │                           │                     │
├─────────────────┼───────────────────────────┤ Conteúdo:           │
│ Layers          │ [Atualizar Preview]       │ [textarea]          │
│                 │                           │                     │
│ • Nome cliente  │ [Preview render result]   │ Variáveis:          │
│ • Frase inicial │                           │ {{contrato_label}}  │
│ • Mensagem      │                           │                     │
│ • ...           │ [Salvar template]         │ [Deletar layer]     │
├─────────────────┴───────────────────────────┴─────────────────────┤
│ Dados de teste                                                   │
│ [campo nome_cliente: ___]  [campo unidade: ___]  [etc]            │
└──────────────────────────────────────────────────────────────────┘
```

### 6.2 Bibliotecas sugeridas

Pra drag & resize: **interact.js** (vanilla JS, leve, fácil de integrar). Alternativa: **react-rnd** se o frontend for React.

```bash
pnpm add interactjs   # ou react-rnd
```

### 6.3 Coordenadas e scaling

Canvas real é 1446×1770. Browser mostra em escala menor (ex.: 500×612, ~35% do real). Toda interação precisa converter:

```ts
const SCALE = displayWidth / template.canvas.width;
const realCoord = displayCoord / SCALE;
const displayCoord = realCoord * SCALE;
```

Bg image renderizada com `width: 100%`. Layers sobrepostas com `position: absolute` em coords escaladas.

### 6.4 Funcionalidades essenciais

- **Selecionar layer** clicando na caixa → painel de propriedades atualiza
- **Drag** da caixa selecionada → atualiza `x, y`
- **Resize** pelas 8 alças (4 cantos + 4 lados) → atualiza `w, h` (texts blocks têm h, text lines não — só `w`)
- **Editar propriedades** no painel direito → atualiza estado e re-renderiza a caixa
- **Inserir placeholder** no campo content via dropdown ou clicar nas sugestões → injeta `{{nome_cliente}}` no cursor
- **Adicionar layer** (text-line, text-block ou image) — botão no painel de layers
- **Deletar layer** — botão no painel de propriedades
- **Reordenar layers** — drag no painel de layers (controla z-order da composição)
- **Mudar bg variant** — dropdown se o template tiver variantes (mostra qual bg está vendo no momento)
- **Atualizar preview** — botão grande que faz POST `/preview` e mostra o PNG renderizado no lugar das caixas overlay
- **Salvar template** — PUT `/api/admin/art-templates/:tipo` com o config atual
- **Painel de dados de teste** (rodapé): inputs pra cada placeholder disponível pro tipo, pré-populados via `GET /sample-data`

### 6.5 Estados visuais

- Layer selecionada: borda de destaque (azul brand)
- Layer com erro (ex.: fora do canvas): borda vermelha + ícone de alerta
- Modo "preview": esconde overlays de layer, mostra o PNG renderizado
- Modo "editar": mostra overlays, esconde preview

Toggle entre os dois modos com um switch no canvas.

### 6.6 Persistência de edições

- Edições ficam apenas no estado local do componente até clicar em **Salvar**
- Indicador visual "* não salvo" no nome do template quando há mudanças pendentes
- Aviso ao tentar trocar de template / sair da página com edições não salvas

---

## Etapa 7 — Conectar handlers com o template engine

### 7.1 Form handler de `cartao-boas-vindas`

Antes (gerador hardcoded):
```ts
const pngBuffer = await gerarCartaoBoasVindas({ nomeCliente, ... });
```

Depois (template-driven):
```ts
import { renderFromTemplate } from '../services/template-renderer';

const template = await db.query.artTemplates.findFirst({
  where: eq(artTemplates.tipo, 'cartao-boas-vindas'),
});
if (!template) throw new Error('Template não encontrado');

const pngBuffer = await renderFromTemplate(template.config, {
  nome_cliente: dados.nome_cliente,
  nome_assinatura: dados.nome_assinatura,
  unidade: dados.unidade,
  contrato_social: dados.contrato_social,
  contrato_label: CONTRATO_LABELS[dados.contrato_social],
  is_private_key: dados.cliente_private ? 'private' : 'padrao',
});

const key = `cartoes-boas-vindas/${solicitacao.id}.png`;
const url = await uploadToR2(key, pngBuffer, 'image/png');
// ... resto igual
```

### 7.2 Form handler de `assinatura-email`

Mesmo padrão. Substituir chamada ao `gerarAssinatura` por `renderFromTemplate` lendo o template do DB. Manter a lógica de `getAssigneesForTipo` e webhook como está.

### 7.3 Cleanup

Após confirmar que tudo está funcionando via template, remover os arquivos:
- `src/services/welcome-card-generator.ts` (substituído por template-renderer)
- A lógica hardcoded de `assinatura-generator.ts` que renderizava posições — manter só se houver helpers reaproveitáveis

---

## Etapa 8 — Permissões e validação

- Todos os endpoints de `art-templates` validam `req.user.role === 'admin'`
- Página `/admin/templates` redireciona não-admins
- Validação do JSON na hora de salvar:
  - Todos os layers têm `id` único
  - Coordenadas dentro dos limites do canvas (com tolerância — `x + w <= canvas.width + 50` pra permitir overflow controlado)
  - Fontes referenciadas existem na lista `AVAILABLE_FONTS`
  - Variant sources referenciam placeholders válidos pro tipo

---

## Build e validação

```bash
cd artifacts/api-server
pnpm run build
pnpm run seed-art-templates   # popula templates iniciais
# Restart
```

### Smoke tests

1. **Seed funcionou**: abrir `GET /api/admin/art-templates`, conferir que tem 2 templates (cartao-boas-vindas, assinatura-email)
2. **Geração via template funciona**: criar uma solicitação real de cartão de boas-vindas → resultado deve bater visualmente com o que tinha antes (já que os templates seedam o layout atual)
3. **Mesma coisa pra assinatura de e-mail** — gerar uma e conferir paridade visual com o anterior
4. **Editor carrega**: ir em `/admin/templates`, selecionar Cartão de Boas-vindas. Canvas mostra bg + layers sobrepostas
5. **Drag funciona**: arrastar a layer "Mensagem". Posição X/Y atualiza no painel
6. **Resize funciona**: redimensionar pela alça de canto. W/H atualiza
7. **Preview funciona**: clicar Atualizar Preview → PNG renderizado mostrando layout atual com dados de teste
8. **Save persiste**: salvar template → recarregar página → mudanças continuam lá
9. **Geração usa template salvo**: depois de salvar uma mudança no editor (ex.: mudar fontSize de Mensagem pra 35), gerar nova solicitação real → PNG produzido reflete o tamanho novo
10. **Permissão**: tentar acessar `/admin/templates` como colaborador → redirect ou 403

### Validação visual crítica

Após o seed, gerar uma solicitação de cartão de boas-vindas com os mesmos dados que você usou antes ("João Sardeto", "SVN Maringá", "svn-connect", "Sim"). O resultado **precisa ser visualmente idêntico** ao último gerado pelo código hardcoded. Se houver qualquer diferença, é bug no template-renderer (não nas coordenadas — essas vieram diretamente do código antigo).
