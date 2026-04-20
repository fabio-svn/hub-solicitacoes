# Limpeza e robustez geral — Todos os arquivos

---

## 1. `config.js` — Limpeza e consistência

### 1a. Remover constantes não utilizadas (código morto)

```js
// REMOVER completamente — eram do sistema antigo de forms:
const CAMPOS_ETAPA2_FORM2 = [...];
const CAMPOS_ETAPA2_FORM2_ONLINE = [...];
```

### 1b. Remover subOpcoes de cartao-visita em CATEGORIAS_SOLICITACAO

```js
// DE:
{ id: "cartao-visita", label: "Cartão de Visita", icon: "icon-credit-card", ativo: false,
  subOpcoes: [
    { id: "cartao-visita-fisico", label: "Físico" },
    { id: "cartao-visita-digital", label: "Digital" },
  ]
},

// PARA:
{ id: "cartao-visita", label: "Cartão de Visita", icon: "icon-credit-card", ativo: false },
```

### 1c. Limpar FORM_ROUTES — remover entradas de subtipo via URL que não são mais usadas

```js
// REMOVER estas entradas (subtipo agora é escolhido dentro do form):
"pagina-assessores-dados":         "form-pagina-assessores.html?subtipo=dados",
"pagina-assessores-atualizacao":   "form-pagina-assessores.html?subtipo=atualizacao",
"apresentacao-nova":               "form-apresentacoes.html?subtipo=nova",
"apresentacao-atualizar":          "form-apresentacoes.html?subtipo=atualizar",
"conteudo-pdf-informativo":        "form-criacao-pdf.html?subtipo=informativo",
"conteudo-pdf-ebook":              "form-criacao-pdf.html?subtipo=ebook",

// MANTER apenas as entradas de rota principal:
"eventos":              "form-eventos.html",
"pagina-assessores":    "form-pagina-assessores.html",
"artes-divulgacao":     "form-artes-divulgacao.html",
"apresentacao":         "form-apresentacoes.html",
"conteudo-pdf":         "form-criacao-pdf.html",
"atualizacao-material": "form-atualizacao-material.html",
```

### 1d. Adicionar "cancelado" ao fluxo de eventos e "em-espera" ao _default

```js
// Em FLUXOS_ETAPAS["eventos"], adicionar ao final:
{ id: "cancelado", label: "Cancelado", visivel: false },

// Em FLUXOS_ETAPAS["_default"], adicionar ao final:
{ id: "em-espera", label: "Em espera", visivel: false },
```

### 1e. Adicionar comentário documentando duplicidade intencional com clickup.ts

```js
// Acima de SETOR_CODIGOS:
// NOTA: Este mapa é intencionalmente duplicado de SETOR_CODIGO_MAP em clickup.ts.
// config.js roda no browser, clickup.ts no Node.js — não há como compartilhar.
// Ao adicionar ou alterar setores, atualizar AMBOS os arquivos.
const SETOR_CODIGOS = { ... };
```

---

## 2. `auth.js` — Bugs e robustez

### 2a. Corrigir nome da função: `pararImpersonar` → `_sairImpersonar`

O `dashboard.html` chama `pararImpersonar()` no banner hardcoded,
mas `auth.js` define `window._sairImpersonar`. Corrigir o banner
no `dashboard.html` para chamar `window._sairImpersonar()`.

```html
<!-- No dashboard.html, no div#impersonarBanner: -->
<!-- DE: -->
<button onclick="pararImpersonar()">Sair da visualização</button>

<!-- PARA: -->
<button onclick="window._sairImpersonar()">Sair da visualização</button>
```

### 2b. Remover banner hardcoded do dashboard.html — auth.js já cria um

O `dashboard.html` tem um `<div id="impersonarBanner">` hardcoded no HTML
E o `auth.js` também cria um banner dinamicamente com o mesmo ID.
O banner hardcoded nunca é exibido corretamente pois o auth.js vai tentar
criar outro com o mesmo ID (`document.getElementById('impersonarBanner')`)
e encontrará o existente, pulando a criação mas não mostrando o hardcoded.

```html
<!-- REMOVER do dashboard.html o bloco: -->
<div id="impersonarBanner" style="display:none;position:fixed;bottom:0...">
  ...
</div>
```

O auth.js já cuida de criar o banner em todas as páginas — não precisa
estar hardcoded em nenhuma.

