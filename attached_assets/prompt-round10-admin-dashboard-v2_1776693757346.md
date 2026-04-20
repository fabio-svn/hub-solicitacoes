# Round 10 — Dashboard Admin v2

---

## 1. Gráfico de pizza com filtro de tipos/status

### 1a. Adicionar checkboxes de filtro abaixo do gráfico

No HTML da aba admin, após `<div id="graficoContainer">...</div>`, adicionar:

```html
<div id="graficoFiltros" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border-light)">
  <p style="font-size:0.72rem;font-weight:700;opacity:0.4;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">
    Filtrar exibição do gráfico
  </p>
  <div id="graficoCheckboxes" style="display:flex;flex-wrap:wrap;gap:8px"></div>
  <button onclick="resetGraficoFiltros()" style="margin-top:10px;font-size:0.78rem;color:var(--ruby-red);background:none;border:none;cursor:pointer;padding:0;font-family:'Nunito Sans',sans-serif">
    Mostrar todos
  </button>
</div>
```

### 1b. Atualizar `renderAdminGrafico()` com suporte a filtros

```js
let graficoFiltrosAtivos = null; // null = todos visíveis

function renderAdminGrafico() {
  if (!adminGraficoData) return;

  const todosItens = adminGraficoModo === 'tipo'
    ? adminGraficoData.porTipo.map(i => ({
        id: i.tipo,
        label: TIPO_SOLICITACAO_LABELS[i.tipo] || i.tipo,
        value: i.count
      }))
    : adminGraficoData.porStatus.map(i => ({
        id: i.status,
        label: (STATUS_SOLICITACAO.find(s => s.id === i.status)?.label) || i.status,
        value: i.count,
        cor: STATUS_SOLICITACAO.find(s => s.id === i.status)?.bg || null,
      }));

  // Aplicar filtro ativo
  const itens = graficoFiltrosAtivos
    ? todosItens.filter(i => graficoFiltrosAtivos.has(i.id))
    : todosItens;

  // Renderizar checkboxes
  renderGraficoCheckboxes(todosItens);

  const total = itens.reduce((a, b) => a + b.value, 0);
  if (total === 0) {
    document.getElementById('adminLegenda').innerHTML =
      '<p style="opacity:0.4;font-size:0.85rem">Nenhum dado para os filtros selecionados.</p>';
    // Limpar canvas
    const canvas = document.getElementById('adminPizza');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // ... resto do código de desenho do gráfico (igual ao existente,
  // mas usando `itens` filtrados em vez de todos)
  const CORES = ['#AC3631','#221B19','#4a7c2f','#1e40af','#9333ea','#ea580c','#0891b2','#be123c','#854d0e','#166534'];
  const canvas = document.getElementById('adminPizza');
  const ctx = canvas.getContext('2d');
  canvas.width = 200; canvas.height = 200;
  ctx.clearRect(0, 0, 200, 200);

  let startAngle = -Math.PI / 2;
  const cx = 100, cy = 100, r = 85, rInner = 50;

  itens.forEach((item, i) => {
    const slice = (item.value / total) * 2 * Math.PI;
    const cor = item.cor || CORES[i % CORES.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startAngle, startAngle + slice);
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    startAngle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--paper-white').trim() || '#FFF8F3';
  ctx.fill();

  ctx.fillStyle = '#221B19';
  ctx.font = 'bold 24px "Nunito Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total, cx, cy - 6);
  ctx.font = '11px "Nunito Sans", sans-serif';
  ctx.fillStyle = 'rgba(34,27,25,0.4)';
  ctx.fillText('total', cx, cy + 14);

  // Legenda
  const legenda = document.getElementById('adminLegenda');
  legenda.innerHTML = itens.map((item, i) => {
    const pct = Math.round((item.value / total) * 100);
    const cor = item.cor || CORES[i % CORES.length];
    return `<div style="display:flex;align-items:center;gap:8px">
      <div style="width:10px;height:10px;border-radius:2px;background:${cor};flex-shrink:0"></div>
      <span style="font-size:0.8rem;flex:1;line-height:1.3">${esc(item.label)}</span>
      <span style="font-size:0.8rem;font-weight:700;opacity:0.7">${pct}%</span>
      <span style="font-size:0.75rem;opacity:0.4">${item.value}</span>
    </div>`;
  }).join('');
}

function renderGraficoCheckboxes(todosItens) {
  const container = document.getElementById('graficoCheckboxes');
  if (!container) return;
  const CORES = ['#AC3631','#221B19','#4a7c2f','#1e40af','#9333ea','#ea580c','#0891b2','#be123c','#854d0e','#166534'];

  container.innerHTML = todosItens.map((item, i) => {
    const isAtivo = !graficoFiltrosAtivos || graficoFiltrosAtivos.has(item.id);
    const cor = item.cor || CORES[i % CORES.length];
    return `<label style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:8px;border:1.5px solid ${isAtivo ? cor : 'rgba(34,27,25,0.1)'};background:${isAtivo ? cor + '18' : 'transparent'};cursor:pointer;font-size:0.78rem;font-weight:600;transition:all 0.15s;user-select:none">
      <input type="checkbox" ${isAtivo ? 'checked' : ''}
        data-id="${esc(item.id)}"
        onchange="toggleGraficoFiltro('${esc(item.id)}')"
        style="display:none">
      <span style="width:8px;height:8px;border-radius:2px;background:${cor};flex-shrink:0"></span>
      ${esc(item.label)}
    </label>`;
  }).join('');
}

function toggleGraficoFiltro(id) {
  // Inicializar com todos se null
  if (!graficoFiltrosAtivos) {
    const todosItens = adminGraficoModo === 'tipo'
      ? adminGraficoData.porTipo.map(i => i.tipo)
      : adminGraficoData.porStatus.map(i => i.status);
    graficoFiltrosAtivos = new Set(todosItens);
  }
  if (graficoFiltrosAtivos.has(id)) {
    graficoFiltrosAtivos.delete(id);
  } else {
    graficoFiltrosAtivos.add(id);
  }
  // Se todos estão ativos, voltar para null (sem filtro)
  const total = adminGraficoModo === 'tipo'
    ? adminGraficoData.porTipo.length
    : adminGraficoData.porStatus.length;
  if (graficoFiltrosAtivos.size === total) graficoFiltrosAtivos = null;
  renderAdminGrafico();
}

function resetGraficoFiltros() {
  graficoFiltrosAtivos = null;
  renderAdminGrafico();
}

function switchGrafico(modo) {
  adminGraficoModo = modo;
  graficoFiltrosAtivos = null; // reset filtros ao trocar modo
  document.getElementById('graficoBtnTipo').classList.toggle('active', modo === 'tipo');
  document.getElementById('graficoBtnStatus').classList.toggle('active', modo === 'status');
  renderAdminGrafico();
}
```

