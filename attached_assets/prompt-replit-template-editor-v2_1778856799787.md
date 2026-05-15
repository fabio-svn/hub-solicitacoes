# Hub SVN — Evolução do Template Editor: landing, múltiplos templates, live preview

Esta tarefa amplia o template editor recém-implementado com 4 melhorias estruturais:

1. **Landing page** ao abrir a tab "Templates de Arte"
2. **Múltiplos templates por tipo** com um marcado como ativo
3. **Fluxo de criação** de novos templates
4. **Live preview** com debounce (sem botão manual)

Executar na ordem. Build + restart no final.

---

## Etapa 1 — Schema: múltiplos templates por tipo

### 1.1 Migration

Hoje a tabela `art_templates` tem `tipo` como UNIQUE. Mudar pra permitir múltiplos templates por tipo, com apenas um marcado como ativo.

```sql
-- Remover constraint unique
ALTER TABLE art_templates DROP CONSTRAINT IF EXISTS art_templates_tipo_unique;
ALTER TABLE art_templates DROP CONSTRAINT IF EXISTS art_templates_tipo_key;

-- Novas colunas
ALTER TABLE art_templates ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE art_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE art_templates ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Backfill: marcar templates atuais como ativos (já que são os únicos)
UPDATE art_templates SET is_active = true WHERE name IS NULL;
UPDATE art_templates SET name = CONCAT('Default ', tipo) WHERE name IS NULL;

-- Partial unique index: apenas um ativo por tipo
CREATE UNIQUE INDEX IF NOT EXISTS art_templates_active_per_tipo
ON art_templates(tipo) WHERE is_active = true;
```

Atualizar o schema Drizzle correspondente. Os tipos ficam:

```ts
type ArtTemplateRow = {
  id: number;
  tipo: string;
  name: string;
  config: ArtTemplate;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  updated_by: number | null;
};
```

### 1.2 Form handler update

Em todos os handlers que usam template (cartao-boas-vindas, assinatura-email), trocar a query:

```ts
// Antes:
const template = await db.query.artTemplates.findFirst({
  where: eq(artTemplates.tipo, 'cartao-boas-vindas'),
});

// Depois:
const template = await db.query.artTemplates.findFirst({
  where: and(
    eq(artTemplates.tipo, 'cartao-boas-vindas'),
    eq(artTemplates.is_active, true)
  ),
});

if (!template) throw new Error('Nenhum template ativo para cartao-boas-vindas');
```

---

## Etapa 2 — Endpoints: refactor para ID-based

### 2.1 Endpoints

Trocar de path por `:tipo` para path por `:id` (mais correto para múltiplos templates), e adicionar criação e ativação.

| Endpoint | Descrição |
|---|---|
| `GET /api/admin/art-templates` | Lista todos os templates (agrupados ou não), com `id`, `tipo`, `name`, `is_active`, `created_at`, `updated_at` (sem o config inteiro pra ser leve) |
| `GET /api/admin/art-templates/:id` | Template completo com config |
| `POST /api/admin/art-templates` | Cria novo. Body: `{ tipo, name, config }`. Não marca como ativo automaticamente |
| `PUT /api/admin/art-templates/:id` | Atualiza um template. Body: `{ name?, config? }`. Não muda `is_active` |
| `PATCH /api/admin/art-templates/:id/activate` | Marca este como ativo. Desativa outros do mesmo `tipo` (transação) |
| `DELETE /api/admin/art-templates/:id` | Deleta. Rejeitar se for o único ativo do seu tipo |
| `POST /api/admin/art-templates/:id/duplicate` | Cria cópia. Body: `{ name }`. Mantém `tipo`, gera nome novo, `is_active=false` |
| `POST /api/admin/art-templates/preview` | Preview ad-hoc. Body: `{ config, data }`. Não persiste nada |
| `GET /api/admin/art-templates/sample-data/:tipo` | Dados de teste pré-populados pra esse tipo |