### 2c. Prevenir múltiplos listeners no toggleUserMenu

```js
// Substituir o setTimeout com listener dentro de renderHeader() por
// um listener único com flag de inicialização:

renderHeader(container, options = {}) {
  // ... código existente ...

  // Remover o setTimeout com addEventListener e substituir por:
  if (!Auth._outsideClickListenerAdded) {
    Auth._outsideClickListenerAdded = true;
    document.addEventListener('click', function(e) {
      const trigger = document.getElementById('userMenuTrigger');
      const dd = document.getElementById('userDropdown');
      if (dd && trigger && !trigger.contains(e.target) && !dd.contains(e.target)) {
        dd.style.display = 'none';
      }
    });
  }
},
```

Adicionar ao objeto Auth:
```js
_outsideClickListenerAdded: false,
```

### 2d. Detectar impersonação server-side no init()

```js
// No Auth.init(), após buscar /auth/me, verificar se a sessão
// está em modo impersonação via um header ou campo na resposta:
// O endpoint /auth/me pode retornar um campo `impersonating: true`
// se req.session.adminOriginal existir.

// Em forms.ts, no endpoint /auth/me (ou onde ele estiver definido):
// res.json({
//   authenticated: true,
//   user: req.session.user,
//   impersonating: !!req.session.adminOriginal,
// });

// Em auth.js, no init():
if (data.impersonating && !sessionStorage.getItem('svn_impersonate')) {
  sessionStorage.setItem('svn_impersonate', data.user.email);
}
```

---

## 3. `dashboard.html` — Bugs e código morto

### 3a. Remover humanizeValue() e funções utilitárias do drawer que não são mais usadas

As funções abaixo foram mantidas do drawer que foi removido.
Verificar se alguma ainda é usada (humanizeValue é usada no renderAdminHistorico):

```js
// MANTER (ainda usada no admin):
// humanizeValue(), humanizeSlug(), normalizeSlug(), titleCasePtBr()
// formatarData(), dataRelativa(), periodoGrupo()

// REMOVER se não usadas após remover o drawer:
// Nenhuma a remover — todas ainda têm uso
```

### 3b. Paralelizar loadAdminStats e loadAdminHistorico

```js
// Substituir em setAdminPeriodo() e setAdminCustomPeriodo():
// DE:
loadAdminStats();
loadAdminHistorico();

// PARA:
Promise.all([loadAdminStats(), loadAdminHistorico()]);
```

### 3c. Corrigir switchTab para a aba admin

```js
// A aba admin tem style="display:none" inline no HTML.
// O switchTab faz c.style.display = c.id === 'tab-' + tab ? '' : 'none'
// mas isso define '' que não sobrescreve o display:none do HTML corretamente
// em todos os browsers. Adicionar força explícita:

function switchTab(tab) {
  currentTab = tab;
  localStorage.setItem('svn_dashboard_tab', tab);
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.querySelectorAll('.tab-content').forEach(c => {
    const isActive = c.id === 'tab-' + tab;
    c.classList.toggle('active', isActive);
    c.style.display = isActive ? 'block' : 'none'; // força explícita
  });
  if (tab === 'admin') {
    Promise.all([loadAdminStats(), loadAdminHistorico()]);
  } else {
    const listEl = document.getElementById(
      tab === 'eventos' ? 'listEventos' : 'listGeral'
    );
    if (listEl && !listEl.hasChildNodes()) loadList(tab);
  }
}
```

### 3d. Corrigir bug dos múltiplos tipos no filtro admin

O dashboard usa `.append('tipos', t)` que gera `tipos=a&tipos=b`,
mas o backend faz `String(req.query.tipos).split(",")` que recebe
apenas o primeiro valor.

```js
// Em loadAdminHistorico(), substituir:
// DE:
adminTiposSelecionados.forEach(t => params.append('tipos', t));
adminStatusesSelecionados.forEach(s => params.append('statuses', s));

// PARA (enviar como string separada por vírgula):
if (adminTiposSelecionados.size > 0)
  params.set('tipos', [...adminTiposSelecionados].join(','));
if (adminStatusesSelecionados.size > 0)
  params.set('statuses', [...adminStatusesSelecionados].join(','));
```

---

## 4. `forms.ts` — Bugs e robustez

### 4a. Corrigir parsing de múltiplos valores de query (tipos/statuses)