---

## 2. Tabela de histórico — filtros e UX melhorados

### 2a. Substituir o bloco de filtros no HTML da aba admin

```html
<!-- Substituir a div de filtros existente por: -->
<div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap" id="adminFiltrosBar">

  <!-- Busca: ícone que expande -->
  <div id="adminBuscaWrap" style="position:relative">
    <button id="adminBuscaBtn"
      onclick="toggleAdminBusca()"
      title="Buscar"
      style="width:32px;height:32px;border-radius:8px;background:var(--icon-bg);border:1px solid var(--border-light);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </button>
    <div id="adminBuscaExpand" style="display:none;position:absolute;left:0;top:36px;z-index:20;background:var(--paper-white);border:1px solid var(--border-light);border-radius:10px;padding:6px;box-shadow:0 4px 16px rgba(34,27,25,0.1);width:220px">
      <input type="text" id="adminBusca" placeholder="Buscar por título, e-mail..."
        style="width:100%;border:none;outline:none;font-family:'Nunito Sans',sans-serif;font-size:0.85rem;padding:4px 8px;box-sizing:border-box"
        oninput="debounceAdminSearch()">
    </div>
  </div>

  <!-- Filtro Solicitante -->
  <div style="position:relative" id="adminSolicitanteWrap">
    <button onclick="toggleDropdown('adminSolicitanteDropdown')"
      id="adminSolicitanteBtn"
      style="height:32px;padding:0 12px;border-radius:8px;background:var(--icon-bg);border:1px solid var(--border-light);cursor:pointer;font-family:'Nunito Sans',sans-serif;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      Solicitante
      <span id="adminSolicitanteBadge" style="display:none;background:var(--ruby-red);color:white;border-radius:999px;font-size:0.65rem;padding:1px 6px">0</span>
    </button>
    <div id="adminSolicitanteDropdown" style="display:none;position:absolute;left:0;top:36px;z-index:20;background:var(--paper-white);border:1px solid var(--border-light);border-radius:10px;padding:8px;box-shadow:0 4px 16px rgba(34,27,25,0.1);min-width:200px">
      <input type="text" id="adminSolicitanteInput" placeholder="Filtrar por e-mail..."
        style="width:100%;border:1px solid var(--border-light);border-radius:6px;padding:6px 10px;font-family:'Nunito Sans',sans-serif;font-size:0.82rem;box-sizing:border-box;margin-bottom:6px"
        oninput="debounceAdminSearch()">
      <button onclick="limparFiltroSolicitante()" style="font-size:0.75rem;color:var(--ruby-red);background:none;border:none;cursor:pointer;padding:0">Limpar</button>
    </div>
  </div>

  <!-- Filtro Tipos (multi-select dropdown) -->
  <div style="position:relative" id="adminTiposWrap">
    <button onclick="toggleDropdown('adminTiposDropdown')"
      id="adminTiposBtn"
      style="height:32px;padding:0 12px;border-radius:8px;background:var(--icon-bg);border:1px solid var(--border-light);cursor:pointer;font-family:'Nunito Sans',sans-serif;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap">
      Tipos
      <span id="adminTiposBadge" style="display:none;background:var(--ruby-red);color:white;border-radius:999px;font-size:0.65rem;padding:1px 6px">0</span>
    </button>
    <div id="adminTiposDropdown" style="display:none;position:absolute;left:0;top:36px;z-index:20;background:var(--paper-white);border:1px solid var(--border-light);border-radius:10px;padding:8px;box-shadow:0 4px 16px rgba(34,27,25,0.1);min-width:220px">
      ${[
        ['eventos','Eventos'],
        ['artes-divulgacao','Arte de Divulgação'],
        ['apresentacao-nova','Apresentação Nova'],
        ['apresentacao-atualizar','Att. Apresentação'],
        ['conteudo-pdf-informativo','PDF Informativo'],
        ['conteudo-pdf-ebook','PDF Ebook'],
        ['atualizacao-material','Atualização de Material'],
        ['pagina-assessores-dados','Página de Assessores'],
        ['pagina-assessores-atualizacao','Att. Página de Assessores'],
      ].map(([val, lbl]) => `
        <label style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;font-size:0.82rem;border-radius:6px" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background=''">
          <input type="checkbox" value="${val}" onchange="updateAdminTiposFiltro()" style="accent-color:var(--ruby-red)">
          ${lbl}
        </label>`
      ).join('')}
      <div style="border-top:1px solid var(--border-light);margin-top:4px;padding-top:4px">
        <button onclick="limparAdminTipos()" style="font-size:0.75rem;color:var(--ruby-red);background:none;border:none;cursor:pointer;padding:2px 4px">Limpar seleção</button>
      </div>
    </div>
  </div>

  <!-- Filtro Status (multi-select dropdown) -->
  <div style="position:relative" id="adminStatusWrap">
    <button onclick="toggleDropdown('adminStatusDropdown')"
      id="adminStatusBtn"
      style="height:32px;padding:0 12px;border-radius:8px;background:var(--icon-bg);border:1px solid var(--border-light);cursor:pointer;font-family:'Nunito Sans',sans-serif;font-size:0.82rem;font-weight:600;display:flex;align-items:center;gap:6px;white-space:nowrap">
      Status
      <span id="adminStatusBadge" style="display:none;background:var(--ruby-red);color:white;border-radius:999px;font-size:0.65rem;padding:1px 6px">0</span>
    </button>
    <div id="adminStatusDropdown" style="display:none;position:absolute;left:0;top:36px;z-index:20;background:var(--paper-white);border:1px solid var(--border-light);border-radius:10px;padding:8px;box-shadow:0 4px 16px rgba(34,27,25,0.1);min-width:200px">
      ${['recebido','em-analise','em-producao','em-revisao','em-aprovacao','aguardando','concluido','cancelado','reprovado'].map(s => {
        const so = 'STATUS_SOLICITACAO.find(x => x.id === "' + s + '")';
        return `<label style="display:flex;align-items:center;gap:8px;padding:6px 4px;cursor:pointer;font-size:0.82rem;border-radius:6px" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background=''">
          <input type="checkbox" value="${s}" onchange="updateAdminStatusFiltro()" style="accent-color:var(--ruby-red)">
          ${s.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
        </label>`;
      }).join('')}
      <div style="border-top:1px solid var(--border-light);margin-top:4px;padding-top:4px">
        <button onclick="limparAdminStatus()" style="font-size:0.75rem;color:var(--ruby-red);background:none;border:none;cursor:pointer;padding:2px 4px">Limpar seleção</button>
      </div>
    </div>
  </div>

  <!-- Checkbox avaliação -->
  <label style="display:inline-flex;align-items:center;gap:6px;padding:0 10px;height:32px;border-radius:8px;border:1px solid var(--border-light);background:var(--icon-bg);cursor:pointer;font-size:0.82rem;font-weight:600;white-space:nowrap">
    <input type="checkbox" id="adminFiltroAvaliacao" onchange="loadAdminHistorico()" style="accent-color:var(--ruby-red)">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    Com avaliação
  </label>

</div>
```

### 2b. Funções JS dos filtros

```js
let adminTiposSelecionados = new Set();
let adminStatusSelecionados = new Set();
let adminOrdemColuna = 'created_at';
let adminOrdemDir = 'desc';

function toggleDropdown(id) {
  const el = document.getElementById(id);
  const isOpen = el.style.display !== 'none';
  // Fechar todos os outros dropdowns primeiro
  ['adminTiposDropdown','adminStatusDropdown','adminSolicitanteDropdown','adminBuscaExpand'].forEach(did => {
    if (did !== id) document.getElementById(did).style.display = 'none';
  });
  el.style.display = isOpen ? 'none' : 'block';
}

function toggleAdminBusca() {
  const wrap = document.getElementById('adminBuscaExpand');
  const isOpen = wrap.style.display !== 'none';
  toggleDropdown('adminBuscaExpand');
  if (!isOpen) setTimeout(() => document.getElementById('adminBusca')?.focus(), 50);
}

// Fechar dropdowns ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('#adminFiltrosBar')) {
    ['adminTiposDropdown','adminStatusDropdown','adminSolicitanteDropdown','adminBuscaExpand'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
});

function updateAdminTiposFiltro() {
  adminTiposSelecionados = new Set(
    [...document.querySelectorAll('#adminTiposDropdown input:checked')].map(i => i.value)
  );
  const badge = document.getElementById('adminTiposBadge');
  badge.style.display = adminTiposSelecionados.size > 0 ? '' : 'none';
  badge.textContent = adminTiposSelecionados.size;
  adminPageHistorico = 1;
  loadAdminHistorico();
}

function updateAdminStatusFiltro() {
  adminStatusSelecionados = new Set(
    [...document.querySelectorAll('#adminStatusDropdown input:checked')].map(i => i.value)
  );
  const badge = document.getElementById('adminStatusBadge');
  badge.style.display = adminStatusSelecionados.size > 0 ? '' : 'none';
  badge.textContent = adminStatusSelecionados.size;
  adminPageHistorico = 1;
  loadAdminHistorico();
}

function limparAdminTipos() {
  document.querySelectorAll('#adminTiposDropdown input').forEach(i => i.checked = false);
  adminTiposSelecionados = new Set();
  document.getElementById('adminTiposBadge').style.display = 'none';
  adminPageHistorico = 1;
  loadAdminHistorico();
}

function limparAdminStatus() {
  document.querySelectorAll('#adminStatusDropdown input').forEach(i => i.checked = false);
  adminStatusSelecionados = new Set();
  document.getElementById('adminStatusBadge').style.display = 'none';
  adminPageHistorico = 1;
  loadAdminHistorico();
}

function limparFiltroSolicitante() {
  const input = document.getElementById('adminSolicitanteInput');
  if (input) input.value = '';
  adminPageHistorico = 1;
  loadAdminHistorico();
}
```

### 2c. Atualizar `loadAdminHistorico()` para usar novos filtros

```js
async function loadAdminHistorico() {
  const tbody = document.getElementById('adminTabelaBody');
  tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;opacity:0.4">Carregando...</td></tr>';

  const params = new URLSearchParams();
  params.set('page', adminPageHistorico);
  params.set('limit', '25');
  params.set('order', adminOrdemColuna);
  params.set('dir', adminOrdemDir);

  const busca = document.getElementById('adminBusca')?.value?.trim();
  if (busca) params.set('busca', busca);

  const solicitante = document.getElementById('adminSolicitanteInput')?.value?.trim();
  if (solicitante) params.set('solicitante', solicitante);

  if (adminTiposSelecionados.size > 0)
    params.set('tipos', [...adminTiposSelecionados].join(','));

  if (adminStatusSelecionados.size > 0)
    params.set('statuses', [...adminStatusSelecionados].join(','));

  const avaliacaoCheck = document.getElementById('adminFiltroAvaliacao');
  if (avaliacaoCheck?.checked) params.set('avaliacao', 'sim');

  const de = document.getElementById('adminDe')?.value;
  const ate = document.getElementById('adminAte')?.value;
  if (de) params.set('de', de);
  if (ate) params.set('ate', ate);

  try {
    const res = await fetch('/api/admin/historico?' + params.toString());
    const data = await res.json();
    renderAdminHistorico(data);
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" ...>Erro ao carregar.</td></tr>';
  }
}
```

### 2d. Atualizar `GET /admin/historico` no `forms.ts` para novos params

```ts
// Filtro por múltiplos tipos
if (req.query.tipos) {
  const tiposArr = String(req.query.tipos).split(',').filter(Boolean);
  if (tiposArr.length > 0) {
    conditions.push(inArray(solicitacoesTable.tipo_solicitacao, tiposArr));
  }
}

// Filtro por múltiplos status
if (req.query.statuses) {
  const statusArr = String(req.query.statuses).split(',').filter(Boolean);
  if (statusArr.length > 0) {
    conditions.push(inArray(solicitacoesTable.status, statusArr));
  }
}

// Filtro por solicitante (e-mail)
if (req.query.solicitante) {
  const term = `%${String(req.query.solicitante).replace(/%/g, "\\%")}%`;
  conditions.push(sql`${solicitacoesTable.user_email} ILIKE ${term}`);
}

// Ordenação dinâmica
const orderCol = String(req.query.order || 'created_at');
const orderDir = String(req.query.dir || 'desc');
const allowedCols: Record<string, any> = {
  created_at: solicitacoesTable.created_at,
  status: solicitacoesTable.status,
  tipo_solicitacao: solicitacoesTable.tipo_solicitacao,
  titulo: solicitacoesTable.titulo,
};
const col = allowedCols[orderCol] || solicitacoesTable.created_at;
const order = orderDir === 'asc' ? asc(col) : desc(col);
// Substituir .orderBy(desc(...)) por .orderBy(order)
```

### 2e. Colunas da tabela: Data primeira + ordenação clicável

Substituir o `<thead>` da tabela admin:

```html
<thead>
  <tr style="background:var(--icon-bg);text-align:left">
    <th onclick="sortAdmin('created_at')" style="padding:10px 14px;cursor:pointer;white-space:nowrap;user-select:none">
      <span style="font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">
        Data <span id="sortCreated">↓</span>
      </span>
    </th>
    <th style="padding:10px 14px;...">Solicitante</th>
    <th onclick="sortAdmin('titulo')" style="padding:10px 14px;cursor:pointer;white-space:nowrap;user-select:none">
      <span style="font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">
        Título <span id="sortTitulo"></span>
      </span>
    </th>
    <th onclick="sortAdmin('tipo_solicitacao')" style="padding:10px 14px;cursor:pointer;white-space:nowrap;user-select:none">
      <span style="...">Tipo <span id="sortTipo"></span></span>
    </th>
    <th onclick="sortAdmin('status')" style="padding:10px 14px;cursor:pointer;white-space:nowrap;user-select:none">
      <span style="...">Status <span id="sortStatus"></span></span>
    </th>
    <th style="padding:10px 14px;...">Avaliação</th>
    <th style="padding:10px 14px;width:32px"></th>
  </tr>
</thead>
```

```js
function sortAdmin(coluna) {
  if (adminOrdemColuna === coluna) {
    adminOrdemDir = adminOrdemDir === 'desc' ? 'asc' : 'desc';
  } else {
    adminOrdemColuna = coluna;
    adminOrdemDir = 'desc';
  }
  // Atualizar indicadores visuais
  ['created_at','titulo','tipo_solicitacao','status'].forEach(c => {
    const el = document.getElementById('sort' + c.split('_').map((w,i) => i===0 ? w.charAt(0).toUpperCase()+w.slice(1) : w.charAt(0).toUpperCase()+w.slice(1)).join('').replace('_solicitacao','').replace('_at','Created'));
    if (el) el.textContent = c === adminOrdemColuna ? (adminOrdemDir === 'desc' ? '↓' : '↑') : '';
  });
  adminPageHistorico = 1;
  loadAdminHistorico();
}
```

E na tabela do `renderAdminHistorico()`, mover a coluna data para primeira posição:

```js
// Linha da tabela — data primeiro:
return `<tr ...>
  <td style="padding:10px 14px;white-space:nowrap">
    <div style="font-size:0.8rem">${data_fmt}</div>
    <div style="font-size:0.72rem;opacity:0.4">${hora_fmt}</div>
  </td>
  <td ...>solicitante</td>
  <td ...>título</td>
  <td ...>tipo</td>
  <td ...>status badge</td>
  <td ...>avaliação</td>
  <td ...>link clickup</td>
</tr>`;
```

---

## OBSERVAÇÕES

- `forms.ts` precisa de build após editar o endpoint `/admin/historico`
- `dashboard.html` não precisa de build
- Os dropdowns fecham ao clicar fora via `document.addEventListener('click')`
- O checkbox "Com avaliação" usa `accent-color:var(--ruby-red)` para
  manter a identidade visual
- Ao trocar entre "Por tipo" e "Por status", os filtros do gráfico
  são resetados automaticamente
