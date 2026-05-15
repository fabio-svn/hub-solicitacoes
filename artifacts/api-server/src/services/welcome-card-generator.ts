import sharp from 'sharp';
import * as fontkitLib from 'fontkit';
import * as fs from 'fs';
import * as path from 'path';

const fontkit = fontkitLib as any;

const ASSETS_DIR = path.resolve(__dirname, 'assets');

let _fontDisplay: any = null;
let _fontBody: any = null;

function getFontDisplay(): any {
  if (!_fontDisplay) _fontDisplay = fontkit.openSync(path.join(ASSETS_DIR, 'fonts/Taviraj-Light.woff2'));
  return _fontDisplay;
}

function getFontBody(): any {
  if (!_fontBody) _fontBody = fontkit.openSync(path.join(ASSETS_DIR, 'fonts/NunitoSans-Light.woff2'));
  return _fontBody;
}

// ── Layout (coordinates, sizes, colors) ─────────────────────────────────────
const LAYOUT = {
  nomeCliente:    { x: 338, y: 188,  w: 764, fontSize: 70, color: '#FFF8F3' },
  fraseInicial:   { x: 296, y: 278,  w: 848, fontSize: 40, color: '#FFF8F3' },
  mensagem:       { x: 297, y: 528,  w: 847, fontSize: 37, lineHeight: 50, paragraphSpacing: 25, color: '#221B19' },
  fraseBoasVindas:{ x: 297, y: 1169, w: 847, fontSize: 35, color: '#221B19' },
  nomeAssinatura: { x: 349, y: 1281, w: 743, fontSize: 40, color: '#FFF8F3' },
  unidade:        { x: 349, y: 1346, w: 743, fontSize: 40, color: '#FFF8F3' },
  logo:           { x: 419, y: 1585, w: 603, h: 62 },
};

// ── Conteúdo pré-definido ────────────────────────────────────────────────────
const FRASE_INICIAL = 'Que privilégio ter você conosco na SVN!';

const PARAGRAFO_1 = 'Acreditamos que cada cliente é único e estamos dedicados a entender suas necessidades, fornecendo a assessoria necessária para maximizar seus resultados financeiros. Nossa equipe de especialistas está sempre à disposição para oferecer consultoria de qualidade, análise de mercado e estratégias de investimento sob medida.';

const PARAGRAFO_2_TEMPLATE = (l: string) =>
  `Na ${l}, nossa missão é proporcionar as melhores soluções financeiras e orientações personalizadas para alcançar seus objetivos de investimento. Nosso compromisso é com a transparência, a confiança e a excelência no atendimento.`;

const PARAGRAFO_3 = 'Estamos animados para iniciar esta jornada com você!';

const FRASE_BOAS_VINDAS_TEMPLATE = (l: string) => `Bem-vindo(a) à ${l}.`;

// ── Assets remotos ───────────────────────────────────────────────────────────
const ASSETS_BASE = 'https://solicitacoes.portalsvn.com.br/assinatura_email';

const LOGO_URLS: Record<string, string> = {
  'svn-investimentos': `${ASSETS_BASE}/assinaturas_assinatura_svn.png`,
  'svn-capital':       `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_capital.png`,
  'svn-connect':       `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_connect.png`,
};

const CONTRATO_LABELS: Record<string, string> = {
  'svn-investimentos': 'SVN Investimentos',
  'svn-capital':       'SVN Capital',
  'svn-connect':       'SVN Connect',
};

const assetCache = new Map<string, Buffer>();
async function getRemoteAsset(url: string): Promise<Buffer> {
  const cached = assetCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  assetCache.set(url, buf);
  return buf;
}

// ── Utilitários de texto ─────────────────────────────────────────────────────
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

async function renderTextBuffer(
  font: any, text: string, fontSize: number, fill: string
): Promise<{ buffer: Buffer; width: number }> {
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  const ascent = font.ascent * scale;
  const descent = Math.abs(font.descent) * scale;
  const baselineY = Math.ceil(ascent);
  const svgHeight = Math.ceil(ascent + descent);

  let x = 0;
  const paths: string[] = [];
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i];
    const pos = run.positions[i];
    const d = glyph.path.toSVG();
    if (d) {
      const tx = (x + pos.xOffset) * scale;
      const ty = baselineY + pos.yOffset * scale;
      paths.push(`<path d="${d}" transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(5)},-${scale.toFixed(5)})" fill="${fill}"/>`);
    }
    x += pos.xAdvance;
  }

  const totalWidth = Math.ceil(x * scale) + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${svgHeight}">${paths.join('')}</svg>`;
  return { buffer: await sharp(Buffer.from(svg)).png().toBuffer(), width: totalWidth };
}