```ts
// O Express recebe tipos=a&tipos=b como req.query.tipos = ['a','b'] (array)
// ou tipos=a,b como req.query.tipos = 'a,b' (string)
// Suportar ambos os formatos:

function parseQueryArray(val: unknown): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String).filter(Boolean);
  return String(val).split(',').filter(Boolean);
}

// Usar no endpoint:
const tiposArr = parseQueryArray(req.query.tipos);
const statusArr = parseQueryArray(req.query.statuses);
```

### 4b. Mover extractUrl() para fora do handler

```ts
// DE (dentro do handler /entrega):
function extractUrl(text: string): string | null { ... }

// PARA (no topo do arquivo, com as outras funções utilitárias):
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')]+/);
  return m ? m[0].replace(/[.,;:!?)]+$/, "") : null;
}
```

### 4c. Adicionar campo `impersonating` ao /auth/me

```ts
// No handler GET /auth/me (onde estiver definido):
res.json({
  authenticated: true,
  user: req.session.user,
  impersonating: !!req.session.adminOriginal,
});
```

### 4d. Adicionar índice em user_email (migration SQL)

```sql
-- Rodar no banco PostgreSQL:
CREATE INDEX IF NOT EXISTS idx_solicitacoes_user_email
  ON solicitacoes(user_email);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_status
  ON solicitacoes(status);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_tipo_solicitacao
  ON solicitacoes(tipo_solicitacao);

CREATE INDEX IF NOT EXISTS idx_solicitacoes_created_at
  ON solicitacoes(created_at DESC);
```

---

## 5. `style.css` — Limpeza e consolidação

### 5a. Consolidar regras duplicadas de .admin-tabela col-acoes

```css
/* Substituir as duas declarações separadas por uma consolidada: */
.admin-tabela th.col-acoes,
.admin-tabela td.col-acoes {
  position: sticky;
  right: 0;
  z-index: 2;
  border-left: 1px solid var(--border-light);
}

.admin-tabela th.col-acoes {
  background: var(--carbon-black);
}

.admin-tabela td.col-acoes {
  background: var(--paper-white);
}

/* REMOVER os blocos duplicados anteriores */
```

### 5b. Remover .admin-table (sistema antigo) se não usada em nenhum HTML atual

```css
/* Verificar se algum HTML ainda usa class="admin-table" (sem hífen, sem "a").
   Se não — REMOVER os blocos:
   .admin-table { ... }
   .admin-table th { ... }
   .admin-table td { ... }
   .admin-table tr:hover td { ... }
   E o bloco @media (max-width: 600px) com .admin-table
*/
```

### 5c. Adicionar comentário de fallback no .float-whatsapp

```css
.float-whatsapp {
  position: fixed;
  right: 20px;
  bottom: 78px; /* fallback — sobrescrito por JS inline em cada página */
  /* ... resto igual */
}
```

### 5d. Remover estilos de drawer se não usados em nenhuma página ativa

```css
/* Verificar se .drawer, .drawer-overlay, etc. são usados em algum HTML ativo.
   O dashboard.html removeu o drawer. Se nenhuma outra página usa:
   REMOVER os blocos:
   .drawer-overlay { ... }
   .drawer { ... }
   .drawer.open { ... }
   .drawer-header { ... }
   .drawer-close { ... }
   .drawer-body { ... }
   .drawer-section { ... }
   .drawer-section-title { ... }
   .drawer-field { ... }
   .drawer-field-label { ... }
   .drawer-field-value { ... }
   .drawer-footer { ... }
   
   ATENÇÃO: solicitacao.html usa .drawer-field e .drawer-field-label/.drawer-field-value
   para renderDados() — MANTER esses seletores mesmo que o componente drawer
   em si não exista mais.
*/
```

---

## OBSERVAÇÕES

- `forms.ts` precisa de build após edições
- `config.js`, `auth.js`, `dashboard.html`, `style.css` não precisam de build
- Os índices SQL (item 4d) são criações DDL — rodar direto no banco Railway
  sem necessidade de migration via código
- A limpeza do drawer no CSS deve ser feita com cuidado:
  `.drawer-field`, `.drawer-field-label`, `.drawer-field-value` ainda são
  usados em `solicitacao.html` para exibir dados — NÃO remover esses
- O `auth.js` não precisa de build mas mudanças afetam TODAS as páginas
  simultaneamente — testar com cuidado
