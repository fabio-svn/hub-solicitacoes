# Hub de Solicitações SVN — Implementação: Geração de Assinatura de E-mail

Esta tarefa implementa geração server-side do PNG da assinatura institucional para o tipo de solicitação `assinatura-email`, mais alterações de UI no dashboard e no resumo da solicitação.

A implementação tem 6 etapas. Execute na ordem. Após a Etapa 6, rode o build (`cd artifacts/api-server && pnpm run build`) e reinicie o servidor.

---

## Etapa 1 — Dependências e Assets

### 1.1 Adicionar deps ao `artifacts/api-server/package.json`

```bash
cd artifacts/api-server
pnpm add sharp fontkit
pnpm add -D @types/fontkit
```

### 1.2 Fontes da marca

O projeto já tem os arquivos das fontes oficiais. Localize no repo e copie/symlink para `artifacts/api-server/assets/fonts/`:

- `IvyJournal-Light.ttf` (display — usado no nome)
- `RoobertPROTRIAL-Light.otf` (body — usado em telefone e email)

Se os arquivos estiverem com nome levemente diferente (ex.: `Roobert-PRO-Light.otf` ou variantes), use o nome real e ajuste os paths na Etapa 2. O importante é que sejam o **weight 300 (Light)** de cada família.

**fontkit lê TTF e OTF nativamente** — não precisa converter.

### 1.3 Adicionar imagens base da assinatura

Criar `artifacts/api-server/assets/assinatura/svn-investimentos/` com:

- `bg.png` (background do contrato social, 4078×988)
- `logo.png` (logo SVN+XP, 1204×122)
- `linha.png` (separador vertical, 11×358)
- `selos.png` (Melhor Escritório + G20, 393×508)
- `cfp.png` (selo CFP, 159×159)

Os assets atuais vêm com fundo preto sólido (não transparente). O gerador usa `blend: 'screen'` no Sharp para tratar o preto como transparente — funciona perfeitamente porque logos e selos são brancos.

A estrutura por contrato social é proposital: no futuro adicionaremos `svn-capital/`, `svn-connect/` etc.

### 1.4 Configurar esbuild para Sharp

Sharp tem binários nativos. No `artifacts/api-server/build.config.ts` (ou onde estiver a config do esbuild), adicionar `sharp` à lista de `external`:

```ts
external: ['sharp', ...existing_externals]
```

E garantir que o diretório `assets/` seja copiado para `dist/` no build (Sharp precisa achar os PNGs em runtime). Adicionar etapa de cópia:

```ts
// no build script
import { cpSync } from 'fs';
cpSync('assets', 'dist/assets', { recursive: true });
```

---

## Etapa 2 — Service de Geração (Backend)

Criar `artifacts/api-server/src/services/assinatura-generator.ts`:

```typescript
import sharp from 'sharp';
import fontkit from 'fontkit';
import fs from 'fs';
import path from 'path';

// ============================================================
// CARREGAR FONTES (uma vez, no import)
// ============================================================
const ASSETS_DIR = path.resolve(__dirname, '../../assets');
const FONT_DISPLAY_PATH = path.join(ASSETS_DIR, 'fonts/IvyJournal-Light.ttf');
const FONT_BODY_PATH    = path.join(ASSETS_DIR, 'fonts/RoobertPROTRIAL-Light.otf');

// Ivy Journal Light → usada no nome (display)
// Roobert PRO Light → usada em telefone e email (body)
const fontDisplay = fontkit.openSync(FONT_DISPLAY_PATH) as any;
const fontBody    = fontkit.openSync(FONT_BODY_PATH) as any;

// ============================================================
// LAYOUT (coordenadas exatas do design — SVN Investimentos)
// ============================================================
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
  nome_default: 149,
  nome_min:     90,
  tel:          64,
  email_default: 64,
  email_min:    42,
};

const PADDING_SELOS = 20;
const SAFE_AREA_W = LAYOUT.selos.x - LAYOUT.nome.x - PADDING_SELOS; // 1373
const TEXT_FILL = '#FFF8F3';

// ============================================================
// MEDIÇÃO E PATH RENDERING
// ============================================================
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

function autoFit(
  font: any,
  text: string,
  defaultSize: number,
  minSize: number,
  maxWidth: number
): FitResult {
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
  const run = font.layout(text);
  const scale = fontSize / font.unitsPerEm;
  const ascent  = font.ascent  * scale;
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
        `<path d="${pathData}" transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${scale.toFixed(5)},-${scale.toFixed(5)})" fill="${TEXT_FILL}"/>`
      );
    }
    x += pos.xAdvance;
  }

  const totalWidth = Math.ceil(x * scale) + 4;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${svgHeight}">${pathElements.join('')}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function topForText(font: any, fontSize: number, yTop: number): number {
  const scale = fontSize / font.unitsPerEm;
  const capHeight = (font.capHeight || font.ascent * 0.7) * scale;
  const ascentPx = font.ascent * scale;
  return Math.round(yTop - (ascentPx - capHeight));
}

