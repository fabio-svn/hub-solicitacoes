# Ajustes Hub SVN — Prompt Consolidado

Aplique todos os ajustes abaixo de uma vez. Organize as alterações por arquivo.

---

## `index.html` — Substituir arquivo completo

Substituir o `index.html` atual pelo conteúdo abaixo:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hub de Solicitações SVN</title>
  <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,300;6..12,400;6..12,600;6..12,700&family=Taviraj:wght@300;400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
  <style>
    .home-card {
      background: rgba(20, 12, 10, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 248, 243, 0.1);
      border-radius: 20px;
      padding: 52px 48px;
      max-width: 560px;
      width: 100%;
      text-align: center;
      opacity: 0;
      transform: scale(0.97);
    }
    .home-card.visible { opacity: 1; transform: scale(1); transition: all 0.5s ease; }
    .home-question {
      font-family: 'Nunito Sans', sans-serif;
      font-weight: 300;
      font-size: 0.9rem;
      color: var(--paper-white);
      opacity: 0.65;
      margin-bottom: 28px;
      letter-spacing: 0.02em;
    }
    .home-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      padding: 16px 24px;
      border-radius: 12px;
      font-family: 'Nunito Sans', sans-serif;
      font-weight: 600;
      font-size: 0.95rem;
      color: var(--paper-white);
      border: 1px solid rgba(255, 248, 243, 0.18);
      background: rgba(56, 24, 17, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
      margin-bottom: 12px;
    }
    .home-btn:last-of-type { margin-bottom: 0; }
    .home-btn:hover { background: rgba(56,24,17,0.75); border-color: rgba(255,248,243,0.35); transform: translateY(-2px); text-decoration: none; }
    .home-btn.red:hover { border-color: var(--ruby-red); }
    .home-btn.green:hover { border-color: var(--sage-green); }
    .home-btn svg { flex-shrink: 0; }
    .home-logo { margin-top: 40px; opacity: 0; transition: opacity 0.4s ease; }
    .home-logo.visible { opacity: 1; }
    .error-msg { display:none; margin-top:16px; background:rgba(159,63,55,0.15); border:1px solid var(--ruby-red); border-radius:8px; padding:12px 16px; font-size:0.85rem; color:var(--paper-white); max-width:500px; text-align:center; }
    @media (max-width: 480px) { .home-card { padding: 36px 24px; } }
  </style>
</head>
<body class="page-dark">
  <video autoplay loop muted playsinline style="position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0" id="bgVideo"></video>
  <div style="position:fixed;inset:0;background:rgba(20,12,10,0.72);mix-blend-mode:multiply;z-index:0"></div>
  <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;z-index:1;padding:24px">
    <div class="home-card" id="homeCard">
      <p class="home-question">O que você gostaria de fazer?</p>
      <button class="home-btn red" onclick="goTo('solicitacoes.html')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
        Quero fazer uma solicitação
      </button>
      <button class="home-btn green" onclick="goTo('dashboard.html')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
        Quero acompanhar uma solicitação
      </button>
    </div>
    <div class="home-logo" id="logoWrap">
      <img id="logoBottom" alt="SVN" style="height:26px;opacity:0.45">
    </div>
    <div class="error-msg" id="errorMsg"></div>
  </div>
  <script src="config.js"></script>
  <script src="auth.js"></script>
  <script>
    document.getElementById('bgVideo').src = URL_VIDEO_HERO;
    document.getElementById('logoBottom').src = URL_LOGO_BRANCA;
    setTimeout(() => document.getElementById('homeCard').classList.add('visible'), 100);
    setTimeout(() => document.getElementById('logoWrap').classList.add('visible'), 500);
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      const el = document.getElementById('errorMsg');
      el.style.display = 'block';
      if (error === 'domain_not_allowed') el.textContent = 'Apenas contas @svninvest.com.br são aceitas. Por favor, use seu e-mail corporativo.';
      else if (error === 'login_failed' || error === 'auth_failed') el.textContent = 'Falha na autenticação. Tente novamente.';
      else el.textContent = 'Ocorreu um erro. Tente novamente.';
    }
    async function goTo(page) {
      await Auth.init();
      if (!Auth.isAuthenticated()) { window.location.href = '/auth/login?redirect=/' + page; return; }
      window.location.href = '/' + page;
    }
  </script>
