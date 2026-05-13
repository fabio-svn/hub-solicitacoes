# Geração de assinatura de e-mail com Sharp — implementação completa

## Contexto
O backend gera a assinatura como PNG usando Sharp, compondo assets de imagem
e texto dinâmico, sem N8N, sem Bannerbear, sem serviço externo.

Canvas: 4078 × 988px

---

## 1. Assets — subir no R2 (bucket `solicitacoes` ou bucket público)

Subir os seguintes arquivos e anotar as URLs públicas:

| Arquivo | Descrição |
|---------|-----------|
| `bg_assinatura.png` | Background da assinatura |
| `assinatura_logo_svn_investimentos.png` | Logo SVN Investimentos + XP |
| `assinatura_selos.png` | Selos Melhor Escritório + G20 |
| `assinatura_linha.png` | Linha separadora vertical |
| `assinatura_selo_cfp.png` | Selo CFP |

Fontes — subir em `artifacts/api-server/src/assets/fonts/`:
- `IvyJournal-Light.otf` (ou .ttf) — para o nome
- `RoobertPRO-Regular.otf` (ou .ttf) — para telefone e e-mail

Se as fontes não estiverem disponíveis ainda, o código usa Georgia e Arial
como fallback temporário.

---

## 2. Instalar Sharp

```bash
cd artifacts/api-server
pnpm add sharp
pnpm add -D @types/sharp
```

---

## 3. Migration — coluna `entrega_links` (se ainda não existir)

```sql
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS entrega_links JSONB;
```

No schema Drizzle:
```ts
entrega_links: jsonb("entrega_links"),
```

---

## 4. Criar `artifacts/api-server/src/routes/gerador-assinatura.ts`

