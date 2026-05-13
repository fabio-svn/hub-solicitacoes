# Assets locais para geração de assinatura — sem dependência de URLs externas

## 1. Criar pasta e subir arquivos no Replit

Criar a pasta:
```
artifacts/api-server/src/assets/imagens/
```

Subir os seguintes arquivos nessa pasta com esses nomes exatos:
- `bg_assinatura.png`
- `assinatura_linha.png`
- `assinatura_selos.png`
- `assinatura_selo_cfp.png`
- `assinatura_logo_svn_investimentos.png`

---

## 2. `artifacts/api-server/src/routes/gerador-assinatura.ts`

Substituir o arquivo inteiro pelo conteúdo abaixo:

```ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";

// ─── Diretório de assets locais ──────────────────────────────────────────────
const ASSETS_DIR = path.resolve(__dirname, "../assets/imagens");

// ─── Resolução de asset: URL remota (env var) ou arquivo local (fallback) ────
function resolveAsset(envVar: string | undefined, localFile: string): string {
  if (envVar && envVar.startsWith("http")) return envVar;
  return path.join(ASSETS_DIR, localFile);
}

const ASSETS = {
  bg:      resolveAsset(process.env.ASSET_BG_ASSINATURA,        "bg_assinatura.png"),
  linha:   resolveAsset(process.env.ASSET_LINHA_ASSINATURA,     "assinatura_linha.png"),
  selos:   resolveAsset(process.env.ASSET_SELOS_ASSINATURA,     "assinatura_selos.png"),
  seloCfp: resolveAsset(process.env.ASSET_SELO_CFP,             "assinatura_selo_cfp.png"),
  logos: {
    "SVN Investimentos": resolveAsset(process.env.ASSET_LOGO_SVN_INVESTIMENTOS, "assinatura_logo_svn_investimentos.png"),
    "SVN Capital":       resolveAsset(process.env.ASSET_LOGO_SVN_CAPITAL,       "assinatura_logo_svn_investimentos.png"),
    "SVN Connect":       resolveAsset(process.env.ASSET_LOGO_SVN_CONNECT,       "assinatura_logo_svn_investimentos.png"),
  } as Record<string, string>,
};

// ─── Fontes ───────────────────────────────────────────────────────────────────
const FONTS_DIR = path.resolve(__dirname, "../assets/fonts");
const FONT_NOME  = fs.existsSync(path.join(FONTS_DIR, "IvyJournal-Light.otf"))
  ? path.join(FONTS_DIR, "IvyJournal-Light.otf") : null;
const FONT_DADOS = fs.existsSync(path.join(FONTS_DIR, "RoobertPRO-Regular.otf"))
  ? path.join(FONTS_DIR, "RoobertPRO-Regular.otf") : null;

// ─── Canvas ───────────────────────────────────────────────────────────────────
const W = 4078;
const H = 988;

// ─── Posições validadas ───────────────────────────────────────────────────────
const POS = {
  logo:     { left: 284,  top: 444, w: 1203, h: 112 },
  linha:    { left: 1756, top: 341, w: 11,   h: 306 },
  nome:     { left: 2007, top: 240 },
  telefone: { left: 2005, top: 447 },
  email:    { left: 2005, top: 562 },
  cfp:      { left: 2007, top: 676, w: 159,  h: 159 },
  selos:    { left: 3400, top: 240, w: 393,  h: 508 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function loadAsset(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith("http")) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Falha ao baixar asset: ${urlOrPath} (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (!fs.existsSync(urlOrPath)) {
    throw new Error(`Asset não encontrado: ${urlOrPath}`);
  }
  return fs.promises.readFile(urlOrPath);
}

async function resizeAsset(urlOrPath: string, w: number, h: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const buf = await loadAsset(urlOrPath);
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
  const fontFace = fontPath
    ? `@font-face { font-family: '${fontFamily}'; src: url('${fontPath}'); }`
    : "";
  const fallback = fontFamily === "IvyJournal" ? "Georgia, serif" : "Arial, sans-serif";
  const fontFamilyStr = fontPath ? `'${fontFamily}', ${fallback}` : fallback;
  const svgW = Math.max(Math.ceil(texto.length * fontSize * 0.65), 100);
  const svgH = Math.ceil(fontSize * 1.4);
  const textoEsc = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return Buffer.from(`<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
    <defs><style>
      ${fontFace}
      text { font-family: ${fontFamilyStr}; font-size: ${fontSize}px; fill: ${color}; }
    </style></defs>
    <text x="0" y="${fontSize}">${textoEsc}</text>
  </svg>`);
}

// ─── Função principal ─────────────────────────────────────────────────────────
export async function gerarAssinaturaEmail(
  solicitacaoId: number,
  dados: Record<string, unknown>
): Promise<void> {
  logger.info({ solicitacaoId }, "Iniciando geração de assinatura PNG");

  const nome     = String(dados.nomeCompleto || dados.nome || "").trim();
  const telefone = String(dados.telefone || "").trim();
  const email    = String(dados.emailCorporativo || "").trim();
  const marca    = String(dados.marca || "SVN Investimentos").trim();
  const cfp      = String(dados.cfp || "").toLowerCase() === "sim";
  const comSelos = ["SVN Investimentos", "SVN Capital", "SVN Connect"].includes(marca);
  const logoUrl  = ASSETS.logos[marca] || ASSETS.logos["SVN Investimentos"];

  try {
    const sharp = (await import("sharp")).default;

    // Baixar/ler e redimensionar assets em paralelo
    const [logoBuf, linhaBuf, selosBuf, cfpBuf] = await Promise.all([
      resizeAsset(logoUrl,      POS.logo.w,  POS.logo.h),
      resizeAsset(ASSETS.linha, POS.linha.w, POS.linha.h),
      comSelos ? resizeAsset(ASSETS.selos,   POS.selos.w, POS.selos.h) : Promise.resolve(null),
      cfp      ? resizeAsset(ASSETS.seloCfp, POS.cfp.w,   POS.cfp.h)  : Promise.resolve(null),
    ]);

    // Renderizar textos como SVG
    const nomeSvg     = buildTextoSvg(nome,     149, "IvyJournal", FONT_NOME,  "#FFF8F3");
    const telefoneSvg = buildTextoSvg(telefone,  64, "RoobertPRO", FONT_DADOS, "#FFF8F3");
    const emailSvg    = buildTextoSvg(email,     64, "RoobertPRO", FONT_DADOS, "#FFF8F3");

    // Montar camadas
    const layers: Array<{ input: Buffer; top: number; left: number }> = [
      { input: logoBuf,     top: POS.logo.top,     left: POS.logo.left     },
      { input: linhaBuf,    top: POS.linha.top,    left: POS.linha.left    },
      { input: nomeSvg,     top: POS.nome.top,     left: POS.nome.left     },
      { input: telefoneSvg, top: POS.telefone.top, left: POS.telefone.left },
      { input: emailSvg,    top: POS.email.top,    left: POS.email.left    },
    ];

    if (cfpBuf)   layers.push({ input: cfpBuf,   top: POS.cfp.top,   left: POS.cfp.left   });
    if (selosBuf) layers.push({ input: selosBuf, top: POS.selos.top, left: POS.selos.left });

    // Compor sobre o background
    const bgBuf = await loadAsset(ASSETS.bg);
    const pngBuffer = await sharp(bgBuf)
      .resize(W, H)
      .composite(layers)
      .png({ compressionLevel: 8 })
      .toBuffer();

    // Salvar temporariamente e fazer upload para R2
    const tmpPath = path.join(os.tmpdir(), `assinatura-${solicitacaoId}-${Date.now()}.png`);
    await fs.promises.writeFile(tmpPath, pngBuffer);

    const url = await uploadToR2(
      { path: tmpPath, originalname: "assinatura.png", mimetype: "image/png" },
      solicitacaoId,
      "assinatura"
    );

    // Salvar link e marcar como concluído
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
```

---

## 3. Build

```bash
cd artifacts/api-server && pnpm run build
```

Reiniciar o servidor após o build.

---

## Observação — migração para R2 depois

Quando tiver acesso ao Cloudflare R2, subir os assets e adicionar as variáveis
de ambiente no Railway/Replit:

```
ASSET_BG_ASSINATURA=https://pub-...r2.dev/bg_assinatura.png
ASSET_LINHA_ASSINATURA=https://pub-...r2.dev/assinatura_linha.png
ASSET_SELOS_ASSINATURA=https://pub-...r2.dev/assinatura_selos.png
ASSET_SELO_CFP=https://pub-...r2.dev/assinatura_selo_cfp.png
ASSET_LOGO_SVN_INVESTIMENTOS=https://pub-...r2.dev/assinatura_logo_svn_investimentos.png
```

O código vai usar as URLs das variáveis automaticamente sem precisar rebuildar.
