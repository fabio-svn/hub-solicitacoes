// gerar-cartao.ts
// Geração do cartão de visita físico (SVN) para hot stamping.
//
// Estratégia: NÃO usamos string-replace nos placeholders do SVG. O Illustrator
// fragmenta cada texto em vários <tspan> com kerning manual (ex.: "{{NOME}}" vira
// 4 tspans), então um replace simples quebraria. Em vez disso, removemos os <text>
// do template e RECONSTRUÍMOS cada linha já como <path> (curvas) via opentype.js —
// que também é exatamente o que a gráfica precisa para hot stamping.
//
// Deps: opentype.js  pdfkit  svg-to-pdfkit
// Assets esperados:
//   assets/verso.svg                       (template, com os <text> placeholders)
//   assets/frente.svg                      (frente estática — opcional, ver gerarPdf)
//   assets/fonts/RoobertPROTRIAL-Bold.ttf
//   assets/fonts/RoobertPROTRIAL-Regular.ttf

import fs from "fs";
import path from "path";
import opentype from "opentype.js";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { PDFDocument as PdfLib } from "pdf-lib";

// SVGs do cartão (verso/frente) ficam em assets/cartao/.
// Fontes ficam em assets/fonts/ (pasta compartilhada com assinaturas de e-mail etc).
// Ambos resolvidos a partir do cwd (em produção = artifacts/api-server, via pnpm --filter).
// Override por env se necessário.
const ASSETS_CARTAO = process.env.CARTAO_ASSETS_DIR || path.join(process.cwd(), "assets", "cartao");
const FONTS_DIR = process.env.CARTAO_FONTS_DIR || path.join(process.cwd(), "assets", "fonts");
const FILL = "#231c1a"; // cor sólida do template (marcação p/ gravação dourada)

// --- Layout extraído do verso.svg -------------------------------------------
// Cada linha = um <text>/<tspan> do template, mapeado para um campo do form.
// x/y são as coordenadas de baseline (em pt, pois o viewBox já está em pt: 9cm = 255.12pt).
type FontKey = "bold" | "regular";

interface LinhaLayout {
  campo: "nome" | "telefone" | "email";
  font: FontKey;
  size: number;
  cx: number;       // eixo central (pt) — texto centralizado nele
  y: number;
  maxWidth: number; // largura máxima (pt) — acima dela o texto encolhe p/ caber
  tracking?: number; // espaçamento entre letras em em (Illustrator: 200 = 0.2)
  transform?: (s: string) => string;
}

// Bloco centralizado no eixo x=127.56 (centro do cartão e centro da linha divisória).
// A divisória tem ~146pt. Nomes longos podem ultrapassar um pouco dela (maxWidth do nome > 146)
// para não encolherem demais; nomes curtos seguem no corpo base. Contato vai bem mais largo.
const CX = 127.56;
const LAYOUT: LinhaLayout[] = [
  { campo: "nome",     font: "bold",    size: 10,  cx: CX, y: 53.96, maxWidth: 170, tracking: 0.2, transform: (s) => s.toUpperCase() },
  { campo: "telefone", font: "regular", size: 8.5, cx: CX, y: 81.03, maxWidth: 235 },
  { campo: "email",    font: "regular", size: 8.5, cx: CX, y: 95.03, maxWidth: 235 }, // 2ª linha do bloco (81.03 + 14)
];

const FONT_FILES: Record<FontKey, string> = {
  bold: "RoobertPROTRIAL-Bold.otf",
  regular: "RoobertPROTRIAL-Regular.otf",
};

const _fontCache: Partial<Record<FontKey, opentype.Font>> = {};
function loadFont(key: FontKey): opentype.Font {
  if (!_fontCache[key]) {
    const buf = fs.readFileSync(path.join(FONTS_DIR, FONT_FILES[key]));
    _fontCache[key] = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  }
  return _fontCache[key]!;
}

// Largura do texto considerando tracking (espaçamento entre letras), em pt.
function medirLargura(font: opentype.Font, texto: string, size: number, trackingEm = 0): number {
  const base = font.getAdvanceWidth(texto, size);
  if (!trackingEm) return base;
  const ls = trackingEm * size;
  const n = font.stringToGlyphs(texto).length;
  return base + Math.max(0, n - 1) * ls; // n-1 espaços entre as letras
}

