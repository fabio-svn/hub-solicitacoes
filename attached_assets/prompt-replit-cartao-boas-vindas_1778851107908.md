# Hub de Solicitações SVN — Geração server-side do Cartão de Boas-vindas

Esta tarefa adiciona um segundo gerador de arte server-side, seguindo o mesmo padrão arquitetural do gerador de assinatura de e-mail (Sharp + fontkit + R2 + endpoint que retorna URL). Substitui o fluxo atual que gera o cartão via BannerBear no N8N.

Execução em 7 etapas. Após terminar, `cd artifacts/api-server && pnpm run build` e restart.

---

## Etapa 1 — Adicionar fontes Taviraj Light + Nunito Sans Light

O projeto hoje tem Ivy Journal Light e Roobert PRO TRIAL Light em `assets/fonts/`. O Cartão de Boas-vindas usa **Taviraj Light** e **Nunito Sans Light**, que precisam ser adicionadas.

### 1.1 Instalar via @fontsource

```bash
cd artifacts/api-server
pnpm add @fontsource/taviraj @fontsource/nunito-sans
```

### 1.2 Converter woff2 → TTF e mover para `assets/fonts/`

Criar `scripts/setup-welcome-fonts.ts` (executar uma vez, ou rodar inline):

```ts
import { TTFont } from 'fonttools'; // se não disponível, usar python
// Alternativa: rodar via Python (já validado funcionar)
```

Caminho mais simples — script Python one-shot:

```python
# scripts/convert-welcome-fonts.py
from fontTools.ttLib import TTFont
import os

conversions = [
    ('node_modules/@fontsource/taviraj/files/taviraj-latin-300-normal.woff2',
     'assets/fonts/Taviraj-Light.ttf'),
    ('node_modules/@fontsource/nunito-sans/files/nunito-sans-latin-300-normal.woff2',
     'assets/fonts/NunitoSans-Light.ttf'),
]

for src, dst in conversions:
    font = TTFont(src)
    font.flavor = None
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    font.save(dst)
    print(f'✓ {dst}')
```

Rodar: `python3 scripts/convert-welcome-fonts.py`

Verificar que os arquivos `assets/fonts/Taviraj-Light.ttf` e `assets/fonts/NunitoSans-Light.ttf` foram criados. Commitar.

### 1.3 Limpeza opcional

Se quiser otimizar, depois de gerar os TTFs pode remover `@fontsource/taviraj` e `@fontsource/nunito-sans` do `package.json` — eles serviram só para o setup inicial. Mas pode deixar também, não impacta runtime.

---

## Etapa 2 — Backgrounds locais (assets de teste)

Os PNGs de background ainda não estão hospedados. Por enquanto o usuário vai subir manualmente no Replit pra `assets/cartao_boas_vindas/`:

- `assets/cartao_boas_vindas/bg-welcome-padrao.png` (1446×1770)
- `assets/cartao_boas_vindas/bg-welcome-private.png` (1446×1770)

O service vai ler desses paths locais. Quando os arquivos forem hospedados publicamente, é uma troca de uma variável (similar ao que foi feito na assinatura — paths locais → URLs HTTP com cache).

Garantir que o build do esbuild copie `assets/cartao_boas_vindas/` pro `dist/` (mesmo padrão do `assets/fonts/`).

---

## Etapa 3 — Configurar o tipo de solicitação

Em `config.js` (ou onde estiverem as `CATEGORIAS_SOLICITACAO`), garantir que existe (ou adicionar):

```js
{
  id: 'cartao-boas-vindas',
  label: 'Cartão de Boas-vindas',
  // ... outras propriedades padrão (description, icon, etc.)
}
```

E adicioná-lo em `TIPOS_AUTOMACAO` (mesmo padrão da assinatura de e-mail — não cria task no ClickUp, fluxo direto via webhook → entrega ao cliente).

---

## Etapa 4 — Form

### 4.1 Campos do form

| Campo | Tipo | Obrigatório | Pré-preenchido |
|---|---|---|---|
| Nome do cliente | text | sim | não |
| Nome para assinatura | text | sim | sim (cadastro do usuário) |
| Contrato social | select | sim | não |
| Unidade | text | sim | sim (cadastro do usuário, se houver) |
| Cliente é private? | radio (Sim/Não) | sim | não |

**Opções do select Contrato social:**

