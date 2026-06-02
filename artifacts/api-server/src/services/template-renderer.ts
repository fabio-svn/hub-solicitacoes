import sharp from 'sharp';
import * as fontkitLib from 'fontkit';
import * as fs from 'fs';
import * as path from 'path';
import { ArtTemplate, TextLineLayer, TextBlockLayer, ImageLayer, ShapeLayer } from '../types/art-template';
import { logger } from '../lib/logger';
import { CONTRATOS_OPTS, MARCAS_OPTS } from '../config/form-schemas';

const fontkit = fontkitLib as any;

const ASSETS_DIR = path.resolve(__dirname, 'assets');

const CONTRATO_LABELS: Record<string, string> = Object.fromEntries(
  CONTRATOS_OPTS.map(c => [c.value, c.label])
);

const MARCA_LABELS: Record<string, string> = Object.fromEntries(
  MARCAS_OPTS.map(m => [m.value, m.label])
);

function enrichDataWithLabels(data: Record<string, any>): Record<string, any> {
  const enriched = { ...data };

  if (typeof data.contrato_social === 'string' && data.contrato_social) {
    enriched.contrato_label = CONTRATO_LABELS[data.contrato_social] ?? data.contrato_social;
  }

  if (typeof data.marca === 'string' && data.marca && !data.marca_label) {
    enriched.marca_label = MARCA_LABELS[data.marca] ?? data.marca;
  }

  return enriched;
}

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

for (const file of Object.values(FONT_FILES)) {
  try { loadFont(file); } catch (err) { logger.warn({ file, err }, 'render: falha ao pré-carregar fonte'); }
}

function getFont(family: string): any {
  const file = FONT_FILES[family];
  if (!file) throw new Error(`Fonte desconhecida: ${family}`);
  return loadFont(file);
}

class BoundedCache<K, V> {
  private _map = new Map<K, V>();
  constructor(private readonly _max: number) {}
  get(key: K): V | undefined { return this._map.get(key); }
  set(key: K, value: V): void {
    if (this._map.has(key)) this._map.delete(key);
    else if (this._map.size >= this._max) this._map.delete(this._map.keys().next().value!);
    this._map.set(key, value);
  }
}

const DEBUG_RENDER = process.env.DEBUG_RENDER === '1';
const assetCache = new BoundedCache<string, Buffer>(100);

async function getRemoteAsset(url: string): Promise<Buffer> {
  if (!url || url.trim() === '') throw new Error('URL de asset vazia');
  if (url.startsWith('http')) {
    const cached = assetCache.get(url);
    if (cached) {
      if (DEBUG_RENDER) logger.info({ url }, 'render: asset cache hit');
      return cached;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (DEBUG_RENDER) logger.info({ url }, 'render: asset cache miss');
    assetCache.set(url, buf);
    return buf;
  }
  const fullPath = url.startsWith('/') ? url : path.join(ASSETS_DIR, url);
  const stats = await fs.promises.stat(fullPath).catch(() => null);
  if (!stats) throw new Error(`Asset não encontrado: ${fullPath}`);
  if (stats.isDirectory()) throw new Error(`Path é diretório, não arquivo: ${fullPath}`);
  return fs.promises.readFile(fullPath);
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

function substitute(
  text: string,
  data: Record<string, string>,
  ctx?: { tipo?: string; layoutId?: string | number }
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    if (val !== undefined && val !== null && val !== '') return val;
    logger.warn({ tipo: ctx?.tipo, key, layoutId: ctx?.layoutId }, 'placeholder sem valor');
    return process.env.DEBUG_PLACEHOLDERS === '1' ? `{{${key}}}` : '';
  });
}