// ============================================================
// API PÚBLICA
// ============================================================
export interface AssinaturaInput {
  nome: string;
  telefone: string;
  email: string;
  temCFP?: boolean;
  marca?: 'svn-investimentos'; // só implementado por enquanto
}

export interface AssinaturaResult {
  pngBuffer: Buffer;
  fitNome: FitResult;
  fitEmail: FitResult;
}

export async function gerarAssinatura(input: AssinaturaInput): Promise<AssinaturaResult> {
  const marca = input.marca ?? 'svn-investimentos';
  const dir = path.join(ASSETS_DIR, 'assinatura', marca);

  const fitNome  = autoFit(fontDisplay, input.nome,  FONT_SIZES.nome_default,  FONT_SIZES.nome_min,  SAFE_AREA_W);
  const fitEmail = autoFit(fontBody,    input.email, FONT_SIZES.email_default, FONT_SIZES.email_min, SAFE_AREA_W);

  const nomeBuf  = await renderText(fontDisplay, input.nome,     fitNome.size);
  const telBuf   = await renderText(fontBody,    input.telefone, FONT_SIZES.tel);
  const emailBuf = await renderText(fontBody,    input.email,    fitEmail.size);

  const composites: sharp.OverlayOptions[] = [
    { input: path.join(dir, 'logo.png'),  top: LAYOUT.logo.y,  left: LAYOUT.logo.x,  blend: 'screen' },
    { input: path.join(dir, 'linha.png'), top: LAYOUT.linha.y, left: LAYOUT.linha.x, blend: 'screen' },
    { input: nomeBuf,  top: topForText(fontDisplay, fitNome.size,  LAYOUT.nome.y_top),  left: LAYOUT.nome.x },
    { input: telBuf,   top: topForText(fontBody,    FONT_SIZES.tel, LAYOUT.tel.y_top),  left: LAYOUT.tel.x },
    { input: emailBuf, top: topForText(fontBody,    fitEmail.size, LAYOUT.email.y_top), left: LAYOUT.email.x },
    { input: path.join(dir, 'selos.png'), top: LAYOUT.selos.y, left: LAYOUT.selos.x, blend: 'screen' },
  ];

  if (input.temCFP) {
    composites.push({
      input: path.join(dir, 'cfp.png'),
      top: LAYOUT.cfp.y,
      left: LAYOUT.cfp.x,
      blend: 'screen',
    });
  }

  const pngBuffer = await sharp(path.join(dir, 'bg.png'))
    .composite(composites)
    .png()
    .toBuffer();

  return { pngBuffer, fitNome, fitEmail };
}
```

---

## Etapa 3 — Integração com o Fluxo de Submissão

### 3.1 Schema do banco

Adicionar coluna na tabela `solicitacoes` (Drizzle migration):

```sql
ALTER TABLE solicitacoes ADD COLUMN assinatura_png_url TEXT;
```

E atualizar o Drizzle schema (`src/db/schema.ts`):

```ts
assinaturaPngUrl: text('assinatura_png_url'),
```

### 3.2 Upload R2 + persistência

No handler do form de assinatura-email (provavelmente em `src/routes/solicitacoes.ts` ou similar), após criar a solicitação no DB, chamar o gerador e fazer upload no R2:

```ts
import { gerarAssinatura } from '../services/assinatura-generator';
import { uploadToR2 } from '../services/r2'; // service já existente

