# Hub de Solicitações SVN — Ajustes finais Assinatura de E-mail

Três mudanças nesta tarefa: dois ajustes visuais e a migração dos assets para URLs remotas no servidor.

---

## Mudança 1 — Diminuir o tamanho do título no resumo

Hoje o título "Assinatura de e-mail" está muito grande em relação ao restante do hub. Padronizar com o tamanho dos títulos das outras páginas do sistema.

Localizar o estilo do título do resumo de outras solicitações (ex.: ao abrir o resumo de uma solicitação de Cartão de Visita ou Brindes) e usar o mesmo `font-size` e `font-weight`. **Não** criar tamanho custom — replicar 1:1 o que já existe.

A diferença vai ser substancial: provavelmente cai de algo como 48-56px para ~28-32px.

## Mudança 2 — Diminuir altura do botão de download (página de resumo)

O botão "Fazer download" está muito alto. Reduzir altura mantendo:

- Largura full (ocupa a mesma largura do card da assinatura acima)
- Degrade dourado existente
- Ícone + texto na mesma linha
- Padding vertical menor: ~14-18px (em vez dos 64-72px de altura total atual)
- Pode buscar a referência de altura do botão "Enviar" dos formulários, que tem o tamanho ideal — replicar.

Não mudar o botão da lista (pill compacta), que já está OK.

---

## Mudança 3 — Migrar assets para URLs remotas + suportar múltiplas marcas

Os assets de assinatura agora estão hospedados no servidor. Remover os PNGs do diretório local (`assets/assinatura/svn-investimentos/`) e refatorar o service para buscar das URLs com cache em memória.

### 3.1 URLs dos assets

Base: `https://solicitacoes.portalsvn.com.br/assinatura_email/`

**Compartilhados** (todas as marcas usam os mesmos):
- `bg_assinatura.png` — background do canvas
- `assinatura_linha.png` — separador vertical
- `assinatura_selos.png` — Melhor Escritório + G20
- `assinatura_selo_cfp.png` — selo CFP

**Logos por marca:**

| ID da marca (no config.js) | URL do logo |
|---|---|
| `svn-investimentos` | `assinaturas_assinatura_logo_svn.png` *(ou `assinaturas_assinatura_svn.png` — confirmar visualmente qual é a versão com "SVN Investimentos \| XP")* |
| `svn-capital` | `assinaturas_assinatura_logo_svn_capital.png` |
| `svn-connect` | `assinaturas_assinatura_logo_svn_connect.png` |
| `svn-gestao` | `assinaturas_assinatura_logo_svn_gestao.png` |
| `svn-global` | `assinaturas_assinatura_logo_svn_global.png` |
| `svn-imb` | `assinaturas_assinatura_logo_svn_imb.png` |
| `svn-agro-cambio-commodities` | `assinaturas_assinatura_logo_svn_agro_cambio_commodities.png` |
| `svn-protecao-patrimonial` | `assinaturas_assinatura_logo_svn_protecaopatrimonial.png` |
| `svn-wealth-planning` | `assinaturas_assinatura_logo_svn_wealthplanning.png` |

Se os IDs no `config.js` forem diferentes (ex.: `svn_capital` com underscore em vez de hífen), ajustar o mapping pra bater com os valores reais que chegam do form.

### 3.2 Refatorar o asset loading no service

Em `src/services/assinatura-generator.ts`, substituir a estratégia de paths locais por fetch + cache em memória.

**No topo do módulo**, adicionar:

```ts
const ASSETS_BASE = 'https://solicitacoes.portalsvn.com.br/assinatura_email';

const SHARED_URLS = {
  bg:    `${ASSETS_BASE}/bg_assinatura.png`,
  linha: `${ASSETS_BASE}/assinatura_linha.png`,
  selos: `${ASSETS_BASE}/assinatura_selos.png`,
  cfp:   `${ASSETS_BASE}/assinatura_selo_cfp.png`,
};

const LOGO_URLS: Record<string, string> = {
  'svn-investimentos':           `${ASSETS_BASE}/assinaturas_assinatura_logo_svn.png`,
  'svn-capital':                 `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_capital.png`,
  'svn-connect':                 `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_connect.png`,
  'svn-gestao':                  `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_gestao.png`,
  'svn-global':                  `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_global.png`,
  'svn-imb':                     `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_imb.png`,
  'svn-agro-cambio-commodities': `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_agro_cambio_commodities.png`,
  'svn-protecao-patrimonial':    `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_protecaopatrimonial.png`,
  'svn-wealth-planning':         `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_wealthplanning.png`,
};

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
```

**No `gerarAssinatura`**, substituir os paths de arquivo no `composites` por buffers do cache:

```ts
export async function gerarAssinatura(input: AssinaturaInput): Promise<AssinaturaResult> {
  const marca = input.marca ?? 'svn-investimentos';
  const logoUrl = LOGO_URLS[marca];
  if (!logoUrl) {
    throw new Error(`Marca desconhecida: ${marca}`);
  }

  // Buscar todos os assets (cache automático)
  const [bgBuf, logoBuf, linhaBuf, selosBuf, cfpBuf] = await Promise.all([
    getAsset(SHARED_URLS.bg),
    getAsset(logoUrl),
    getAsset(SHARED_URLS.linha),
    getAsset(SHARED_URLS.selos),
    input.temCFP ? getAsset(SHARED_URLS.cfp) : Promise.resolve(null as Buffer | null),
  ]);

  // ... auto-fit, render text (igual antes)

  const composites: sharp.OverlayOptions[] = [
    { input: logoBuf,   top: LAYOUT.logo.y,  left: LAYOUT.logo.x,  blend: 'screen' },
    { input: linhaBuf,  top: LAYOUT.linha.y, left: LAYOUT.linha.x, blend: 'screen' },
    { input: nomeBuf,   top: topForText(fontDisplay, fitNome.size,  LAYOUT.nome.y_top),  left: LAYOUT.nome.x },
    { input: telBuf,    top: topForText(fontBody,    FONT_SIZES.tel, LAYOUT.tel.y_top),  left: LAYOUT.tel.x },
    { input: emailBuf,  top: topForText(fontBody,    fitEmail.size, LAYOUT.email.y_top), left: LAYOUT.email.x },
    { input: selosBuf,  top: LAYOUT.selos.y, left: LAYOUT.selos.x, blend: 'screen' },
  ];

  if (input.temCFP && cfpBuf) {
    composites.push({ input: cfpBuf, top: LAYOUT.cfp.y, left: LAYOUT.cfp.x, blend: 'screen' });
  }

  const pngBuffer = await sharp(bgBuf)
    .composite(composites)
    .png()
    .toBuffer();

  return { pngBuffer, fitNome, fitEmail };
}
```

**Notas técnicas:**

- `fetch` é built-in no Node 18+ (não precisa instalar `node-fetch`).
- Cache em memória persiste pela vida do processo. Como o servidor não restart com frequência, isso é OK. Primeira solicitação após restart faz fetch dos assets necessários (latência única de ~50-200ms dependendo da rede).
- Se quiser pré-aquecer o cache no boot, pode chamar `Promise.all(Object.values(SHARED_URLS).map(getAsset))` no início do servidor — mas não é necessário.
- `sharp(bgBuf)` aceita Buffer direto como input — mesmo comportamento que com path de arquivo.

### 3.3 Limpar assets locais

Remover do repo:
- Diretório `artifacts/api-server/assets/assinatura/` inteiro (e qualquer subdiretório `svn-investimentos/`, `svn-capital/` etc).
- Atualizar o script de cópia do esbuild (`cpSync('assets', 'dist/assets')`) — pode manter, mas o diretório `assets/assinatura/` não existirá mais. Apenas `assets/fonts/` precisa continuar sendo copiado.

### 3.4 Confirmar visualmente o logo de SVN Investimentos

Como mencionei acima, há duas URLs candidatas para `svn-investimentos`:

- `assinaturas_assinatura_logo_svn.png`
- `assinaturas_assinatura_svn.png`

Após o deploy, gerar uma assinatura de teste com marca `svn-investimentos` e conferir se o logo renderizado é o "SVN Investimentos | XP" (com o "Investimentos" escrito por extenso e o badge XP). Se vier um logo diferente, trocar para a outra URL.

---

## Build e validação

```bash
cd artifacts/api-server && pnpm run build
# Restart
```

### Testes manuais

1. **Resumo da solicitação**: abrir uma solicitação concluída de assinatura.
   - Título "Assinatura de e-mail" tem o mesmo tamanho dos títulos das outras solicitações (não maior).
   - Botão "Fazer download" mais baixo, proporcional ao botão "Enviar" do form.

2. **Gerar nova assinatura** com cada marca disponível no form (uma de cada vez):
   - SVN Investimentos → confere logo correto
   - SVN Capital → confere logo correto
   - SVN Connect → confere logo correto
   - (... e assim por diante para as outras marcas)
   - Selos da direita devem ser os mesmos em todas (Melhor Escritório + G20)

3. **Performance**: a primeira geração após restart pode demorar 200-500ms a mais (fetch dos assets). A partir da segunda geração, deve ser tão rápido quanto antes (cache em memória).

4. **Erro de marca inválida**: tentar gerar com uma marca não mapeada → service deve lançar `Error("Marca desconhecida: X")` e a criação da solicitação continua (sem PNG, com log de erro no console).