Todos com middleware `requireAdmin`.

### 2.2 Validação de ativação

```ts
// PATCH /:id/activate — pseudocódigo
await db.transaction(async (tx) => {
  const target = await tx.query.artTemplates.findFirst({ where: eq(artTemplates.id, id) });
  if (!target) throw new Error('Template não encontrado');
  await tx.update(artTemplates)
    .set({ is_active: false })
    .where(eq(artTemplates.tipo, target.tipo));
  await tx.update(artTemplates)
    .set({ is_active: true })
    .where(eq(artTemplates.id, id));
});
```

---

## Etapa 3 — Frontend: refatorar `/admin/templates`

Refazer toda a estrutura de navegação dentro da página de templates. Three views (state-based, não routes):

### 3.1 View "landing" — padrão ao abrir

Tela inicial limpa com 2 cards/botões grandes:

```
┌──────────────────────────────────────────────────────────┐
│   TEMPLATES DE ARTE                                      │
│                                                          │
│   ┌────────────────────┐    ┌────────────────────┐      │
│   │                    │    │                    │      │
│   │   ✚  Criar         │    │   ✎  Editar        │      │
│   │      nova arte     │    │      arte existente│      │
│   │                    │    │                    │      │
│   │   Comece um        │    │   Veja, edite ou   │      │
│   │   template do      │    │   ative templates  │      │
│   │   zero             │    │   já criados       │      │
│   │                    │    │                    │      │
│   └────────────────────┘    └────────────────────┘      │
└──────────────────────────────────────────────────────────┘
```

- Click em "Criar" → view "create"
- Click em "Editar" → view "list"

### 3.2 View "list" — listagem de templates existentes

