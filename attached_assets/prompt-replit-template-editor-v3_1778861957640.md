# Hub SVN — Template Editor v3: doc properties, variant fields inteligentes, switch, undo/redo

6 melhorias no template editor. Algumas são UX, outras estruturais. Executar na ordem.

---

## Etapa 1 — Painel "Propriedades do Documento"

Hoje, propriedades como canvas size, tipo e bg config só podem ser editadas por SQL direto. Adicionar uma seção no editor.

### 1.1 UI

Adicionar uma aba/seção no painel direito chamada **"Documento"**, separada do painel de "Propriedades da layer". Acessível via toggle no topo do painel direito:

```
┌─ Painel direito ─────────────────┐
│ [ Layer ] [ Documento ]          │
│ ─────────────────────────────────│
│ (conteúdo da aba selecionada)    │
└──────────────────────────────────┘
```

Aba "Documento" mostra:

- **Nome do template** (input)
- **Tipo / Form associado** (select com tipos conhecidos: `cartao-boas-vindas`, `assinatura-email`, `cartao-comemorativo`, etc. + opção "Criar novo tipo")
- **Canvas**
  - Largura (input numérico)
  - Altura (input numérico)
  - Presets: `1080×1080 (Insta quadrado)`, `1080×1350 (Insta 4:5)`, `1080×1920 (Story)`, `1446×1770 (Cartão BV)`, `4078×988 (Assinatura email)`, `Custom`
- **Background**
  - Tipo: `static` ou `variant` (radio)
  - Se `static`: input de URL única
  - Se `variant`: ver Etapa 2 (variant fields inteligentes)
- **Placeholders disponíveis** (read-only, derivado do tipo selecionado)

Quando o usuário muda canvas dimensions, o canvas no editor atualiza imediatamente (com fit-to-view re-aplicado).

### 1.2 Botão "Mudar tipo"

Importante: trocar o `tipo` de um template existente é uma operação delicada (afeta qual form usa esse template). Mostrar warning antes de salvar a mudança:

> "Mudar o tipo de 'cartao-boas-vindas' para 'cartao-comemorativo' pode quebrar a associação com o form atual. Confirma?"

---

## Etapa 2 — Variant fields inteligentes

Hoje, configurar uma imagem como `variant` requer digitar `key=url` num textarea. Substituir por UI estruturada.

### 2.1 Schema de opções conhecidas por campo

Adicionar em `admin-templates.html` (ou em um JS shared):

```js
// Mapeamento de campos com opções pré-definidas
const FIELD_OPTIONS = {
  'contrato_social': [
    { value: 'svn-investimentos', label: 'SVN Investimentos' },
    { value: 'svn-capital',       label: 'SVN Capital' },
    { value: 'svn-connect',       label: 'SVN Connect' },
  ],
  'marca': [
    { value: 'svn-investimentos',                 label: 'SVN Investimentos' },
    { value: 'svn-capital',                       label: 'SVN Capital' },
    { value: 'svn-connect',                       label: 'SVN Connect' },
    { value: 'svn-gestao',                        label: 'SVN Gestão' },
    { value: 'svn-global',                        label: 'SVN Global' },
    { value: 'svn-imb',                           label: 'SVN IMB' },
    { value: 'svn-agro-cambio-commodities',       label: 'SVN Agro/Câmbio/Commodities' },
    { value: 'svn-protecao-patrimonial',          label: 'SVN Proteção Patrimonial' },
    { value: 'svn-wealth-planning',               label: 'SVN Wealth Planning' },
  ],
  'is_private_key': [
    { value: 'padrao',  label: 'Padrão' },
    { value: 'private', label: 'Private' },
  ],
  'tem_cfp': [
    { value: 'sim', label: 'Sim' },
    { value: 'nao', label: 'Não' },
  ],
};
```

### 2.2 UI quando layer image/bg está em modo `variant`

Em vez do textarea atual `key=url`:

```
Tipo da imagem: [variant ▾]

Campo variável: [contrato_social ▾]  ← dropdown dos campos disponíveis

Variantes:
  SVN Investimentos    [URL_____________________________]
  SVN Capital          [URL_____________________________]
  SVN Connect          [URL_____________________________]
```