// ... após criar a row da solicitação:
if (tipo === 'assinatura-email') {
  try {
    const { pngBuffer, fitNome } = await gerarAssinatura({
      nome: dados.nome,
      telefone: dados.telefone,
      email: dados.email,
      temCFP: dados.cfp === true || dados.cfp === 'true',
      marca: 'svn-investimentos', // hardcode por enquanto
    });

    const key = `assinaturas/${solicitacao.id}.png`;
    const url = await uploadToR2(key, pngBuffer, 'image/png');

    await db.update(solicitacoes)
      .set({ assinaturaPngUrl: url })
      .where(eq(solicitacoes.id, solicitacao.id));

    // se o nome bateu no floor mínimo, registra log para análise depois
    if (fitNome.belowFloor) {
      console.warn(`[assinatura] nome ${dados.nome} caiu abaixo do floor (${fitNome.size}px)`);
    }

    // adicionar URL ao payload do webhook
    webhookPayload.pngUrl = url;
  } catch (err) {
    console.error('[assinatura] erro ao gerar PNG:', err);
    // não bloqueia a criação da solicitação — log e segue
  }
}
```

A URL do R2 segue o padrão público existente: `https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/assinaturas/{id}.png`.

### 3.3 Webhook

O webhook existente em `https://auto.portalsvn.com.br/webhook/assinatura-email-398` continua. Apenas inclua o campo `pngUrl` no payload — a configuração no N8N pode usar essa URL para anexar/encaminhar como preferir (mudança no N8N é fora do escopo deste prompt).

---

## Etapa 4 — Dashboard: substituir tag "Concluído" por botão de download

No arquivo do dashboard (provavelmente `dashboard.js` no diretório do frontend), localizar a renderização da tag de status no card de solicitação.

Para solicitações com `tipo === 'assinatura-email'` E `status === 'concluido'` E `assinaturaPngUrl` presente, renderizar **botão de download** no lugar da tag "Concluído".

```js
// Pseudo: dentro do template do card
if (solicitacao.tipo === 'assinatura-email' && solicitacao.status === 'concluido' && solicitacao.assinaturaPngUrl) {
  return `
    <a href="${solicitacao.assinaturaPngUrl}"
       download="assinatura-${solicitacao.id}.png"
       class="btn-download-assinatura">
       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
         <polyline points="7 10 12 15 17 10"/>
         <line x1="12" y1="15" x2="12" y2="3"/>
       </svg>
       Baixar
    </a>
  `;
} else {
  // renderiza a tag normal
}
```

Atributo `download` faz o navegador baixar direto em vez de abrir.

---

## Etapa 5 — Resumo da solicitação: remover card de campos, adicionar preview

No arquivo do resumo (`dashboard.js` ou modal de detalhes), quando `tipo === 'assinatura-email'`:

1. **Remover** o card "Resumo da solicitação" que lista os campos (nome, telefone, email, etc). Essas informações já estão visíveis na assinatura.
2. **Adicionar** novo card com:
   - Preview do PNG (`<img>` com `assinaturaPngUrl`)
   - Botão de download abaixo

```html
<div class="card card-assinatura-preview">
  <h3>Sua assinatura</h3>
  <div class="preview-wrapper">
    <img src="${solicitacao.assinaturaPngUrl}"
         alt="Assinatura de e-mail"
         class="assinatura-img" />
  </div>
  <a href="${solicitacao.assinaturaPngUrl}"
     download="assinatura-${solicitacao.id}.png"
     class="btn-download-assinatura btn-download-large">
     <!-- mesmo SVG icone do botão do card -->
     Baixar assinatura (.png)
  </a>
</div>
```

CSS sugerido para o preview wrapper:

```css
.card-assinatura-preview .preview-wrapper {
  background: var(--carbon-black, #221B19); /* combina com fundo escuro da assinatura */
  border-radius: 8px;
  padding: 16px;
  overflow: hidden;
  margin-bottom: 16px;
}

.card-assinatura-preview .assinatura-img {
  width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
}
```

**Importante:** manter os outros cards do resumo (timeline/histórico, ações admin, etc) — só o card de "campos da solicitação" deve sumir para esse tipo.

---

## Etapa 6 — Estilo do botão de download (degrade dourado)

O botão de download deve usar o **mesmo gradiente dourado** que o botão "Enviar" dos formulários tem hoje.

1. Localizar a classe/estilo do botão "Enviar" em `style.css` (provavelmente algo como `.btn-submit`, `.btn-enviar`, ou similar — buscar por `linear-gradient` na cor dourada).
2. Aplicar o mesmo `background` (incluindo hover, active, transição) na nova classe `.btn-download-assinatura`.
3. Manter ícone à esquerda do texto, fonte Nunito Sans 600, padding generoso, border-radius alinhado com os outros botões.

Variantes:

- `.btn-download-assinatura` (no card do dashboard) — tamanho compacto, parecido com a tag "Concluído" que substitui
- `.btn-download-assinatura.btn-download-large` (no resumo) — tamanho maior, ocupa toda a largura do card de preview

Se for difícil identificar o gradiente exato, buscar no `style.css` por palavras-chave: `gold`, `dourado`, `linear-gradient` próximo a estilos de submit/enviar.

---

## Build e Validação

```bash
cd artifacts/api-server
pnpm run build
# Verificar que dist/index.mjs foi gerado e dist/assets/ existe
ls -la dist/assets/fonts/ dist/assets/assinatura/svn-investimentos/

# Reiniciar o servidor
# (workflow do Replit — restart manual via interface)
```

### Testes manuais

1. Submeter form de assinatura com `nome = "Thainá Gabrieli Nascimento"`, telefone, email, `cfp = false`
   - Verificar que a solicitação é criada no DB
   - Verificar que `assinatura_png_url` é populado
   - Acessar a URL e confirmar que o PNG está correto (texto cabe, sem overlap com selos)

2. Submeter com nome muito longo: `"Maria Aparecida dos Santos Albuquerque Júnior"`
   - PNG deve ser gerado sem overflow nos selos
   - Console deve logar warning de `belowFloor`

3. Submeter com `cfp = true`
   - Selo CFP deve aparecer abaixo do email

4. Abrir o dashboard
   - Solicitação concluída de assinatura mostra botão "Baixar" no lugar da tag
   - Clicar baixa o PNG

5. Abrir o resumo
   - Card "Resumo da solicitação" não aparece
   - Card de preview mostra o PNG renderizado
   - Botão de download largo abaixo, com degrade dourado

---

## Observações importantes

- **Não invadir cache em runtime**: a função `fontkit.openSync` é chamada uma vez no import — não chamar dentro do handler. Mesma coisa para os PNGs (Sharp aceita path direto, lê do disco a cada chamada — performance OK pra esse volume).
- **Erro no gerador não pode bloquear o save**: se Sharp falhar, a solicitação ainda é criada e enviada via webhook (apenas sem `pngUrl`). Logar erro para investigação.
- **R2 público**: o bucket de assinaturas já é público (mesmo namespace dos outros assets). URLs são acessíveis sem autenticação.
- **TIPOS_AUTOMACAO**: confirmar que `assinatura-email` continua na lista de `TIPOS_AUTOMACAO` (não cria task no ClickUp). Não mudar essa lista nesta tarefa.

Após o restart, confirmar com curl:

```bash
curl -X POST https://forms.portalsvn.com.br/api/solicitacoes/criar \
  -H "Content-Type: application/json" \
  -d '{"tipo":"assinatura-email","dados":{"nome":"Teste Auto","telefone":"(44) 99999-9999","email":"teste@svninvestimentos.com.br","cfp":false}}'
```

E checar via Drizzle Studio (ou query direta) que `assinatura_png_url` foi populado.
