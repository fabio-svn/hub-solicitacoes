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

const FONT_SIZES = {
  nome_default:  149,
  nome_min:       90,
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
  temCFP?: boolean;
  marca?: "svn-investimentos";
}

export interface AssinaturaResult {
  pngBuffer: Buffer;
  fitNome: FitResult;
  fitEmail: FitResult;
}

export async function gerarAssinatura(input: AssinaturaInput): Promise<AssinaturaResult> {
  const sharp  = (await import("sharp")).default;
  const fdisplay = getFontDisplay();
  const fbody    = getFontBody();
  const marca    = input.marca ?? "svn-investimentos";
  const dir      = path.join(ASSETS_DIR, "assinatura", marca);

  const fitNome  = autoFit(fdisplay, input.nome,  FONT_SIZES.nome_default,  FONT_SIZES.nome_min,  SAFE_AREA_W);
  const fitEmail = autoFit(fbody,    input.email, FONT_SIZES.email_default, FONT_SIZES.email_min, SAFE_AREA_W);

  const [nomeBuf, telBuf, emailBuf] = await Promise.all([
    renderText(fdisplay, input.nome,     fitNome.size),
    renderText(fbody,    input.telefone, FONT_SIZES.tel),
    renderText(fbody,    input.email,    fitEmail.size),
  ]);

  const composites: import("sharp").OverlayOptions[] = [
    { input: path.join(dir, "logo.png"),  top: LAYOUT.logo.y,  left: LAYOUT.logo.x,  blend: "screen" },
    { input: path.join(dir, "linha.png"), top: LAYOUT.linha.y, left: LAYOUT.linha.x, blend: "screen" },
    { input: nomeBuf,  top: topForText(fdisplay, fitNome.size,  LAYOUT.nome.y_top),   left: LAYOUT.nome.x  },
    { input: telBuf,   top: topForText(fbody,    FONT_SIZES.tel, LAYOUT.tel.y_top),   left: LAYOUT.tel.x   },
    { input: emailBuf, top: topForText(fbody,    fitEmail.size, LAYOUT.email.y_top),  left: LAYOUT.email.x },
    { input: path.join(dir, "selos.png"), top: LAYOUT.selos.y, left: LAYOUT.selos.x, blend: "screen" },
  ];

  if (input.temCFP) {
    composites.push({ input: path.join(dir, "cfp.png"), top: LAYOUT.cfp.y, left: LAYOUT.cfp.x, blend: "screen" });
  }

  const pngBuffer = await sharp(path.join(dir, "bg.png"))
    .composite(composites)
    .png()
    .toBuffer();

  return { pngBuffer, fitNome, fitEmail };
}