async function renderTextLine(
  layer: TextLineLayer,
  data: Record<string, string>,
  composites: sharp.OverlayOptions[],
  ctx?: { tipo?: string; layoutId?: string | number }
) {
  const text = substitute(layer.content, data, ctx);
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
  composites: sharp.OverlayOptions[],
  ctx?: { tipo?: string; layoutId?: string | number }
) {
  const text = substitute(layer.content, data, ctx);
  const font = getFont(layer.font_family);

  // Split by \n: each newline is a forced line break; empty string = blank spacer
  const userLines = text.split('\n');
  const allLines: string[] = [];
  for (const userLine of userLines) {
    if (userLine === '') {
      allLines.push(''); // blank spacer — advances yCursor by one lineHeight
    } else {
      const wrapped = wrapTextToLines(font, userLine, layer.font_size, layer.w);
      allLines.push(...wrapped);
    }
  }

  const contentHeight = allLines.length * layer.line_height;

  let yCursor = layer.y;
  if (layer.vertical_align === 'middle') {
    yCursor = layer.y + (layer.h - contentHeight) / 2;
  } else if (layer.vertical_align === 'bottom') {
    yCursor = layer.y + layer.h - contentHeight;
  }

  for (const line of allLines) {
    if (line !== '') {
      const { buffer, width } = await renderTextBuffer(font, line, layer.font_size, layer.color);
      composites.push({
        input: buffer,
        top: topForText(font, layer.font_size, yCursor),
        left: alignedLeft(layer.x, layer.w, width, layer.align),
      });
    }
    yCursor += layer.line_height;
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
  } else if (layer.source.type === 'placeholder') {
    url = data[layer.source.field] || '';
    if (!url) return;
  } else {
    const src = layer.source as { type: 'variant'; variants: Record<string, string>; variant_source: string };
    const variantKey = data[src.variant_source];
    if (!variantKey) {
      logger.warn(
        `[render] image layer "${layer.id}": variant_source="${src.variant_source}" não encontrado nos dados` +
        ` (chaves disponíveis: ${Object.keys(data).join(', ')})`
      );
      return;
    }
    url = src.variants[variantKey] ?? '';
    if (!url) {
      logger.warn(
        `[render] image layer "${layer.id}": nenhuma URL para variant_key="${variantKey}"` +
        ` (variants disponíveis: ${Object.keys(src.variants).join(', ')})`
      );
      return;
    }
  }
  if (!url) return;

  const raw = await getRemoteAsset(url);
  const isCircle = layer.shape === 'circle';

  let safeW: number;
  let safeH: number;
  let input: Buffer;

  if (layer.w > 0 && layer.h > 0) {
    safeW = Math.min(layer.w, bgWidth - layer.x);
    safeH = Math.min(layer.h, bgHeight - layer.y);
    if (safeW !== layer.w || safeH !== layer.h) {
      logger.warn(`[render] image ${layer.id} dimensions capped: ${layer.w}x${layer.h} → ${safeW}x${safeH} (bg=${bgWidth}x${bgHeight})`);
    }
    if (safeW <= 0 || safeH <= 0) {
      logger.warn(`[render] image ${layer.id} skipped: zero or negative safe dimensions`);
      return;
    }
    const fitMode = isCircle ? 'cover' : (layer.resize_mode ?? 'contain');
    input = await sharp(raw)
      .resize(safeW, safeH, { fit: fitMode, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();
  } else {
    const meta = await sharp(raw).metadata();
    const rawW = meta.width ?? 0;
    const rawH = meta.height ?? 0;
    if (rawW > bgWidth || rawH > bgHeight) {
      logger.warn(`[render] image ${layer.id} (no explicit size) exceeds bg: ${rawW}x${rawH} > ${bgWidth}x${bgHeight}, resizing`);
      input = await sharp(raw)
        .resize(Math.min(rawW, bgWidth), Math.min(rawH, bgHeight), { fit: 'inside' })
        .toBuffer();
    } else {
      input = raw;
    }
    safeW = rawW;
    safeH = rawH;
  }

  if (isCircle) {
    const size = Math.min(safeW, safeH);
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>` +
      `</svg>`
    );
    input = await sharp(input)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    safeW = size;
    safeH = size;
  }

  const composite: sharp.OverlayOptions = {
    input,
    top: layer.y,
    left: layer.x,
  };
  if (layer.blend_mode && layer.blend_mode !== 'normal') {
    composite.blend = layer.blend_mode as sharp.Blend;
  }
  composites.push(composite);

  const border = layer.border;
  if (border && border.width > 0) {
    const hw = border.width / 2;
    const borderSvg = isCircle
      ? `<svg width="${safeW}" height="${safeH}" xmlns="http://www.w3.org/2000/svg"><circle cx="${safeW / 2}" cy="${safeH / 2}" r="${safeW / 2 - hw}" fill="none" stroke="${border.color}" stroke-width="${border.width}"/></svg>`
      : `<svg width="${safeW}" height="${safeH}" xmlns="http://www.w3.org/2000/svg"><rect x="${hw}" y="${hw}" width="${safeW - border.width}" height="${safeH - border.width}" fill="none" stroke="${border.color}" stroke-width="${border.width}"/></svg>`;
    composites.push({ input: Buffer.from(borderSvg), left: layer.x, top: layer.y });
  }
}

async function renderShape(
  layer: ShapeLayer,
  composites: sharp.OverlayOptions[],
  bgWidth: number,
  bgHeight: number,
) {
  if (layer.w <= 0 || layer.h <= 0) {
    logger.warn(`[render] shape ${layer.id} skipped: zero/negative dimensions`);
    return;
  }

  const safeW = Math.min(layer.w, bgWidth - layer.x);
  const safeH = Math.min(layer.h, bgHeight - layer.y);
  if (safeW <= 0 || safeH <= 0) return;

  const fill = layer.fill || 'none';
  const stroke = layer.stroke || 'none';
  const strokeWidth = layer.stroke_width || 0;
  const inset = strokeWidth / 2;

  let shapeEl: string;
  if (layer.shape === 'ellipse') {
    const cx = safeW / 2;
    const cy = safeH / 2;
    const rx = Math.max(0, (safeW / 2) - inset);
    const ry = Math.max(0, (safeH / 2) - inset);
    shapeEl = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  } else {
    const x = inset;
    const y = inset;
    const w = Math.max(0, safeW - strokeWidth);
    const h = Math.max(0, safeH - strokeWidth);
    const rx = Math.min(layer.border_radius || 0, w / 2, h / 2);
    shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }

  const svg = `<svg width="${safeW}" height="${safeH}" xmlns="http://www.w3.org/2000/svg">${shapeEl}</svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

  composites.push({
    input: buffer,
    left: Math.round(layer.x),
    top: Math.round(layer.y),
  });
}

export async function renderFromTemplate(
  template: ArtTemplate,
  dataRaw: Record<string, any>
): Promise<Buffer> {
  const data = enrichDataWithLabels(dataRaw);
  const dataStr: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    dataStr[k] = String(v ?? '');
  }

  const canvasW = template.canvas.width;
  const canvasH = template.canvas.height;

  // ── Background ────────────────────────────────────────────────
  let bgBuf: Buffer;
  try {
    let bgUrl: string;
    if (template.bg.type === 'static') {
      bgUrl = template.bg.url;
    } else {
      const variantKey = dataStr[template.bg.variant_source];
      bgUrl = template.bg.variants?.[variantKey] ?? '';
      if (!bgUrl) throw new Error(`Variante de bg não encontrada: ${variantKey}`);
    }
    const bgRaw = await getRemoteAsset(bgUrl);
    const bgMeta = await sharp(bgRaw).metadata();
    logger.info(`[render] tipo=${template.tipo} bg_raw=${bgMeta.width}x${bgMeta.height} canvas=${canvasW}x${canvasH}`);
    if (bgMeta.width === canvasW && bgMeta.height === canvasH) {
      bgBuf = bgRaw;
    } else {
      logger.warn(`[render] bg dimensions mismatch — resizing ${bgMeta.width}x${bgMeta.height} → ${canvasW}x${canvasH}`);
      bgBuf = await sharp(bgRaw).resize(canvasW, canvasH, { fit: 'fill' }).toBuffer();
    }
  } catch (err: any) {
    logger.warn(`[render] bg inválido (${err.message}), usando placeholder cinza`);
    bgBuf = await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 64, g: 64, b: 68, alpha: 1 } },
    }).png().toBuffer();
  }

  // ── Layers ────────────────────────────────────────────────────
  const composites: sharp.OverlayOptions[] = [];
  const t0 = DEBUG_RENDER ? Date.now() : 0;
  const renderCtx = { tipo: template.tipo, layoutId: template.id };
  // Ordem do composite: último do array = fundo, primeiro = frente.
  // Convenção: índice 0 = layer mais à frente (alinhado com z-index do frontend).
  for (const layer of [...template.layers].reverse()) {
    try {
      if (layer.type === 'text-line')  await renderTextLine(layer, dataStr, composites, renderCtx);
      if (layer.type === 'text-block') await renderTextBlock(layer, dataStr, composites, renderCtx);
      if (layer.type === 'image')      await renderImage(layer, dataStr, composites, canvasW, canvasH);
      if (layer.type === 'shape')      await renderShape(layer as ShapeLayer, composites, canvasW, canvasH);
    } catch (err: any) {
      logger.warn(`[render] layer "${layer.id}" ignorada (${err.message})`);
    }
  }

  if (DEBUG_RENDER) {
    for (let i = 0; i < composites.length; i++) {
      const c = composites[i];
      if (Buffer.isBuffer(c.input)) {
        const m = await sharp(c.input).metadata();
        logger.info(`[render] composite[${i}]: ${m.width}x${m.height} @ (left=${c.left}, top=${c.top})`);
      }
    }
  }

  const result = await sharp(bgBuf).composite(composites).png().toBuffer();
  if (DEBUG_RENDER) logger.info({ tipo: template.tipo, layoutId: template.id, ms: Date.now() - t0 }, 'render: concluído');
  return result;
}