```
┌──────────────────────────────────────────────────────────┐
│  ← Voltar                          Templates existentes  │
│                                                          │
│  CARTÃO DE BOAS-VINDAS                                   │
│  ┌────────────────────────────────────────────────┐     │
│  │ ● Default cartao-boas-vindas      [ATIVO]      │     │
│  │   Atualizado há 2 dias              [Editar →] │     │
│  └────────────────────────────────────────────────┘     │
│  ┌────────────────────────────────────────────────┐     │
│  │ ○ Variação A — cartão minimalista              │     │
│  │   Atualizado há 1h              [Editar] [Ativar]│   │
│  └────────────────────────────────────────────────┘     │
│                                                          │
│  ASSINATURA DE E-MAIL                                    │
│  ┌────────────────────────────────────────────────┐     │
│  │ ● Default assinatura-email        [ATIVO]      │     │
│  │   Atualizado há 1 semana            [Editar →] │     │
│  └────────────────────────────────────────────────┘     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- Templates agrupados por `tipo`
- "Ativo" destacado visualmente (badge dourado/verde, círculo cheio)
- "Inativo" mais discreto (círculo vazio)
- Botões por linha: `Editar`, `Ativar` (só pros inativos), `Duplicar`, `Deletar`
- Click em "Editar" → view "editor" com aquele template carregado

### 3.3 View "create" — formulário de criação

```
┌──────────────────────────────────────────────────────────┐
│  ← Voltar                            Criar novo template │
│                                                          │
│  Tipo de arte *                                          │
│  [Select: cartao-boas-vindas | assinatura-email | ...  ▾]│
│  + Criar novo tipo                                       │
│                                                          │
│  Nome do template *                                      │
│  [Ex: "Cartão minimalista v2"                          ] │
│                                                          │
│  Começar a partir de:                                    │
│  ( ) Template em branco                                  │
│  (●) Clonar de um existente                              │
│      [Select de templates atuais ▾]                      │
│                                                          │
│                              [Cancelar]  [Criar e abrir] │
└──────────────────────────────────────────────────────────┘
```

- Tipo: dropdown com tipos conhecidos (`cartao-boas-vindas`, `assinatura-email`). Permite criar um tipo novo digitando o slug.
- Nome: livre, ex.: "Design verão 2026"
- Começar de:
  - Branco → cria template com canvas 1080×1080 padrão, sem layers, bg estático placeholder
  - Clonar → seleciona um template existente, copia o `config`, dá um nome novo
- Submit → POST `/api/admin/art-templates` com `{ tipo, name, config }`, em seguida abre view "editor" com o novo ID
- Novo template é criado com `is_active = false` (não ativa automaticamente)

### 3.4 View "editor" — editor de um template específico

Reuso do editor atual, mas com **mudanças importantes**:

- **Remover a lista de templates do painel esquerdo.** O painel esquerdo só mostra o nome do template atual no topo + lista de layers + botões de adicionar layer.
- **Botão "← Voltar pra lista"** no topo da toolbar.
- **Indicador de ativo:** se o template é o ativo, badge verde no header. Se não é, badge cinza com botão "Tornar este ativo".
- **Nome do template editável inline** ao lado do título (pencil icon abre input).
- **Toolbar:** Zoom (− % +), Editar / Preview toggle, [● auto-preview ativado], Salvar.

Layout:

```
┌────────────────┬─────────────────────────────────────┬────────────────┐
│  CARTÃO BV     │ ← Voltar  • Default cartao-boas... [ATIVO]           │
│  Default (svp) │ [-] 35% [+] [Ajustar]    Editar|Preview      [Salvar]│
│                │                                                       │
│  LAYERS        │                                                       │
│  • Nome cli... │      [canvas com bg + layers overlay]                │
│  • Frase ini.. │                                                       │
│  • Mensagem    │                                                       │
│  ...           │                                                       │
│                │                                                       │
│  + Texto linha │                                                       │
│  + Texto bloco │                                                       │
│  + Imagem      │                                                       │
├────────────────┴─────────────────────────────────────┬────────────────┤
│ DADOS DE TESTE                                       │ PROPRIEDADES   │
│ [nome] [telefone] [email] [...]                      │ ...            │
└──────────────────────────────────────────────────────┴────────────────┘
```

---

## Etapa 4 — Live preview

### 4.1 Comportamento

Trocar o botão "Atualizar Preview" por **atualização automática com debounce**.

- **Toggle "Live preview"** na toolbar (default: ligado).
- Quando ligado: cada mudança no canvas (drag, resize, edit de propriedade) dispara um render automático após pausa.
- **Debounce diferenciado:**
  - Drag/resize: 700ms após soltar
  - Edição de propriedade (slider, input numérico): 800ms
  - Digitação em campo de conteúdo (textarea): 1200ms (não rerenderiza a cada keystroke)
- Indicador visual de "renderizando..." (spinner pequeno na toolbar) enquanto request está em voo.
- Se já existe request em voo quando outra mudança dispara, cancelar a anterior (AbortController).

### 4.2 Implementação

```js
let previewDebounce = null;
let previewAbortCtrl = null;

function scheduleLivePreview(delay = 700) {
  if (!liveEnabled || mode !== 'preview') return;
  if (previewDebounce) clearTimeout(previewDebounce);
  previewDebounce = setTimeout(() => doLivePreview(), delay);
}