- Ao trocar `variant_source`, a UI auto-popula inputs pra cada opção conhecida do campo
- Se o campo não está em `FIELD_OPTIONS` (campo custom), volta pro modo manual (textarea key=url)
- Os labels usam o `label` humanizado, mas o `key` salvo no config é o `value`

### 2.3 Mesma lógica pra bg variants

Quando o usuário escolhe `variant` no tipo de background na aba Documento, exibir a mesma interface estruturada.

---

## Etapa 3 — Switch de variantes no canvas

Adicionar uma barra de switches no topo do canvas (entre toolbar e a área de render) que permite testar as variações sem precisar editar manualmente o painel "Dados de teste".

### 3.1 Detecção automática dos variant_sources

Ao carregar um template, percorrer:
- `bg.variant_source` (se houver)
- Todas as `layers[].source.variant_source` (de layers tipo image)

Coletar todos os variant_sources únicos. Pra cada um, mostrar um grupo de botões.

### 3.2 Layout dos switches

```
┌─ Switches (topo do canvas) ────────────────────────────┐
│ contrato_social: [ Investimentos ][ Capital ][ Connect ]│
│ is_private_key:  [ Padrão       ][ Private          ]   │
└────────────────────────────────────────────────────────┘
```

- Botão da opção atualmente ativa fica destacado
- Click em outro botão → atualiza `testData[variant_source] = value` → dispara render automático
- Usar labels humanizados (do `FIELD_OPTIONS`)

Se o campo tem 2 opções: pill toggle. Se tem 3+: row de botões.

---

## Etapa 4 — Undo/Redo com history

### 4.1 Modelo de history

Estado history em memória:
```js
let history = [];        // array de snapshots de currentTemplate
let historyIndex = -1;   // posição atual
const MAX_HISTORY = 50;
```

### 4.2 Quando registrar uma entrada

Cada **ação lógica** registra um snapshot:
- Após drag end de uma layer
- Após resize end
- Após mudança de propriedade (debounced 500ms — pra não criar 1 entry por keystroke)
- Adicionar / deletar / duplicar layer
- Adicionar / deletar variante
- Mudança no documento (canvas, tipo, bg config)

```js
function pushHistory() {
  // Trunca o "futuro" se estiver no meio (refazer foi feito antes)
  history = history.slice(0, historyIndex + 1);
  // Snapshot profundo
  history.push(JSON.parse(JSON.stringify(currentTemplate)));
  // Limita tamanho
  if (history.length > MAX_HISTORY) history.shift();
  historyIndex = history.length - 1;
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  currentTemplate = JSON.parse(JSON.stringify(history[historyIndex]));
  reRender(); // canvas, propriedades, layers list, etc.
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  currentTemplate = JSON.parse(JSON.stringify(history[historyIndex]));
  reRender();
}
```

### 4.3 Atalhos de teclado

```js
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Z = undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); undo();
  }
  // Ctrl/Cmd + Shift + Z = redo (Mac) ou Ctrl + Y (Windows)
  if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
      ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
    e.preventDefault(); redo();
  }
});
```

### 4.4 Botões visuais na toolbar

Adicionar ao lado do botão Salvar:

```
[↶ Desfazer] [↷ Refazer]
```

Disabled quando não há undo/redo disponível.

### 4.5 Considerações

- Undo NÃO afeta o painel "Dados de teste" nem o variant switch (testData é separado, ephemeral)
- Undo NÃO mexe no que foi salvo no DB — só no estado local. Pra reverter um save, salvar de novo.
- Quando o usuário salva, **opcional**: limpar history. Ou manter — é só decisão de UX. Recomendo manter, assim user pode dar undo depois de salvar acidentalmente.

---

## Etapa 5 — Confirmações de save

### 5.1 Toast de sucesso

Após save bem-sucedido, mostrar toast no canto da tela:

```
┌──────────────────────────────────┐
│ ✓ Template salvo                 │
└──────────────────────────────────┘
```

- Auto-some após 3 segundos
- Visual: fundo verde-suave, ícone de check
- Posição: canto superior direito, abaixo do header

Implementar como componente simples:
```js
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.classList.add('fade-out'); }, 2500);
  setTimeout(() => toast.remove(), 3000);
}
```

### 5.2 Modal ao tentar sair com mudanças não salvas

Quando o usuário clica em **"Voltar"** com `isDirty === true`, abrir modal:

```
┌──────────────────────────────────────────────┐
│  Há mudanças não salvas                       │
│                                               │
│  Se você sair agora, suas alterações serão   │
│  perdidas. Deseja salvar antes de sair?      │
│                                               │
│       [Sair sem salvar]  [Cancelar]  [Salvar]│
└──────────────────────────────────────────────┘
```

- `Sair sem salvar` → volta pra lista, descarta mudanças
- `Cancelar` → fecha modal, permanece no editor
- `Salvar` → executa save, se sucesso, volta pra lista

Mesma lógica em outros pontos de "saída":
- Trocar pra outro template (não aplicável agora — sem switcher interno)
- Recarregar página → o `beforeunload` listener já cuida

### 5.3 Toast de erro

Se save falhar, toast vermelho:

```
┌──────────────────────────────────┐
│ ✗ Erro ao salvar: <mensagem>     │
└──────────────────────────────────┘
```

Permanece por 5 segundos (mais tempo pro user ler o erro).

---

## Etapa 6 — Melhorias no alignment

### 6.1 Vertical alignment pra text-blocks

Atualmente o text-block só tem horizontal align (left/center/right). Adicionar vertical align:

```ts
// no schema TextBlockLayer
vertical_align?: 'top' | 'middle' | 'bottom'; // default: 'top'
```

Na rendering function `renderTextBlock`, calcular yCursor inicial baseado no vertical_align:

```ts
async function renderTextBlock(layer, data, composites) {
  const text = substitute(layer.content, data);
  const font = getFont(layer.font_family);
  const paragraphs = text.split(/\n\n+/);

  // Pre-calcular altura total do conteúdo
  let totalLines = 0;
  const wrappedParagraphs = paragraphs.map(p => {
    const lines = wrapTextToLines(font, p, layer.font_size, layer.w);
    totalLines += lines.length;
    return lines;
  });
  const contentHeight = totalLines * layer.line_height + (paragraphs.length - 1) * layer.paragraph_spacing;

  // yCursor inicial baseado em vertical_align
  let yCursor = layer.y;
  if (layer.vertical_align === 'middle') {
    yCursor = layer.y + (layer.h - contentHeight) / 2;
  } else if (layer.vertical_align === 'bottom') {
    yCursor = layer.y + layer.h - contentHeight;
  }

  // renderiza linhas...
}
```

### 6.2 UI dos controles de alinhamento

No painel de propriedades de uma text-block, mostrar dois conjuntos de botões:

```
Alinhamento horizontal:    [ ← ] [ ↔ ] [ → ]
Alinhamento vertical:      [ ↑ ] [ ↕ ] [ ↓ ]
```

Pra text-line, só horizontal (faz sentido).

---

## Build e validação

```bash
cd artifacts/api-server && pnpm run build
# Restart
```

### Smoke tests

1. **Aba Documento**: editar template, toggle pra "Documento", mudar canvas pra 1080×1080 → canvas redimensiona ao vivo
2. **Variant inteligente**: criar nova layer image → tipo `variant` → escolher `contrato_social` como source → 3 inputs aparecem auto (Investimentos, Capital, Connect)
3. **Switch de variantes**: no Cartão BV, switches `contrato_social` e `is_private_key` aparecem acima do canvas → click em "Connect" → preview atualiza com logo do Connect → click em "Private" → bg muda pra private
4. **Undo**: arrastar uma layer → Ctrl+Z → volta pra posição anterior. Mudar fonte → Ctrl+Z → volta. Botões na toolbar refletem disponibilidade.
5. **Redo**: após undo, Ctrl+Shift+Z → reaplica mudança
6. **Toast de save**: clicar Salvar → toast verde "✓ Template salvo" aparece e some em 3s
7. **Modal de unsaved**: editar algo → clicar Voltar → modal aparece com 3 opções → "Cancelar" fecha o modal → editor permanece
8. **Vertical align**: text-block → propriedade `vertical_align: middle` → preview mostra conteúdo centralizado verticalmente

### Edge cases

- Template sem variant_source nenhum (todos static) → barra de switches não aparece (vazia)
- History excede 50 entries → primeiras são descartadas
- Undo após save → ainda funciona (não limpa history)
- Mudar canvas dimensions com layers fora dos novos bounds → não bloquear, mas mostrar visual warning (border vermelha na layer)
