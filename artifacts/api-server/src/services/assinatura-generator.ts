import * as fontkitLib from "fontkit";
import * as fs from "fs";
import * as path from "path";

const fontkit = fontkitLib as any;

const ASSETS_DIR = path.resolve(__dirname, "assets");
const FONT_DISPLAY_PATH = path.join(ASSETS_DIR, "fonts", "IvyJournal-Light.ttf");
const FONT_BODY_PATH    = path.join(ASSETS_DIR, "fonts", "RoobertPROTRIAL-Light.otf");

let fontDisplay: any = null;
let fontBody: any = null;

function getFontDisplay(): any {
  if (!fontDisplay) {
    if (!fs.existsSync(FONT_DISPLAY_PATH)) throw new Error(`Fonte não encontrada: ${FONT_DISPLAY_PATH}`);
    fontDisplay = fontkit.openSync(FONT_DISPLAY_PATH);
  }
  return fontDisplay;
}

function getFontBody(): any {
  if (!fontBody) {
    if (!fs.existsSync(FONT_BODY_PATH)) throw new Error(`Fonte não encontrada: ${FONT_BODY_PATH}`);
    fontBody = fontkit.openSync(FONT_BODY_PATH);
  }
  return fontBody;
}

// ── Asset URLs ─────────────────────────────────────────────────────────────
const ASSETS_BASE = "https://solicitacoes.portalsvn.com.br/assinatura_email";

const SHARED_URLS = {
  bg:    `${ASSETS_BASE}/bg_assinatura.png`,
  linha: `${ASSETS_BASE}/assinatura_linha.png`,
  selos: `${ASSETS_BASE}/assinatura_selos.png`,
  cfp:   `${ASSETS_BASE}/assinatura_selo_cfp.png`,
};

const LOGO_URLS: Record<string, string> = {
  "svn-investimentos":           `${ASSETS_BASE}/assinaturas_assinatura_svn.png`,
  "svn-capital":                 `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_capital.png`,
  "svn-connect":                 `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_connect.png`,
  "svn-gestao":                  `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_gestao.png`,
  "svn-global":                  `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_global.png`,
  "svn-imb":                     `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_imb.png`,
  "svn-agro-cambio-commodities": `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_agro_cambio_commodities.png`,
  "svn-protecao-patrimonial":    `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_protecaopatrimonial.png`,
  "svn-wealth-planning":         `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_wealthplanning.png`,
};

// Marcas que exibem campo "cargo" na assinatura
const MARCAS_COM_CARGO = new Set([
  "svn-gestao",
  "svn-global",
  "svn-imb",
  "svn-agro-cambio-commodities",
  "svn-protecao-patrimonial",
  "svn-wealth-planning",
]);

// Cache em memória (vida útil = vida do processo)
const assetCache = new Map<string, Buffer>();

async function getAsset(url: string): Promise<Buffer> {
  const cached = assetCache.get(url);
  if (cached) return cached;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Falha ao buscar asset ${url}: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  assetCache.set(url, buf);
  return buf;
}

// ── Layout — sem cargo (padrão) ──────────────────────────────────────────────
const LAYOUT = {
  canvas: { w: 4078, h: 988 },
  logo:   { x: 284,  y: 444 },
  linha:  { x: 1756, y: 341 },
  nome:   { x: 2007, y_top: 240 },
  tel:    { x: 2005, y_top: 447 },
  email:  { x: 2005, y_top: 562 },
  cfp:    { x: 2007, y: 676 },
  selos:  { x: 3400, y: 240 },
};

// ── Layout — com cargo (6 marcas) ────────────────────────────────────────────
const LAYOUT_COM_CARGO = {
  canvas: { w: 4078, h: 988 },
  logo:   { x: 284,  y: 444 },
  linha:  { x: 1756, y: 341 },
  nome:   { x: 2007, y_top: 210 },
  cargo:  { x: 2007, y_top: 345 },
  tel:    { x: 2005, y_top: 447 },
  email:  { x: 2005, y_top: 562 },
  cfp:    { x: 2007, y: 676 },
  selos:  { x: 3400, y: 240 },
};

const FONT_SIZES = {
  nome_default:  149,
  nome_min:       90,
  cargo:          64,
  tel:            64,
  email_default:  64,
  email_min:      42,
};

const SAFE_AREA_W = LAYOUT.selos.x - LAYOUT.nome.x - 20;
const TEXT_FILL   = "#FFF8F3";

function measureTextWidth(font: any, text: string, fontSize: number): number {
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  return run.positions.reduce((sum: number, p: any) => sum + p.xAdvance, 0) * scale;
}

interface FitResult {
  size: number;
  width: number;
  scaled: boolean;
  belowFloor: boolean;
}