```ts
import sharp from "sharp";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";

// ─── URLs dos assets (atualizar com URLs definitivas do R2 depois) ──────────
const ASSETS = {
  bg:       process.env.ASSET_BG_ASSINATURA       || "https://portalsvn.com.br/eventos/wp-content/uploads/2026/05/bg_assinatura-scaled.png",
  linha:    process.env.ASSET_LINHA_ASSINATURA     || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_linha.png",
  selos:    process.env.ASSET_SELOS_ASSINATURA     || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_selos.png",
  seloCfp:  process.env.ASSET_SELO_CFP             || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_selo_cfp.png",
  logos: {
    "SVN Investimentos": process.env.ASSET_LOGO_SVN_INVESTIMENTOS || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_logo_svn_investimentos.png",
    "SVN Capital":       process.env.ASSET_LOGO_SVN_CAPITAL       || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_logo_svn_capital.png",
    "SVN Connect":       process.env.ASSET_LOGO_SVN_CONNECT       || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_logo_svn_connect.png",
  } as Record<string, string>,
};

// ─── Caminhos das fontes ─────────────────────────────────────────────────────
const FONTS_DIR = path.resolve(__dirname, "../assets/fonts");
const FONT_NOME   = fs.existsSync(path.join(FONTS_DIR, "IvyJournal-Light.otf"))
  ? path.join(FONTS_DIR, "IvyJournal-Light.otf")
  : null; // fallback para Georgia se não existir
const FONT_DADOS  = fs.existsSync(path.join(FONTS_DIR, "RoobertPRO-Regular.otf"))
  ? path.join(FONTS_DIR, "RoobertPRO-Regular.otf")
  : null; // fallback para Arial

// ─── Canvas ──────────────────────────────────────────────────────────────────
const W = 4078;
const H = 988;

// ─── Posições validadas ───────────────────────────────────────────────────────
const POS = {
  logo:     { left: 284,  top: 444,  w: 1203, h: 112  },
  linha:    { left: 1756, top: 341,  w: 11,   h: 306  },
  nome:     { left: 2007, top: 240                     }, // texto dinâmico
  telefone: { left: 2005, top: 447                     }, // texto dinâmico
  email:    { left: 2005, top: 562                     }, // texto dinâmico
  cfp:      { left: 2007, top: 676,  w: 159,  h: 159  },
  selos:    { left: 3400, top: 240,  w: 393,  h: 508  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao baixar asset: ${url} (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

async function resizeAsset(
  url: string,
  w: number,
  h: number
): Promise<Buffer> {
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
  // Se tiver fonte customizada, incluir @font-face
  const fontFace = fontPath
    ? `@font-face {
        font-family: '${fontFamily}';
        src: url('${fontPath}');
      }`
    : "";

  const fallback = fontFamily === "IvyJournal"
    ? "Georgia, serif"
    : "Arial, sans-serif";

  const fontFamilyStr = fontPath ? `'${fontFamily}', ${fallback}` : fallback;

  // Estimar largura do texto (aproximação)
  const estimatedWidth = texto.length * fontSize * 0.65;
  const svgW = Math.max(Math.ceil(estimatedWidth), 100);
  const svgH = Math.ceil(fontSize * 1.4);

  const svg = `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        ${fontFace}
        text {
          font-family: ${fontFamilyStr};
          font-size: ${fontSize}px;
          fill: ${color};
        }
      </style>
    </defs>
    <text x="0" y="${fontSize}">${texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>
  </svg>`;

  return Buffer.from(svg);
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

  const logoUrl = ASSETS.logos[marca] || ASSETS.logos["SVN Investimentos"];
  const comSelos = ["SVN Investimentos", "SVN Capital", "SVN Connect"].includes(marca);

  try {
    // ── Baixar e redimensionar assets de imagem em paralelo ────────────────
    const [logoBuf, linhaBuf, selosBuf, cfpBuf] = await Promise.all([
      resizeAsset(logoUrl, POS.logo.w, POS.logo.h),
      resizeAsset(ASSETS.linha, POS.linha.w, POS.linha.h),
      comSelos ? resizeAsset(ASSETS.selos, POS.selos.w, POS.selos.h) : Promise.resolve(null),
      cfp ? resizeAsset(ASSETS.seloCfp, POS.cfp.w, POS.cfp.h) : Promise.resolve(null),
    ]);

    // ── Renderizar textos como SVG ─────────────────────────────────────────
    const nomeSvg     = buildTextoSvg(nome,     149, "IvyJournal",  FONT_NOME,  "#FFF8F3");
    const telefoneSvg = buildTextoSvg(telefone,  64, "RoobertPRO",  FONT_DADOS, "#FFF8F3");
    const emailSvg    = buildTextoSvg(email,     64, "RoobertPRO",  FONT_DADOS, "#FFF8F3");

    // ── Montar composição ──────────────────────────────────────────────────
    const layers: sharp.OverlayOptions[] = [
      { input: logoBuf,  top: POS.logo.top,     left: POS.logo.left     },
      { input: linhaBuf, top: POS.linha.top,    left: POS.linha.left    },
      { input: nomeSvg,  top: POS.nome.top,     left: POS.nome.left     },
      { input: telefoneSvg, top: POS.telefone.top, left: POS.telefone.left },
      { input: emailSvg, top: POS.email.top,    left: POS.email.left    },
    ];

    if (cfpBuf) {
      layers.push({ input: cfpBuf, top: POS.cfp.top, left: POS.cfp.left });
    }
    if (selosBuf) {
      layers.push({ input: selosBuf, top: POS.selos.top, left: POS.selos.left });
    }

    // ── Baixar background e compor ─────────────────────────────────────────
    const bgBuf = await fetchBuffer(ASSETS.bg);

    const pngBuffer = await sharp(bgBuf)
      .resize(W, H)
      .composite(layers)
      .png({ compressionLevel: 8 })
      .toBuffer();

    // ── Salvar temporariamente e fazer upload para R2 ──────────────────────
    const tmpPath = path.join(os.tmpdir(), `assinatura-${solicitacaoId}-${Date.now()}.png`);
    await fs.promises.writeFile(tmpPath, pngBuffer);

    const url = await uploadToR2(
      { path: tmpPath, originalname: "assinatura.png", mimetype: "image/png" },
      solicitacaoId,
      "assinatura"
    );

    // ── Salvar link e mudar status para em-aprovacao ───────────────────────
    await db.update(solicitacoesTable)
      .set({
        entrega_links: [{ label: "Assinatura de E-mail — PNG", url }],
        status: "em-aprovacao",
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

## 5. Criar diretório de fontes

```
artifacts/api-server/src/assets/fonts/
```

Subir nessa pasta:
- `IvyJournal-Light.otf`
- `RoobertPRO-Regular.otf`

---

## 6. `artifacts/api-server/src/routes/forms.ts`

### 6a. Importar o gerador

```ts
import { gerarAssinaturaEmail } from "./gerador-assinatura";
```

### 6b. Remover `assinatura-email` do WEBHOOK_MAP

```ts
// Remover ou comentar a linha:
// "assinatura-email": process.env.WEBHOOK_ASSINATURA_EMAIL,
```

### 6c. Disparar geração após insert da solicitação

No POST /solicitacoes, após o bloco de upload de arquivos e geração do título,
adicionar:

```ts
// Geração automática para assinatura de e-mail
if (tipo_solicitacao === "assinatura-email") {
  gerarAssinaturaEmail(solicitacao.id, parsedDados).catch(err => {
    logger.error({ err, solicitacaoId: solicitacao.id }, "Falha na geração da assinatura");
  });
}
```

### 6d. Endpoint GET /solicitacoes/:id/entrega — ler entrega_links do banco primeiro

No início do handler, antes de consultar o ClickUp, adicionar:

```ts
if (
  solicitacao.entrega_links &&
  Array.isArray(solicitacao.entrega_links) &&
  (solicitacao.entrega_links as Array<unknown>).length > 0
) {
  res.json({ links: solicitacao.entrega_links, status: solicitacao.status });
  return;
}
```

### 6e. Endpoint POST /solicitacoes/:id/entrega (novo)

```ts
router.post("/solicitacoes/:id/entrega", async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const internalSecret = process.env.INTERNAL_API_SECRET;
    const user = req.session?.user;
    const isInternal = internalSecret && req.headers["x-internal-secret"] === internalSecret;
    const isAdmin = user?.role === "admin" || user?.role === "gestor";

    if (!isInternal && !isAdmin) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const { links } = req.body as { links: Array<{ label: string; url: string }> };
    if (!links || !Array.isArray(links) || links.length === 0) {
      res.status(400).json({ error: "links é obrigatório" }); return;
    }

    const [solicitacao] = await db.select()
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.id, id));

    if (!solicitacao) { res.status(404).json({ error: "Não encontrada" }); return; }

    await db.update(solicitacoesTable)
      .set({ entrega_links: links, status: "em-aprovacao", updated_at: new Date() })
      .where(eq(solicitacoesTable.id, id));

    logger.info({ id, links: links.length }, "Links de entrega salvos");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar entrega");
    res.status(500).json({ error: "Erro" });
  }
});
```

---

## 7. Replit Secrets — adicionar

```
INTERNAL_API_SECRET=svn_internal_2026_TROCAR_POR_STRING_ALEATORIA
ASSET_BG_ASSINATURA=https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/bg_assinatura.png
ASSET_LINHA_ASSINATURA=https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_linha.png
ASSET_SELOS_ASSINATURA=https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_selos.png
ASSET_SELO_CFP=https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_selo_cfp.png
ASSET_LOGO_SVN_INVESTIMENTOS=https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinatura_logo_svn_investimentos.png
```

Atualizar as URLs após subir os assets no R2.

---

## 8. Build

```bash
cd artifacts/api-server && pnpm run build
```

Reiniciar o servidor após o build.

---

## Resultado esperado

1. Assessor preenche o formulário de assinatura de e-mail
2. Backend gera o PNG instantaneamente com os dados preenchidos
3. Faz upload do PNG para o R2
4. Muda status para `em-aprovacao`
5. Notificação aparece no hub
6. Assessor baixa o PNG e usa como assinatura no Gmail/Outlook

## Observações

- Se as fontes IvyJournal e RoobertPRO não estiverem em `src/assets/fonts/`,
  o código usa Georgia e Arial como fallback — a assinatura funciona mas
  com fontes diferentes. Subir as fontes para corrigir.
- O Sharp está em `external` no `build.mjs` — remover `"sharp"` da lista
  de externos para que seja bundlado corretamente. Se causar problemas no
  build, manter como externo e garantir que está em `dependencies` no
  `package.json` (não em `devDependencies`).
- Coordenadas validadas com teste real em 4078×988px.