async function doLivePreview() {
  if (previewAbortCtrl) previewAbortCtrl.abort();
  previewAbortCtrl = new AbortController();
  showRenderingIndicator(true);
  try {
    const res = await fetch('/api/admin/art-templates/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ config: currentTemplate, data: testData }),
      signal: previewAbortCtrl.signal,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    document.getElementById('previewImg').src = URL.createObjectURL(blob);
    document.getElementById('previewImg').style.display = 'block';
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  } finally {
    showRenderingIndicator(false);
  }
}
```

Chamar `scheduleLivePreview()` em:
- `markDirty()` (qualquer mudança de propriedade)
- `setupInteract` listeners `end` de drag e resize
- Mudanças no painel "Dados de teste" (com delay 1200ms)
- Toggle de bg variant

### 4.3 Modo Editar vs Preview

Quando o usuário está editando (arrastando, mexendo), pode ser útil ver tanto as boxes quanto o resultado. Duas opções:

- **(a)** Modo "Editar" mostra apenas boxes. Modo "Preview" mostra o resultado renderizado. Live preview só funciona no modo Preview.
- **(b)** Modo único que mostra ambos: boxes semi-transparentes sobrepostas ao preview renderizado.

**Opção (a) é mais simples e clara.** Vamos com ela. Botão de Preview na toolbar fica destacado quando o live está ligado. Click no Preview entra em modo preview e dispara render imediato.

---

## Etapa 5 — Detalhes de UI dos novos fluxos

### 5.1 Confirmações destrutivas

- Deletar template ativo: bloquear (precisa ativar outro antes)
- Deletar último template de um tipo: bloquear com mensagem "Este é o único template do tipo X. Crie outro antes de deletar este."
- Mudar template ativo: confirmar — "Trocar template ativo afeta todas as próximas solicitações de cartão-boas-vindas. Confirma?"

### 5.2 Estados vazios

- View "list" sem templates: card amigável "Nenhum template criado ainda. Comece criando um."
- View "editor" pra template recém-criado (em branco): canvas vazio com hint "Adicione layers usando os botões à esquerda".

### 5.3 Breadcrumbs / navegação

Em toda view não-landing, mostrar breadcrumb no topo: `Templates de Arte / [Lista | Criar | Nome do template]`. Click em qualquer parte do breadcrumb volta pra view correspondente.

Se houver edições não salvas no editor e o usuário clica em "Voltar", abrir modal: "Salvar antes de sair? [Salvar e sair] [Sair sem salvar] [Cancelar]".

---

## Build e validação

```bash
cd artifacts/api-server && pnpm run build
# Restart
```

### Smoke tests

1. **Migration aplicada**: `SELECT name, is_active, count(*) FROM art_templates GROUP BY name, is_active` — esperado: 2 rows com is_active=true.

2. **Landing aparece**: clicar na tab Templates → ver os dois cards (Criar/Editar). Click em "Editar" → view list. Click em "Voltar" → landing de novo.

3. **List view**: mostra os 2 templates atuais agrupados por tipo, ambos marcados como ativos. Botão "Editar" abre o editor.

4. **Editor view (existente)**: abre direto o template específico. Painel esquerdo NÃO mostra outros templates — só layers do atual. Botão "Voltar" volta pra list.

5. **Live preview**: entrar no editor, mudar pra modo "Preview", arrastar uma layer. Aguardar ~700ms — preview renderiza automaticamente sem clicar em nada.

6. **Criar novo**: landing → Criar. Selecionar tipo "cartao-boas-vindas", nome "Teste duplicado", "Clonar de existente" + selecionar o default → Criar e abrir. Editor abre com config clonado. Renomear uma layer, salvar.

7. **Voltar pra list**: agora vê 3 templates pra cartao-boas-vindas. O novo está marcado como inativo. Click em "Ativar" no novo → confirmação → ativa. Volta pra list, agora o novo é o ativo e o antigo virou inativo.

8. **Gerar solicitação real**: criar uma solicitação de cartão de boas-vindas pelo form normal. O PNG gerado deve usar o template recém-ativado.

9. **Deleção bloqueada**: tentar deletar o template ativo → erro. Ativar outro, depois deletar o anterior → ok.

10. **Modal de unsaved**: editor com mudança pendente → clicar Voltar → ver modal com 3 opções.

### Edge cases

- Criar template "em branco" — canvas 1080×1080, bg estático placeholder cinza. Verificar que o editor abre, layers podem ser adicionadas, preview funciona.
- Tipo novo (não existe em PLACEHOLDERS_BY_TIPO) — placeholder chips vazias mas conteúdo manualmente preenchido funciona.
- Tentar criar 2 templates com mesmo `name` mesmo `tipo` — permitido (não há constraint), mas considerar mostrar warning visual.
