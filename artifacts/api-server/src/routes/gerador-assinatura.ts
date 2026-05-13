import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";

const ASSETS = {
  bg:      process.env.ASSET_BG_ASSINATURA            || "https://portalsvn.com.br/eventos/wp-content/uploads/2026/05/bg_assinatura-scaled.png",
  linha:   process.env.ASSET_LINHA_ASSINATURA          || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_linha.png",
  selos:   process.env.ASSET_SELOS_ASSINATURA          || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_selos.png",
  seloCfp: process.env.ASSET_SELO_CFP                  || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_selo_cfp.png",
  logos: {
    "SVN Investimentos": process.env.ASSET_LOGO_SVN_INVESTIMENTOS || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_logo_svn_investimentos.png",
    "SVN Capital":       process.env.ASSET_LOGO_SVN_CAPITAL       || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_logo_svn_capital.png",
    "SVN Connect":       process.env.ASSET_LOGO_SVN_CONNECT       || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_logo_svn_connect.png",
  } as Record<string, string>,
};

const FONTS_DIR = path.resolve(__dirname, "../assets/fonts");
const FONT_NOME  = fs.existsSync(path.join(FONTS_DIR, "IvyJournal-Light.ttf"))
  ? path.join(FONTS_DIR, "IvyJournal-Light.ttf")
  : fs.existsSync(path.join(FONTS_DIR, "IvyJournal-Light.otf"))
    ? path.join(FONTS_DIR, "IvyJournal-Light.otf")
    : null;
const FONT_DADOS = fs.existsSync(path.join(FONTS_DIR, "RoobertPRO-Regular.otf"))
  ? path.join(FONTS_DIR, "RoobertPRO-Regular.otf")
  : null;

const W = 4078;
const H = 988;

const POS = {
  logo:     { left: 284,  top: 444,  w: 1203, h: 112  },
  linha:    { left: 1756, top: 341,  w: 11,   h: 306  },
  nome:     { left: 2007, top: 240                     },
  telefone: { left: 2005, top: 447                     },
  email:    { left: 2005, top: 562                     },
  cfp:      { left: 2007, top: 676,  w: 159,  h: 159  },
  selos:    { left: 3400, top: 240,  w: 393,  h: 508  },
};

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar asset: ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function resizeAsset(url: string, w: number, h: number): Promise<Buffer> {
  const buf = await fetchBuffer(url);
  return sharp(buf)
    .resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

function buildTextoSvg(
  texto: string,
  fontSize: number,
  fontFamily: string,
  fontPath: string | null,
  color = "#FFF8F3"
): Buffer {
  const escaped = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  let fontFaceBlock = "";
  let fontFamilyStr: string;

  if (fontPath) {
    const fontData = fs.readFileSync(fontPath).toString("base64");
    const ext = path.extname(fontPath).slice(1).toLowerCase();
    const mimeMap: Record<string, string> = { ttf: "truetype", otf: "opentype", woff: "woff", woff2: "woff2" };
    const mime = mimeMap[ext] || "opentype";
    fontFaceBlock = `@font-face { font-family: '${fontFamily}'; src: url('data:font/${mime};base64,${fontData}'); }`;
    const fallback = fontFamily === "IvyJournal" ? "Georgia, serif" : "Arial, sans-serif";
    fontFamilyStr = `'${fontFamily}', ${fallback}`;
  } else {
    fontFamilyStr = fontFamily === "IvyJournal" ? "Georgia, serif" : "Arial, sans-serif";
  }

  const svgW = Math.max(Math.ceil(texto.length * fontSize * 0.65), 200);
  const svgH = Math.ceil(fontSize * 1.5);

  const svg = `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      ${fontFaceBlock}
      text { font-family: ${fontFamilyStr}; font-size: ${fontSize}px; fill: ${color}; }
    </style></defs>
    <text x="0" y="${fontSize}">${escaped}</text>
  </svg>`;

  return Buffer.from(svg);
}

export async function gerarAssinaturaEmail(
  solicitacaoId: number,
  dados: Record<string, unknown>
): Promise<void> {
  const sharp = (await import("sharp")).default;
  logger.info({ solicitacaoId }, "Iniciando geração de assinatura PNG");

  const nome     = String(dados.nomeCompleto || dados.nome || "").trim();
  const telefone = String(dados.telefone || "").trim();
  const email    = String(dados.emailCorporativo || "").trim();
  const marca    = String(dados.marca || "SVN Investimentos").trim();
  const cfp      = String(dados.cfp || "").toLowerCase() === "sim";

  const logoUrl  = ASSETS.logos[marca] || ASSETS.logos["SVN Investimentos"];
  const comSelos = ["SVN Investimentos", "SVN Capital", "SVN Connect"].includes(marca);

  try {
    const [logoBuf, linhaBuf, selosBuf, cfpBuf, bgBuf] = await Promise.all([
      resizeAsset(logoUrl,      POS.logo.w,  POS.logo.h),
      resizeAsset(ASSETS.linha, POS.linha.w, POS.linha.h),
      comSelos ? resizeAsset(ASSETS.selos,   POS.selos.w, POS.selos.h) : Promise.resolve(null),
      cfp      ? resizeAsset(ASSETS.seloCfp, POS.cfp.w,   POS.cfp.h)  : Promise.resolve(null),
      fetchBuffer(ASSETS.bg),
    ]);

    const nomeSvg      = buildTextoSvg(nome,     149, "IvyJournal", FONT_NOME,  "#FFF8F3");
    const telefoneSvg  = buildTextoSvg(telefone,  64, "RoobertPRO", FONT_DADOS, "#FFF8F3");
    const emailSvg     = buildTextoSvg(email,      64, "RoobertPRO", FONT_DADOS, "#FFF8F3");

    const layers: sharp.OverlayOptions[] = [
      { input: logoBuf,     top: POS.logo.top,     left: POS.logo.left     },
      { input: linhaBuf,    top: POS.linha.top,    left: POS.linha.left    },
      { input: nomeSvg,     top: POS.nome.top,     left: POS.nome.left     },
      { input: telefoneSvg, top: POS.telefone.top, left: POS.telefone.left },
      { input: emailSvg,    top: POS.email.top,    left: POS.email.left    },
    ];

    if (cfpBuf)   layers.push({ input: cfpBuf,   top: POS.cfp.top,   left: POS.cfp.left   });
    if (selosBuf) layers.push({ input: selosBuf, top: POS.selos.top, left: POS.selos.left });

    const pngBuffer = await sharp(bgBuf)
      .resize(W, H)
      .composite(layers)
      .png({ compressionLevel: 8 })
      .toBuffer();

    const tmpPath = path.join(os.tmpdir(), `assinatura-${solicitacaoId}-${Date.now()}.png`);
    await fs.promises.writeFile(tmpPath, pngBuffer);

    const url = await uploadToR2(
      { path: tmpPath, originalname: "assinatura.png", mimetype: "image/png" },
      solicitacaoId,
      "assinatura"
    );

    await db.update(solicitacoesTable)
      .set({
        entrega_links: [{ label: "Assinatura de E-mail", url }],
        status: "concluido",
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    logger.info({ solicitacaoId, url }, "Assinatura PNG gerada e disponibilizada");
  } catch (err) {
    logger.error({ err, solicitacaoId }, "Erro ao gerar assinatura PNG");
    throw err;
  }
}