```js
[
  { id: 'svn-investimentos', label: 'SVN Investimentos' },
  { id: 'svn-capital',       label: 'SVN Capital' },
  { id: 'svn-connect',       label: 'SVN Connect' },
]
```

(Apenas estas 3 marcas têm cartão de boas-vindas. As outras marcas, se aparecerem em outros forms, não vão neste.)

**Campo Telefone:** seguir a regra global aprovada na rodada anterior — todos os forms têm campo de telefone obrigatório, pré-preenchido do cadastro. Incluir aqui também.

---

## Etapa 5 — Service: `src/services/welcome-card-generator.ts`

Código completo abaixo. Bom material para reutilização: as funções `wrapTextToLines`, `renderTextBuffer` e `compositeMultilineCentered` podem ser extraídas para um `text-rendering-utils.ts` no futuro se for reaproveitar em outros geradores. Por enquanto, tudo inline aqui.

```ts
import sharp from 'sharp';
import fontkit from 'fontkit';
import fs from 'fs';
import path from 'path';

// ============================================================
// FONTES
// ============================================================
const ASSETS_DIR = path.resolve(__dirname, '../../assets');

const fontDisplay = fontkit.openSync(
  path.join(ASSETS_DIR, 'fonts/Taviraj-Light.ttf')
) as any;

const fontBody = fontkit.openSync(
  path.join(ASSETS_DIR, 'fonts/NunitoSans-Light.ttf')
) as any;

// ============================================================
// CANVAS E LAYOUT
// ============================================================
const CANVAS_W = 1446;
const CANVAS_H = 1770;

// Cada item = { x, y, w, fontSize } onde x/y/w definem o BOUNDING BOX
// e o texto é centralizado dentro dele.
const LAYOUT = {
  nomeCliente: {
    x: 338, y: 188, w: 764,
    fontSize: 70,
    font: fontDisplay,
    color: '#FFF8F3', // texto claro sobre fundo escuro
  },
  fraseInicial: {
    x: 296, y: 278, w: 848,
    fontSize: 40,
    font: fontDisplay,
    color: '#FFF8F3',
  },
  mensagem: {
    x: 297, y: 528, w: 847,
    fontSize: 37,
    lineHeight: 50,        // ~1.35x do fontSize, ajuste fino visual
    paragraphSpacing: 25,  // espaço extra entre parágrafos
    font: fontBody,
    color: '#221B19', // texto escuro sobre card paper-white
  },
  fraseBoasVindas: {
    x: 297, y: 1169, w: 847,
    fontSize: 35,
    font: fontBody,
    color: '#221B19', // ainda dentro do card paper-white
  },
  nomeAssinatura: {
    x: 349, y: 1281, w: 743,
    fontSize: 40,
    font: fontDisplay,
    color: '#FFF8F3', // texto claro sobre fundo escuro
  },
  unidade: {
    x: 349, y: 1346, w: 743,
    fontSize: 40,
    font: fontDisplay,
    color: '#FFF8F3',
  },
  logo: {
    x: 419, y: 1585, w: 603, h: 62,
  },
};

// ============================================================
// CONTEÚDO PRÉ-DEFINIDO
// ============================================================
const FRASE_INICIAL = 'Que privilégio ter você conosco na SVN!';

const PARAGRAFO_1 = 'Acreditamos que cada cliente é único e estamos dedicados a entender suas necessidades, fornecendo a assessoria necessária para maximizar seus resultados financeiros. Nossa equipe de especialistas está sempre à disposição para oferecer consultoria de qualidade, análise de mercado e estratégias de investimento sob medida.';

const PARAGRAFO_2_TEMPLATE = (contratoLabel: string) =>
  `Na ${contratoLabel}, nossa missão é proporcionar as melhores soluções financeiras e orientações personalizadas para alcançar seus objetivos de investimento. Nosso compromisso é com a transparência, a confiança e a excelência no atendimento.`;

const PARAGRAFO_3 = 'Estamos animados para iniciar esta jornada com você!';

const FRASE_BOAS_VINDAS_TEMPLATE = (contratoLabel: string) =>
  `Bem-vindo(a) à ${contratoLabel}.`;

// ============================================================
// MAPPING DE LOGOS (reutiliza os assets da assinatura)
// ============================================================
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

// Cache de assets remotos (reaproveitar se já existir helper similar do gerador de assinatura)
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

// ============================================================
// UTILITÁRIOS DE TEXTO
// ============================================================
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
  font: any,
  text: string,
  fontSize: number,
  fill: string
): Promise<{ buffer: Buffer; width: number; ascent: number }> {
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

/**
 * Compõe uma linha de texto centralizada dentro de uma bounding box.
 */
async function compositeCenteredLine(
  composites: sharp.OverlayOptions[],
  cfg: { x: number; y: number; w: number; fontSize: number; font: any; color: string },
  text: string
) {
  const { buffer, width } = await renderTextBuffer(cfg.font, text, cfg.fontSize, cfg.color);
  const left = Math.round(cfg.x + (cfg.w - width) / 2);
  const top = topForText(cfg.font, cfg.fontSize, cfg.y);
  composites.push({ input: buffer, top, left });
}

/**
 * Compõe um bloco de texto multilinha com quebra automática e
 * centralização horizontal. Múltiplos parágrafos separados por \n\n.
 */
async function compositeMultilineCentered(
  composites: sharp.OverlayOptions[],
  cfg: {
    x: number; y: number; w: number;
    fontSize: number; lineHeight: number; paragraphSpacing: number;
    font: any; color: string;
  },
  text: string
) {
  const paragraphs = text.split(/\n\n+/);
  let yCursor = cfg.y;

  for (let p = 0; p < paragraphs.length; p++) {
    const lines = wrapTextToLines(cfg.font, paragraphs[p], cfg.fontSize, cfg.w);
    for (const line of lines) {
      const { buffer, width } = await renderTextBuffer(cfg.font, line, cfg.fontSize, cfg.color);
      const left = Math.round(cfg.x + (cfg.w - width) / 2);
      const top = topForText(cfg.font, cfg.fontSize, yCursor);
      composites.push({ input: buffer, top, left });
      yCursor += cfg.lineHeight;
    }
    if (p < paragraphs.length - 1) {
      yCursor += cfg.paragraphSpacing;
    }
  }
}

// ============================================================
// API PÚBLICA
// ============================================================
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

  // 1) Background
  const bgFile = input.isPrivate ? 'bg-welcome-private.png' : 'bg-welcome-padrao.png';
  const bgPath = path.join(ASSETS_DIR, 'cartao_boas_vindas', bgFile);
  if (!fs.existsSync(bgPath)) {
    throw new Error(`Background não encontrado: ${bgPath}`);
  }

  // 2) Logo (resize pro tamanho final)
  const logoUrl = LOGO_URLS[input.contratoSocial];
  const logoRaw = await getRemoteAsset(logoUrl);
  const logoBuf = await sharp(logoRaw)
    .resize(LAYOUT.logo.w, LAYOUT.logo.h, { fit: 'contain' })
    .toBuffer();

  // 3) Texto da mensagem com contrato social adaptado
  const mensagemFinal = [
    PARAGRAFO_1,
    PARAGRAFO_2_TEMPLATE(contratoLabel),
    PARAGRAFO_3,
  ].join('\n\n');

  const fraseBoasVindas = FRASE_BOAS_VINDAS_TEMPLATE(contratoLabel);

  // 4) Montar composição
  const composites: sharp.OverlayOptions[] = [];

  await compositeCenteredLine(composites, LAYOUT.nomeCliente, input.nomeCliente);
  await compositeCenteredLine(composites, LAYOUT.fraseInicial, FRASE_INICIAL);
  await compositeMultilineCentered(composites, LAYOUT.mensagem, mensagemFinal);
  await compositeCenteredLine(composites, LAYOUT.fraseBoasVindas, fraseBoasVindas);
  await compositeCenteredLine(composites, LAYOUT.nomeAssinatura, input.nomeAssinatura);
  await compositeCenteredLine(composites, LAYOUT.unidade, input.unidade);

  // Logo: blend 'screen' pra tratar fundo preto do asset como transparente
  composites.push({
    input: logoBuf,
    top: LAYOUT.logo.y,
    left: LAYOUT.logo.x,
    blend: 'screen',
  });

  // 5) Render final
  return await sharp(bgPath)
    .composite(composites)
    .png()
    .toBuffer();
}
```

