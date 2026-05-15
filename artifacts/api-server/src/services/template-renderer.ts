import sharp from 'sharp';
import * as fontkitLib from 'fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { ArtTemplate, TextLineLayer, TextBlockLayer, ImageLayer } from '../types/art-template';

const fontkit = fontkitLib as any;

const ASSETS_DIR = path.resolve(__dirname, 'assets');

const fontCache = new Map<string, any>();
function loadFont(file: string): any {
  if (fontCache.has(file)) return fontCache.get(file)!;
  const fullPath = path.join(ASSETS_DIR, 'fonts', file);
  if (!fs.existsSync(fullPath)) throw new Error(`Fonte não encontrada: ${fullPath}`);
  const font = fontkit.openSync(fullPath);
  fontCache.set(file, font);
  return font;
}

const FONT_FILES: Record<string, string> = {
  'Taviraj Light':           'Taviraj-Light.woff2',
  'Nunito Sans Light':       'NunitoSans-Light.woff2',
  'Ivy Journal Light':       'IvyJournal-Light.ttf',
  'Roobert PRO TRIAL Light': 'RoobertPROTRIAL-Light.otf',
};

function getFont(family: string): any {
  const file = FONT_FILES[family];
  if (!file) throw new Error(`Fonte desconhecida: ${family}`);
  return loadFont(file);
}

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
  return fs.promises.readFile(url.startsWith('/') ? url : path.join(ASSETS_DIR, url));
}

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

function substitute(text: string, data: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
}

async function renderTextLine(
  layer: TextLineLayer,
  data: Record<string, string>,
  composites: sharp.OverlayOptions[]
) {
  const text = substitute(layer.content, data);
  if (!text.trim()) return;
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

  // Pre-calculate wrapped lines for vertical alignment
  const wrappedParagraphs: string[][] = paragraphs.map(p =>
    wrapTextToLines(font, p, layer.font_size, layer.w)
  );
  const totalLineCount = wrappedParagraphs.reduce(
    (sum, lines) => sum + lines.filter(l => l.trim()).length, 0
  );
  const contentHeight = totalLineCount * layer.line_height
    + Math.max(0, paragraphs.length - 1) * (layer.paragraph_spacing || 0);

  let yCursor = layer.y;
  if (layer.vertical_align === 'middle') {
    yCursor = layer.y + (layer.h - contentHeight) / 2;
  } else if (layer.vertical_align === 'bottom') {
    yCursor = layer.y + layer.h - contentHeight;
  }

  for (let p = 0; p < wrappedParagraphs.length; p++) {
    const lines = wrappedParagraphs[p];
    for (const line of lines) {
      if (!line.trim()) continue;
      const { buffer, width } = await renderTextBuffer(font, line, layer.font_size, layer.color);
      composites.push({
        input: buffer,
        top: topForText(font, layer.font_size, yCursor),
        left: alignedLeft(layer.x, layer.w, width, layer.align),
      });
      yCursor += layer.line_height;
    }
    if (p < wrappedParagraphs.length - 1) {
      yCursor += layer.paragraph_spacing || 0;
    }
  }
}

async function renderImage(
  layer: ImageLayer,
  data: Record<string, string>,
  composites: sharp.OverlayOptions[],
  bgWidth: number,
  bgHeight: number
) {
  let url: string;
  if (layer.source.type === 'static') {
    url = layer.source.url;
  } else {
    const variantKey = data[layer.source.variant_source];
    url = layer.source.variants[variantKey] ?? '';
    if (!url) return;
  }
  if (!url) return;

  const raw = await getRemoteAsset(url);

  let input: Buffer;
  if (layer.w > 0 && layer.h > 0) {
    const safeW = Math.min(layer.w, bgWidth - layer.x);
    const safeH = Math.min(layer.h, bgHeight - layer.y);
    if (safeW !== layer.w || safeH !== layer.h) {
      console.warn(`[render] image ${layer.id} dimensions capped: ${layer.w}x${layer.h} → ${safeW}x${safeH} (bg=${bgWidth}x${bgHeight})`);
    }
    if (safeW <= 0 || safeH <= 0) {
      console.warn(`[render] image ${layer.id} skipped: zero or negative safe dimensions`);
      return;
    }
    input = await sharp(raw)
      .resize(safeW, safeH, { fit: layer.resize_mode ?? 'contain' })
      .toBuffer();
  } else {
    const meta = await sharp(raw).metadata();
    const rawW = meta.width ?? 0;
    const rawH = meta.height ?? 0;
    if (rawW > bgWidth || rawH > bgHeight) {
      console.warn(`[render] image ${layer.id} (no explicit size) exceeds bg: ${rawW}x${rawH} > ${bgWidth}x${bgHeight}, resizing`);
      input = await sharp(raw)
        .resize(Math.min(rawW, bgWidth), Math.min(rawH, bgHeight), { fit: 'inside' })
        .toBuffer();
    } else {
      input = raw;
    }
  }

  const composite: sharp.OverlayOptions = {
    input,
    top: layer.y,
    left: layer.x,
  };
  if (layer.blend_mode && layer.blend_mode !== 'normal') {
    composite.blend = layer.blend_mode as any;
  }
  composites.push(composite);
}

export async function renderFromTemplate(
  template: ArtTemplate,
  data: Record<string, any>
): Promise<Buffer> {
  const dataStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    dataStr[k] = String(v ?? '');
  }

  let bgUrl: string;
  if (template.bg.type === 'static') {
    bgUrl = template.bg.url;
  } else {
    const variantKey = dataStr[template.bg.variant_source];
    bgUrl = template.bg.variants[variantKey];
    if (!bgUrl) throw new Error(`Variante de bg não encontrada: ${variantKey}`);
  }
  const bgRaw = await getRemoteAsset(bgUrl);

  const canvasW = template.canvas.width;
  const canvasH = template.canvas.height;

  // Normalizar bg para as dimensões exatas do canvas.
  // Isso evita o erro "Image to composite must have same dimensions or smaller"
  // quando a imagem remota retorna com dimensões diferentes do esperado.
  const bgMeta = await sharp(bgRaw).metadata();
  console.log(`[render] tipo=${template.tipo} bg_raw=${bgMeta.width}x${bgMeta.height} canvas=${canvasW}x${canvasH}`);

  let bgBuf: Buffer;
  if (bgMeta.width === canvasW && bgMeta.height === canvasH) {
    bgBuf = bgRaw;
  } else {
    console.warn(`[render] bg dimensions mismatch — resizing ${bgMeta.width}x${bgMeta.height} → ${canvasW}x${canvasH}`);
    bgBuf = await sharp(bgRaw)
      .resize(canvasW, canvasH, { fit: 'fill' })
      .toBuffer();
  }

  const composites: sharp.OverlayOptions[] = [];
  for (const layer of template.layers) {
    if (layer.type === 'text-line')  await renderTextLine(layer, dataStr, composites);
    if (layer.type === 'text-block') await renderTextBlock(layer, dataStr, composites);
    if (layer.type === 'image')      await renderImage(layer, dataStr, composites, canvasW, canvasH);
  }

  // Log de diagnóstico de cada composite antes de montar
  for (let i = 0; i < composites.length; i++) {
    const c = composites[i];
    if (Buffer.isBuffer(c.input)) {
      const m = await sharp(c.input).metadata();
      console.log(`[render] composite[${i}]: ${m.width}x${m.height} @ (left=${c.left}, top=${c.top})`);
    }
  }

  return sharp(bgBuf).composite(composites).png().toBuffer();
}