</body>
</html>
```

---

## `config.js` — Atualizar array SETORES

Localizar o array `SETORES` e substituir completamente por:

```js
const SETORES = [
  "Selecione seu setor",
  "Administração",
  "Alocação",
  "Câmbio",
  "Commodities",
  "Capital Humano",
  "Corporate",
  "Digital",
  "Financeiro",
  "Institucional",
  "Jurídico",
  "Marketing",
  "Performance",
  "Middle",
  "Proteção Patrimonial",
  "Renda Fixa",
  "Renda Variável",
  "SVN Gestão",
  "SVN Global",
  "SVN Investment & Merchant Banking (M&A)",
  "Universidade SVN",
  "Wealth Planning",
];
```

---

## `style.css` — Adicionar classes dos filtros colapsáveis

Adicionar ao final do arquivo:

```css
.filter-bar { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
.filter-toggle-btn {
  display:inline-flex; align-items:center; gap:6px; height:32px; padding:0 14px;
  border-radius:8px; border:1px solid var(--border-light); background:var(--card-white);
  cursor:pointer; font-family:'Nunito Sans',sans-serif; font-size:0.8rem; font-weight:600;
  color:var(--carbon-black); transition:0.15s; white-space:nowrap;
}
.filter-toggle-btn:hover { border-color:var(--ruby-red); }
.filter-toggle-btn.has-filters { border-color:var(--ruby-red); color:var(--ruby-red); }
.filter-count-badge { background:var(--ruby-red); color:var(--paper-white); border-radius:999px; font-size:0.65rem; font-weight:700; padding:1px 5px; line-height:1.4; }
.filter-active-badge {
  display:inline-flex; align-items:center; gap:5px; height:28px; padding:0 10px;
  border-radius:6px; font-size:0.75rem; font-weight:600;
  background:rgba(34,27,25,0.06); border:1px solid rgba(34,27,25,0.14);
  color:var(--carbon-black); cursor:default; animation:fadeIn 0.15s ease;
}
.filter-active-badge .remove-badge { opacity:0.35; cursor:pointer; font-size:0.85rem; line-height:1; transition:opacity 0.1s; }
.filter-active-badge .remove-badge:hover { opacity:0.8; }
.filter-clear-btn { font-size:0.75rem; color:var(--ruby-red); background:none; border:none; cursor:pointer; font-family:'Nunito Sans',sans-serif; font-weight:600; padding:0 4px; opacity:0.8; }
.filter-clear-btn:hover { opacity:1; }
.filter-panel { background:var(--card-white); border:1px solid var(--border-light); border-radius:12px; padding:16px 20px; margin-bottom:16px; display:none; animation:fadeIn 0.2s ease; }
.filter-panel.open { display:block; }
.filter-panel-row { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
.filter-panel-row:last-child { margin-bottom:0; }
.filter-panel-label { font-size:0.75rem; font-weight:600; color:var(--carbon-black); opacity:0.45; min-width:64px; }
```

---

## `dashboard.html` — Substituir filtros e atualizar JS

### 2a. Substituir o bloco de filtros da aba Eventos

Localizar e substituir as divs de Período/Natureza/Status da aba `tab-eventos` por:

```html
<div class="filter-bar" id="filterBarEventos">
  <button class="filter-toggle-btn" id="filterToggleEventos" onclick="toggleFilterPanel('eventos')">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
    Filtrar
    <span class="filter-count-badge" id="filterCountEventos" style="display:none">0</span>
  </button>
  <div id="filterActiveBadgesEventos" style="display:contents"></div>
  <button class="filter-clear-btn" id="filterClearEventos" style="display:none" onclick="clearAllFilters('eventos')">Limpar tudo</button>
</div>
<div class="filter-panel" id="filterPanelEventos">
  <div class="filter-panel-row">
    <span class="filter-panel-label">Período</span>
    <button class="filter-chip active" data-filter="periodo" data-value="" data-label="Todos os períodos" onclick="toggleFilter(this,'eventos','periodo')">Todos</button>
    <button class="filter-chip" data-filter="periodo" data-value="hoje" data-label="Hoje" onclick="toggleFilter(this,'eventos','periodo')">Hoje</button>
    <button class="filter-chip" data-filter="periodo" data-value="7dias" data-label="7 dias" onclick="toggleFilter(this,'eventos','periodo')">7 dias</button>
    <button class="filter-chip" data-filter="periodo" data-value="30dias" data-label="30 dias" onclick="toggleFilter(this,'eventos','periodo')">30 dias</button>
  </div>
  <div class="filter-panel-row">
    <span class="filter-panel-label">Natureza</span>
    <button class="filter-chip active" data-filter="natureza" data-value="" data-label="Todas as naturezas" onclick="toggleFilter(this,'eventos','natureza')">Todos</button>
    <button class="filter-chip" data-filter="natureza" data-value="presencial" data-label="Presencial" onclick="toggleFilter(this,'eventos','natureza')">Presencial</button>
    <button class="filter-chip" data-filter="natureza" data-value="online" data-label="Online" onclick="toggleFilter(this,'eventos','natureza')">Online</button>
  </div>
  <div class="filter-panel-row">
    <span class="filter-panel-label">Status</span>
    <button class="filter-chip active" data-filter="status" data-value="" data-label="Todos os status" onclick="toggleFilter(this,'eventos','status')">Todos</button>
    <button class="filter-chip" data-filter="status" data-value="recebido" data-label="Recebido" onclick="toggleFilter(this,'eventos','status')">Recebido</button>
    <button class="filter-chip" data-filter="status" data-value="em-producao" data-label="Em produção" onclick="toggleFilter(this,'eventos','status')">Em produção</button>
    <button class="filter-chip" data-filter="status" data-value="aguardando" data-label="Aguardando" onclick="toggleFilter(this,'eventos','status')">Aguardando</button>
    <button class="filter-chip" data-filter="status" data-value="concluido" data-label="Concluído" onclick="toggleFilter(this,'eventos','status')">Concluído</button>
  </div>
</div>
```

### 2b. Substituir o bloco de filtros da aba Solicitações gerais

Localizar e substituir as divs de Período/Tipo/Status da aba `tab-geral` por:

```html
<div class="filter-bar" id="filterBarGeral">
  <button class="filter-toggle-btn" id="filterToggleGeral" onclick="toggleFilterPanel('geral')">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
    Filtrar
    <span class="filter-count-badge" id="filterCountGeral" style="display:none">0</span>
  </button>
  <div id="filterActiveBadgesGeral" style="display:contents"></div>
  <button class="filter-clear-btn" id="filterClearGeral" style="display:none" onclick="clearAllFilters('geral')">Limpar tudo</button>
</div>
<div class="filter-panel" id="filterPanelGeral">
  <div class="filter-panel-row">
    <span class="filter-panel-label">Período</span>
    <button class="filter-chip active" data-filter="periodo" data-value="" data-label="Todos os períodos" onclick="toggleFilter(this,'geral','periodo')">Todos</button>
    <button class="filter-chip" data-filter="periodo" data-value="hoje" data-label="Hoje" onclick="toggleFilter(this,'geral','periodo')">Hoje</button>
    <button class="filter-chip" data-filter="periodo" data-value="7dias" data-label="7 dias" onclick="toggleFilter(this,'geral','periodo')">7 dias</button>
    <button class="filter-chip" data-filter="periodo" data-value="30dias" data-label="30 dias" onclick="toggleFilter(this,'geral','periodo')">30 dias</button>
  </div>
  <div class="filter-panel-row">
    <span class="filter-panel-label">Tipo</span>
    <button class="filter-chip active" data-filter="tipo" data-value="" data-label="Todos os tipos" onclick="toggleFilter(this,'geral','tipo')">Todos</button>
    <button class="filter-chip" data-filter="tipo" data-value="pagina-assessores" data-label="Página de Assessores" onclick="toggleFilter(this,'geral','tipo')">Página de Assessores</button>
    <button class="filter-chip" data-filter="tipo" data-value="apresentacao" data-label="Apresentação" onclick="toggleFilter(this,'geral','tipo')">Apresentação</button>
    <button class="filter-chip" data-filter="tipo" data-value="artes-divulgacao" data-label="Artes de Divulgação" onclick="toggleFilter(this,'geral','tipo')">Artes de Divulgação</button>
    <button class="filter-chip" data-filter="tipo" data-value="conteudo-pdf" data-label="PDF" onclick="toggleFilter(this,'geral','tipo')">PDF</button>
    <button class="filter-chip" data-filter="tipo" data-value="atualizacao-material" data-label="Atualização de Material" onclick="toggleFilter(this,'geral','tipo')">Atualização de Material</button>
  </div>
  <div class="filter-panel-row">
    <span class="filter-panel-label">Status</span>
    <button class="filter-chip active" data-filter="status" data-value="" data-label="Todos os status" onclick="toggleFilter(this,'geral','status')">Todos</button>
    <button class="filter-chip" data-filter="status" data-value="recebido" data-label="Recebido" onclick="toggleFilter(this,'geral','status')">Recebido</button>
    <button class="filter-chip" data-filter="status" data-value="em-producao" data-label="Em produção" onclick="toggleFilter(this,'geral','status')">Em produção</button>
    <button class="filter-chip" data-filter="status" data-value="aguardando" data-label="Aguardando" onclick="toggleFilter(this,'geral','status')">Aguardando</button>
    <button class="filter-chip" data-filter="status" data-value="concluido" data-label="Concluído" onclick="toggleFilter(this,'geral','status')">Concluído</button>
  </div>
</div>
```

### 2c. Substituir a função `toggleFilter` e adicionar novas funções no `<script>`

Substituir a função `toggleFilter` existente e adicionar as funções abaixo logo após ela:

```js
function toggleFilter(el, tab, filterKey) {
  const siblings = el.closest('.filter-panel-row').querySelectorAll('.filter-chip');
  siblings.forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  filters[tab][filterKey] = el.dataset.value;
  pages[tab] = 1;
  loadList(tab);
  updateFilterBadges(tab);
}

function toggleFilterPanel(tab) {
  const panel = document.getElementById('filterPanel' + capitalize(tab));
  const btn = document.getElementById('filterToggle' + capitalize(tab));
  const isOpen = panel.classList.contains('open');
  panel.classList.toggle('open', !isOpen);
  btn.style.borderColor = (!isOpen || hasActiveFilters(tab)) ? 'var(--ruby-red)' : '';
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function hasActiveFilters(tab) {
  return Object.values(filters[tab]).some(v => v !== '');
}

function updateFilterBadges(tab) {
  const capTab = capitalize(tab);
  const badgesContainer = document.getElementById('filterActiveBadges' + capTab);
  const countBadge = document.getElementById('filterCount' + capTab);
  const clearBtn = document.getElementById('filterClear' + capTab);
  const toggleBtn = document.getElementById('filterToggle' + capTab);
  const activeFilters = Object.entries(filters[tab]).filter(([k, v]) => v !== '');
  const count = activeFilters.length;
  countBadge.style.display = count > 0 ? 'inline' : 'none';
  countBadge.textContent = count;
  clearBtn.style.display = count > 0 ? 'inline' : 'none';
  toggleBtn.classList.toggle('has-filters', count > 0);
  badgesContainer.innerHTML = activeFilters.map(([key, value]) => {
    const chip = document.querySelector(`#filterPanel${capTab} [data-filter="${key}"][data-value="${value}"]`);
    const label = chip ? chip.dataset.label || chip.textContent : value;
    return `<span class="filter-active-badge">${label}<span class="remove-badge" onclick="removeFilter('${tab}','${key}')">×</span></span>`;
  }).join('');
}

function removeFilter(tab, filterKey) {
  filters[tab][filterKey] = '';
  pages[tab] = 1;
  const capTab = capitalize(tab);
  const defaultChip = document.querySelector(`#filterPanel${capTab} [data-filter="${filterKey}"][data-value=""]`);
  if (defaultChip) {
    const siblings = defaultChip.closest('.filter-panel-row').querySelectorAll('.filter-chip');
    siblings.forEach(s => s.classList.remove('active'));
    defaultChip.classList.add('active');
  }
  loadList(tab);
  updateFilterBadges(tab);
}

function clearAllFilters(tab) {
  filters[tab] = tab === 'eventos'
    ? { periodo: '', status: '', natureza: '' }
    : { periodo: '', status: '', tipo: '' };
  pages[tab] = 1;
  const capTab = capitalize(tab);
  document.querySelectorAll(`#filterPanel${capTab} .filter-chip`).forEach(chip => {
    chip.classList.toggle('active', chip.dataset.value === '');
  });
  loadList(tab);
  updateFilterBadges(tab);
}
```

### 2d. Corrigir cor dos badges de status na lista

Na função `renderList`, localizar o trecho que gera o badge de status e substituir por:

```js
// Trocar:
<span class="badge" style="background:var(${statusObj.cor});color:var(--paper-white)">${esc(statusObj.label)}</span>

// Por — usando a cor correta de STATUS_SOLICITACAO:
<span class="badge" style="background:var(${statusObj.cor || '--carbon-black'});color:var(--paper-white)">${esc(statusObj.label)}</span>
```

E garantir que `statusObj` seja obtido corretamente:
```js
// Verificar que esta linha existe e está correta:
const statusObj = STATUS_SOLICITACAO.find(s => s.id === item.status) || { label: item.status, cor: '--carbon-black' };
```

---

## `dashboard.html` — Skeleton loader na lista

Na função `loadList`, adicionar skeleton loader antes do fetch e remover após:

```js
async function loadList(tab) {
  // Mostrar skeleton loader
  const listEl = document.getElementById(tab === 'eventos' ? 'listEventos' : 'listGeral');
  listEl.innerHTML = [1,2,3].map(() => `
    <div style="background:var(--icon-bg);border-radius:12px;height:64px;margin-bottom:12px;overflow:hidden;position:relative">
      <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.5) 50%,transparent 75%);background-size:200% 100%;animation:shimmer 1.2s infinite"></div>
    </div>
  `).join('');

  // ... resto da função loadList existente (params, fetch, renderList) sem alteração
}
```

Adicionar no `style.css`:
```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## OBSERVAÇÕES FINAIS

- Não remover nenhuma função existente no `dashboard.html` além de substituir `toggleFilter`
- O `index.html` é substituição completa do arquivo
- As alterações no `config.js` e `style.css` são adições/substituições pontuais
- Após aplicar, testar dashboard com e sem filtros ativos nas duas abas