---

## Etapa 6 — Integração com o handler do form

No handler que recebe o submit do form de Cartão de Boas-vindas:

```ts
import { gerarCartaoBoasVindas } from '../services/welcome-card-generator';
import { uploadToR2 } from '../services/r2';

// dentro do POST handler, depois de salvar a solicitação
if (tipo === 'cartao-boas-vindas') {
  try {
    const pngBuffer = await gerarCartaoBoasVindas({
      nomeCliente:    dados.nome_cliente,
      nomeAssinatura: dados.nome_assinatura,
      unidade:        dados.unidade,
      contratoSocial: dados.contrato_social,
      isPrivate:      dados.cliente_private === true || dados.cliente_private === 'sim',
    });

    const key = `cartoes-boas-vindas/${solicitacao.id}.png`;
    const url = await uploadToR2(key, pngBuffer, 'image/png');

    await db.update(solicitacoes)
      .set({ artefato_url: url })
      .where(eq(solicitacoes.id, solicitacao.id));

    webhookPayload.artefatoUrl = url;
  } catch (err) {
    console.error('[cartao-boas-vindas] erro ao gerar PNG:', err);
    // não bloqueia criação da solicitação
  }
}
```

**Sobre a coluna de URL:** se o schema atual já tem `assinatura_png_url` (criada na rodada da assinatura), **renomear pra `artefato_url`** (mais genérico) ou criar uma coluna nova `cartao_boas_vindas_url`. Recomendo a primeira opção — coluna única `artefato_url` serve pra qualquer tipo de arte gerada. Se preferir manter separado por tipo, criar uma nova coluna. Decisão do agente; só ser consistente.

