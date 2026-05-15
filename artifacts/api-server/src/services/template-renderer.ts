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

  let yCursor = layer.y;
  for (let p = 0; p < paragraphs.length; p++) {
    const lines = wrapTextToLines(font, paragraphs[p], layer.font_size, layer.w);
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
    input = await sharp(raw)
      .resize(layer.w, layer.h, { fit: layer.resize_mode ?? 'contain' })
      .toBuffer();
  } else {
    input = raw;
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
  const bgBuf = await getRemoteAsset(bgUrl);

  const composites: sharp.OverlayOptions[] = [];
  for (const layer of template.layers) {
    if (layer.type === 'text-line')  await renderTextLine(layer, dataStr, composites);
    if (layer.type === 'text-block') await renderTextBlock(layer, dataStr, composites);
    if (layer.type === 'image')      await renderImage(layer, dataStr, composites);
  }

  return sharp(bgBuf).composite(composites).png().toBuffer();
}