function topForText(font: any, fontSize: number, yTop: number): number {
  const scale = fontSize / font.unitsPerEm;
  const capHeight = (font.capHeight || font.ascent * 0.7) * scale;
  const ascentPx = font.ascent * scale;
  return Math.round(yTop - (ascentPx - capHeight));
}

async function compositeCenteredLine(
  composites: sharp.OverlayOptions[],
  cfg: { x: number; y: number; w: number; fontSize: number; color: string },
  font: any,
  text: string
) {
  const { buffer, width } = await renderTextBuffer(font, text, cfg.fontSize, cfg.color);
  const left = Math.round(cfg.x + (cfg.w - width) / 2);
  const top = topForText(font, cfg.fontSize, cfg.y);
  composites.push({ input: buffer, top, left });
}

async function compositeMultilineCentered(
  composites: sharp.OverlayOptions[],
  cfg: { x: number; y: number; w: number; fontSize: number; lineHeight: number; paragraphSpacing: number; color: string },
  font: any,
  text: string
) {
  const paragraphs = text.split(/\n\n+/);
  let yCursor = cfg.y;
  for (let p = 0; p < paragraphs.length; p++) {
    const lines = wrapTextToLines(font, paragraphs[p], cfg.fontSize, cfg.w);
    for (const line of lines) {
      const { buffer, width } = await renderTextBuffer(font, line, cfg.fontSize, cfg.color);
      const left = Math.round(cfg.x + (cfg.w - width) / 2);
      const top = topForText(font, cfg.fontSize, yCursor);
      composites.push({ input: buffer, top, left });
      yCursor += cfg.lineHeight;
    }
    if (p < paragraphs.length - 1) yCursor += cfg.paragraphSpacing;
  }
}

// ── API pública ──────────────────────────────────────────────────────────────
export interface CartaoBoasVindasInput {
  nomeCliente: string;
  nomeAssinatura: string;
  unidade: string;
  contratoSocial: 'svn-investimentos' | 'svn-capital' | 'svn-connect';
  isPrivate: boolean;
}

export async function gerarCartaoBoasVindas(input: CartaoBoasVindasInput): Promise<Buffer> {
  const contratoLabel = CONTRATO_LABELS[input.contratoSocial];
  if (!contratoLabel) throw new Error(`Contrato social inválido: ${input.contratoSocial}`);

  const fd = getFontDisplay();
  const fb = getFontBody();

  const bgFile = input.isPrivate ? 'bg-welcome-private.png' : 'bg-welcome-padrao.png';
  const bgPath = path.join(ASSETS_DIR, 'cartao_boas_vindas', bgFile);
  if (!fs.existsSync(bgPath)) throw new Error(`Background não encontrado: ${bgPath}`);

  const logoRaw = await getRemoteAsset(LOGO_URLS[input.contratoSocial]);
  const logoBuf = await sharp(logoRaw)
    .resize(LAYOUT.logo.w, LAYOUT.logo.h, { fit: 'contain' })
    .toBuffer();

  const mensagemFinal = [PARAGRAFO_1, PARAGRAFO_2_TEMPLATE(contratoLabel), PARAGRAFO_3].join('\n\n');

  const composites: sharp.OverlayOptions[] = [];

  await compositeCenteredLine(composites, LAYOUT.nomeCliente,     fd, input.nomeCliente);
  await compositeCenteredLine(composites, LAYOUT.fraseInicial,    fd, FRASE_INICIAL);
  await compositeMultilineCentered(composites, LAYOUT.mensagem,   fb, mensagemFinal);
  await compositeCenteredLine(composites, LAYOUT.fraseBoasVindas, fb, FRASE_BOAS_VINDAS_TEMPLATE(contratoLabel));
  await compositeCenteredLine(composites, LAYOUT.nomeAssinatura,  fd, input.nomeAssinatura);
  await compositeCenteredLine(composites, LAYOUT.unidade,         fd, input.unidade);

  composites.push({ input: logoBuf, top: LAYOUT.logo.y, left: LAYOUT.logo.x, blend: 'screen' });

  return await sharp(bgPath).composite(composites).png().toBuffer();
}