---

## Etapa 7 — Resumo da solicitação

Aplicar mesmo tratamento visual da assinatura de e-mail (rodada anterior): título grande "Cartão de Boas-vindas" + "Material disponível" + data + card sem fundo branco com preview + botão dourado "Fazer download".

A condição que renderiza esse layout deve incluir o tipo `cartao-boas-vindas` (não só `assinatura-email`). Refatorar o check pra um helper tipo `isArtefatoGerado(tipo)` que retorna true pra ambos, ou similar — evita repetição.

---

## Build e validação

```bash
cd artifacts/api-server && pnpm run build
# Restart
```

### Smoke tests

1. **Setup das fontes**: confirmar que `assets/fonts/Taviraj-Light.ttf` e `NunitoSans-Light.ttf` existem após o passo 1. Service carrega sem erro.

2. **Geração padrão (não-private)**: criar uma solicitação com:
   - Nome cliente: `João da Silva`
   - Nome assinatura: `Maria Santos`
   - Unidade: `SVN Maringá`
   - Contrato: SVN Investimentos
   - Private: Não

   Resultado esperado: PNG 1446×1770 com bg padrão, todos os textos legíveis e centralizados, logo SVN Investimentos no rodapé.

3. **Geração private**: mesmo teste com Private: Sim → bg deve ser `bg-welcome-private.png`.

4. **Adaptação do contrato social**: gerar com SVN Capital → conferir que:
   - Parágrafo 2 da mensagem começa com "Na SVN Capital, nossa missão..."
   - Frase de boas-vindas é "Bem-vindo(a) à SVN Capital."
   - Logo é o do SVN Capital

5. **Nome longo**: gerar com `Maria Aparecida dos Santos Albuquerque Júnior` como nome do cliente — o texto é renderizado em fonte 70px com largura disponível de 764px. Pode acabar overflowando o box. **Observação:** este gerador ainda NÃO tem auto-fit pra nome (diferente da assinatura). Se você quer auto-fit aqui também, me avisa que adiciono depois. Por enquanto, nome longo simplesmente excede o box (fica feio mas não quebra).

6. **Acentuação correta**: confirmar que `ã`, `é`, `ô` etc. renderizam corretamente em ambas as fontes.

7. **Quebra de linha da mensagem**: olhar visualmente que os parágrafos quebram em pontos razoáveis (sem cortar palavras estranhamente) e que há respiração suficiente entre eles.

### Validação visual

Comparar o resultado com o mockup do design enviado pelo usuário (`welcome.png`). Diferenças aceitáveis: pequenos ajustes de baseline ou kerning. Diferenças não-aceitáveis: textos cortados, sobrepostos, fora do canvas, ou desalinhados em relação ao bg.

Se algum elemento estiver visualmente fora do lugar, o ajuste é micro: mexer no `y` do `LAYOUT` correspondente.