function autoFit(font: any, text: string, defaultSize: number, minSize: number, maxWidth: number): FitResult {
  const naturalWidth = measureTextWidth(font, text, defaultSize);
  if (naturalWidth <= maxWidth) {
    return { size: defaultSize, width: naturalWidth, scaled: false, belowFloor: false };
  }
  const scaledSize = Math.floor(defaultSize * (maxWidth / naturalWidth));
  return {
    size: scaledSize,
    width: measureTextWidth(font, text, scaledSize),
    scaled: true,
    belowFloor: scaledSize < minSize,
  };
}

async function renderText(font: any, text: string, fontSize: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  const ascent   = font.ascent * scale;
  const descent  = Math.abs(font.descent) * scale;
  const baseline = Math.ceil(ascent);
  const svgH     = Math.ceil(ascent + descent);

  let x = 0;
  const paths: string[] = [];
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i];
    const pos   = run.positions[i];
    const d     = glyph.path.toSVG();
    if (d) {
      const tx = (x + pos.xOffset) * scale;
      const ty = baseline + pos.yOffset * scale;
      paths.push(
        `<path d="${d}" transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(5)},-${scale.toFixed(5)})" fill="${TEXT_FILL}"/>`
      );
    }
    x += pos.xAdvance;
  }

  const totalW = Math.ceil(x * scale) + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${svgH}">${paths.join("")}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function topForText(font: any, fontSize: number, yTop: number): number {
  const scale     = fontSize / font.unitsPerEm;
  const capHeight = (font.capHeight || font.ascent * 0.7) * scale;
  const ascentPx  = font.ascent * scale;
  return Math.round(yTop - (ascentPx - capHeight));
}

export interface AssinaturaInput {
  nome: string;
  telefone: string;
  email: string;
  cargo?: string;
  temCFP?: boolean;
  marca?: string;
}

export interface AssinaturaResult {
  pngBuffer: Buffer;
  fitNome: FitResult;
  fitEmail: FitResult;
}

export async function gerarAssinatura(input: AssinaturaInput): Promise<AssinaturaResult> {
  const sharp    = (await import("sharp")).default;
  const fdisplay = getFontDisplay();
  const fbody    = getFontBody();
  const marca    = input.marca ?? "svn-investimentos";
  const temCargo = MARCAS_COM_CARGO.has(marca) && !!input.cargo?.trim();
  const layout   = temCargo ? LAYOUT_COM_CARGO : LAYOUT;

  const logoUrl = LOGO_URLS[marca];
  if (!logoUrl) {
    throw new Error(`Marca desconhecida: ${marca}`);
  }

  const fitNome  = autoFit(fdisplay, input.nome,  FONT_SIZES.nome_default,  FONT_SIZES.nome_min,  SAFE_AREA_W);
  const fitEmail = autoFit(fbody,    input.email, FONT_SIZES.email_default, FONT_SIZES.email_min, SAFE_AREA_W);

  const cargoText = (temCargo ? input.cargo! : "").trim();

  const [bgBuf, logoBuf, linhaBuf, selosBuf, nomeBuf, cargoBuf, telBuf, emailBuf, cfpBuf] = await Promise.all([
    getAsset(SHARED_URLS.bg),
    getAsset(logoUrl),
    getAsset(SHARED_URLS.linha),
    getAsset(SHARED_URLS.selos),
    renderText(fdisplay, input.nome,     fitNome.size),
    temCargo ? renderText(fbody, cargoText, FONT_SIZES.cargo) : Promise.resolve(null as Buffer | null),
    renderText(fbody,    input.telefone, FONT_SIZES.tel),
    renderText(fbody,    input.email,    fitEmail.size),
    input.temCFP ? getAsset(SHARED_URLS.cfp) : Promise.resolve(null as Buffer | null),
  ]);

  const composites: import("sharp").OverlayOptions[] = [
    { input: logoBuf,  top: layout.logo.y,  left: layout.logo.x,  blend: "screen" },
    { input: linhaBuf, top: layout.linha.y, left: layout.linha.x, blend: "screen" },
    { input: nomeBuf,  top: topForText(fdisplay, fitNome.size,   layout.nome.y_top),  left: layout.nome.x  },
    { input: telBuf,   top: topForText(fbody,    FONT_SIZES.tel,  layout.tel.y_top),  left: layout.tel.x   },
    { input: emailBuf, top: topForText(fbody,    fitEmail.size,   layout.email.y_top), left: layout.email.x },
    { input: selosBuf, top: layout.selos.y, left: layout.selos.x, blend: "screen" },
  ];

  if (temCargo && cargoBuf) {
    composites.push({
      input: cargoBuf,
      top: topForText(fbody, FONT_SIZES.cargo, (layout as typeof LAYOUT_COM_CARGO).cargo.y_top),
      left: layout.nome.x,
    });
  }

  if (input.temCFP && cfpBuf) {
    composites.push({ input: cfpBuf, top: layout.cfp.y, left: layout.cfp.x, blend: "screen" });
  }

  const pngBuffer = await sharp(bgBuf)
    .composite(composites)
    .png()
    .toBuffer();

  return { pngBuffer, fitNome, fitEmail };
}