// Gera o path do texto aplicando tracking (espaço extra após cada glifo).
// Retorna o path-data e a largura visual (sem o espaço final, para centralizar bem).
function pathComTracking(
  font: opentype.Font, texto: string, x: number, y: number, size: number, trackingEm = 0,
): { d: string } {
  if (!trackingEm) {
    return { d: font.getPath(texto, x, y, size).toPathData(2) };
  }
  const ls = trackingEm * size;
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(texto);
  const full = new opentype.Path();
  let cursor = x;
  for (const g of glyphs) {
    full.extend(g.getPath(cursor, y, size));
    cursor += (g.advanceWidth || 0) * scale + ls;
  }
  return { d: full.toPathData(2) };
}

interface DadosCartao {
  nome: string;
  telefone: string;
  email: string;
}

/**
 * Gera o SVG do verso com os textos já convertidos em <path> (curvas).
 * Retorna string SVG pronta para preview no browser OU para virar PDF.
 */
export function gerarVersoSvg(dados: DadosCartao): string {
  const template = fs.readFileSync(path.join(ASSETS_CARTAO, "verso.svg"), "utf8");

  // 1) Remove os <text>...</text> do template (ficam só defs + rect divisória).
  const base = template.replace(/<text[\s\S]*?<\/text>/g, "");

  // 2) Gera um <path> por linha do layout.
  const paths = LAYOUT.map((l) => {
    let valor = (dados[l.campo] ?? "").trim();
    if (l.transform) valor = l.transform(valor);
    if (!valor) return "";

    const font = loadFont(l.font);
    const tracking = l.tracking ?? 0;

    // Auto-shrink: se a linha estourar a largura máxima, reduz o corpo até caber (piso 6pt).
    let size = l.size;
    while (size > 6 && medirLargura(font, valor, size, tracking) > l.maxWidth) size -= 0.25;

    // Centralização: startX recua metade da largura (com tracking) a partir do eixo central.
    const startX = l.cx - medirLargura(font, valor, size, tracking) / 2;

    const { d } = pathComTracking(font, valor, startX, l.y, size, tracking);
    return `  <path d="${d}" fill="${FILL}"/>`;
  }).filter(Boolean).join("\n");

  // 3) Injeta os paths antes do </svg>.
  return base.replace(/<\/svg>\s*$/, `${paths}\n</svg>`);
}

/**
 * Combina frente (estática) + verso (gerado) num PDF de 2 páginas COM SANGRIA.
 *
 * Sangria de 0,2cm por lado (gráfica). Como a arte é toda interna (foil sobre papel
 * já colorido — nada de fundo impresso a "vazar"), a sangria é puramente a área de
 * substrato em volta do corte: a página cresce 0,2cm em cada lado e a arte de 9x5cm
 * fica centralizada. O TrimBox marca o corte final (9x5cm) pra prepress da gráfica.
 */
export async function gerarPdf(dados: DadosCartao): Promise<Buffer> {
  const PT_CM = 28.3465;        // 1cm em pt
  const SANGRIA = 0 * PT_CM;  // cartao 9x5 exato (sem area de sangria)
  const TRIM_W = 255.12;        // corte final: 9cm
  const TRIM_H = 141.73;        // corte final: 5cm
  const MEDIA_W = TRIM_W + 2 * SANGRIA; // = 9cm (sangria 0 -> igual ao TRIM)
  const MEDIA_H = TRIM_H + 2 * SANGRIA; // = 5cm (sangria 0 -> igual ao TRIM)

  const versoSvg = gerarVersoSvg(dados);
  const frentePath = path.join(ASSETS_CARTAO, "frente.svg");
  const temFrente = fs.existsSync(frentePath);

  const doc = new PDFDocument({ size: [MEDIA_W, MEDIA_H], margin: 0 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const desenhar = (svg: string) =>
    SVGtoPDF(doc, svg, SANGRIA, SANGRIA, { width: TRIM_W, height: TRIM_H });

  if (temFrente) {
    desenhar(fs.readFileSync(frentePath, "utf8"));
    doc.addPage({ size: [MEDIA_W, MEDIA_H], margin: 0 });
  }
  desenhar(versoSvg);
  doc.end();

  const raw = await done;
  const pdf = await PdfLib.load(raw);
  for (const page of pdf.getPages()) {
    page.setMediaBox(0, 0, MEDIA_W, MEDIA_H);
    page.setBleedBox(0, 0, MEDIA_W, MEDIA_H);
    page.setTrimBox(SANGRIA, SANGRIA, TRIM_W, TRIM_H);
    page.setCropBox(SANGRIA, SANGRIA, TRIM_W, TRIM_H);
  }
  return Buffer.from(await pdf.save());
}