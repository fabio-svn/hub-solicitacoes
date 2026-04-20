# Feature — Dashboard Admin

---

## VISÃO GERAL

Nova aba "Painel Admin" no `dashboard.html`, visível apenas para admins/gestores.
Contém:
- Filtro de período (7 dias padrão, personalizável)
- Cards de resumo com delta vs período anterior
- Gráfico de pizza alternável (por tipo / por status)
- Tabela de histórico completo com filtros
- Coluna de avaliação em cada linha

---

## 1. `forms.ts` — Novos endpoints de admin

### 1a. GET `/admin/stats` — Resumo com delta

```ts
router.get("/admin/stats", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias)) || 7));
    const now = new Date();
    const periodoAtual = new Date(now.getTime() - dias * 86400000);
    const periodoAnterior = new Date(periodoAtual.getTime() - dias * 86400000);

    // Total no período atual
    const [atual] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`);

    // Total no período anterior (para delta)
    const [anterior] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAnterior.toISOString()}`,
        sql`${solicitacoesTable.created_at} < ${periodoAtual.toISOString()}`
      ));

    // Por tipo no período atual
    const porTipo = await db.select({
      tipo: solicitacoesTable.tipo_solicitacao,
      count: sql<number>`count(*)`
    })
      .from(solicitacoesTable)
      .where(sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`)
      .groupBy(solicitacoesTable.tipo_solicitacao)
      .orderBy(desc(sql`count(*)`));

    // Por status no período atual
    const porStatus = await db.select({
      status: solicitacoesTable.status,
      count: sql<number>`count(*)`
    })
      .from(solicitacoesTable)
      .where(sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`)
      .groupBy(solicitacoesTable.status)
      .orderBy(desc(sql`count(*)`));

    // Avaliações no período
    const [avaliacoes] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`,
        sql`${solicitacoesTable.avaliacao} IS NOT NULL`
      ));

    // Média das notas no período
    const [mediaNotas] = await db.select({
      media: sql<number>`avg((avaliacao->>'nota')::numeric)`
    })
      .from(solicitacoesTable)
      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`,
        sql`${solicitacoesTable.avaliacao} IS NOT NULL`
      ));

    const totalAtual = Number(atual.count);
    const totalAnterior = Number(anterior.count);
    const delta = totalAnterior === 0
      ? (totalAtual > 0 ? 100 : 0)
      : Math.round(((totalAtual - totalAnterior) / totalAnterior) * 100);

    res.json({
      total: totalAtual,
      delta,
      deltaPositivo: totalAtual >= totalAnterior,
      porTipo: porTipo.map(r => ({ tipo: r.tipo, count: Number(r.count) })),
      porStatus: porStatus.map(r => ({ status: r.status, count: Number(r.count) })),
      avaliacoes: Number(avaliacoes.count),
      mediaNotas: mediaNotas.media ? Number(mediaNotas.media).toFixed(1) : null,
      dias,
    });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar stats admin");
    res.status(500).json({ error: "Erro ao buscar estatísticas" });
  }
});
```

### 1b. GET `/admin/historico` — Histórico completo

```ts
router.get("/admin/historico", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 25));
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof sql>[] = [];

    if (req.query.busca) {
      const term = `%${String(req.query.busca).replace(/%/g, "\\%")}%`;
      conditions.push(sql`(
        ${solicitacoesTable.titulo} ILIKE ${term} OR
        ${solicitacoesTable.user_email} ILIKE ${term} OR
        ${solicitacoesTable.dados}::text ILIKE ${term}
      )`);
    }

    if (req.query.tipo) {
      const tipo = String(req.query.tipo);
      if (tipo === "eventos") {
        conditions.push(sql`${solicitacoesTable.tipo_solicitacao} = 'eventos'`);
      } else if (tipo !== "") {
        conditions.push(sql`${solicitacoesTable.tipo_solicitacao} = ${tipo}`);
      }
    }

    if (req.query.status && String(req.query.status) !== "") {
      conditions.push(sql`${solicitacoesTable.status} = ${String(req.query.status)}`);
    }

    if (req.query.de) {
      conditions.push(sql`${solicitacoesTable.created_at} >= ${new Date(String(req.query.de)).toISOString()}`);
    }
    if (req.query.ate) {
      const ate = new Date(String(req.query.ate));
      ate.setHours(23, 59, 59, 999);
      conditions.push(sql`${solicitacoesTable.created_at} <= ${ate.toISOString()}`);
    }

    if (req.query.avaliacao === "sim") {
      conditions.push(sql`${solicitacoesTable.avaliacao} IS NOT NULL`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.select({
      id: solicitacoesTable.id,
      user_email: solicitacoesTable.user_email,
      tipo_solicitacao: solicitacoesTable.tipo_solicitacao,
      status: solicitacoesTable.status,
      titulo: solicitacoesTable.titulo,
      created_at: solicitacoesTable.created_at,
      clickup_url: solicitacoesTable.clickup_url,
      avaliacao: solicitacoesTable.avaliacao,
    })
      .from(solicitacoesTable)
      .where(whereClause)
      .orderBy(desc(solicitacoesTable.created_at))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(solicitacoesTable)
      .where(whereClause);

    res.json({
      data: results,
      total: Number(countResult.count),
      page,
      limit,
      totalPages: Math.ceil(Number(countResult.count) / limit),
    });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar histórico admin");
    res.status(500).json({ error: "Erro ao buscar histórico" });
  }
});
```

---

## 2. `dashboard.html` — Adicionar aba Admin

### 2a. Adicionar aba no HTML (visível só para admins via JS)

```html
<!-- Adicionar após a aba "Eventos": -->
<button class="tab" data-tab="admin" id="tabAdmin" onclick="switchTab('admin')" style="display:none">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.7"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  Painel Admin
</button>
```

### 2b. Adicionar conteúdo da aba admin

```html
<div class="tab-content" id="tab-admin" style="display:none">

  <!-- Filtro de período -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">
    <span style="font-size:0.8rem;font-weight:600;opacity:0.5">Período:</span>
    <div style="display:flex;gap:6px;flex-wrap:wrap" id="adminPeriodoBtns">
      <button class="filter-chip active" data-dias="7" onclick="setAdminPeriodo(this)">7 dias</button>
      <button class="filter-chip" data-dias="14" onclick="setAdminPeriodo(this)">14 dias</button>
      <button class="filter-chip" data-dias="30" onclick="setAdminPeriodo(this)">30 dias</button>
      <button class="filter-chip" data-dias="90" onclick="setAdminPeriodo(this)">90 dias</button>
    </div>
    <div style="display:flex;gap:6px;align-items:center;margin-left:auto">
      <input type="date" id="adminDe" style="padding:5px 10px;border:1px solid var(--border-light);border-radius:7px;font-size:0.8rem;font-family:'Nunito Sans',sans-serif" onchange="setAdminCustomPeriodo()">
      <span style="font-size:0.8rem;opacity:0.4">até</span>
      <input type="date" id="adminAte" style="padding:5px 10px;border:1px solid var(--border-light);border-radius:7px;font-size:0.8rem;font-family:'Nunito Sans',sans-serif" onchange="setAdminCustomPeriodo()">
    </div>
  </div>

  <!-- Cards de resumo -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px" id="adminCards">
    <div class="stat-card" id="adminCardTotal">
      <div class="stat-number" id="adminTotal">—</div>
      <div class="stat-label">Solicitações</div>
      <div id="adminDelta" style="font-size:0.75rem;margin-top:4px;font-weight:600"></div>
    </div>
    <div class="stat-card" id="adminCardAvaliacoes">
      <div class="stat-number" id="adminAvaliacoes">—</div>
      <div class="stat-label">Com avaliação</div>
      <div id="adminMediaNota" style="font-size:0.75rem;margin-top:4px;font-weight:600;opacity:0.6"></div>
    </div>
  </div>

  <!-- Gráfico de pizza -->
  <div class="form-card" style="padding:20px;margin-bottom:20px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:8px">
      <span style="font-size:0.8rem;font-weight:700;opacity:0.5;text-transform:uppercase;letter-spacing:0.06em">Distribuição</span>
      <div style="display:flex;gap:4px">
        <button id="graficoBtnTipo" class="filter-chip active" onclick="switchGrafico('tipo')">Por tipo</button>
        <button id="graficoBtnStatus" class="filter-chip" onclick="switchGrafico('status')">Por status</button>
      </div>
    </div>
    <div id="graficoContainer" style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
      <canvas id="adminPizza" width="200" height="200" style="flex-shrink:0;max-width:200px"></canvas>
      <div id="adminLegenda" style="flex:1;min-width:180px;display:flex;flex-direction:column;gap:8px"></div>
    </div>
  </div>

  <!-- Histórico -->
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
    <div class="search-bar" style="flex:1;margin-bottom:0;min-width:180px;height:32px;padding:0 14px;border-radius:8px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" opacity="0.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" placeholder="Buscar por título, e-mail..." id="adminBusca" oninput="debounceAdminSearch()">
    </div>
    <select id="adminFiltroTipo" onchange="loadAdminHistorico()" style="padding:5px 10px;border:1px solid var(--border-light);border-radius:7px;font-size:0.82rem;font-family:'Nunito Sans',sans-serif">
      <option value="">Todos os tipos</option>
      <option value="eventos">Eventos</option>
      <option value="artes-divulgacao">Arte de Divulgação</option>
      <option value="apresentacao-nova">Apresentação Nova</option>
      <option value="apresentacao-atualizar">Atualização de Apresentação</option>
      <option value="conteudo-pdf-informativo">PDF Informativo</option>
      <option value="conteudo-pdf-ebook">PDF Ebook</option>
      <option value="atualizacao-material">Atualização de Material</option>
      <option value="pagina-assessores-dados">Página de Assessores</option>
      <option value="pagina-assessores-atualizacao">Att. Página de Assessores</option>
    </select>
    <select id="adminFiltroStatus" onchange="loadAdminHistorico()" style="padding:5px 10px;border:1px solid var(--border-light);border-radius:7px;font-size:0.82rem;font-family:'Nunito Sans',sans-serif">
      <option value="">Todos os status</option>
      <option value="recebido">Recebido</option>
      <option value="em-analise">Em análise</option>
      <option value="em-producao">Em produção</option>
      <option value="em-revisao">Em revisão</option>
      <option value="em-aprovacao">Em aprovação</option>
      <option value="aguardando">Aguardando</option>
      <option value="concluido">Concluído</option>
      <option value="cancelado">Cancelado</option>
    </select>
    <select id="adminFiltroAvaliacao" onchange="loadAdminHistorico()" style="padding:5px 10px;border:1px solid var(--border-light);border-radius:7px;font-size:0.82rem;font-family:'Nunito Sans',sans-serif">
      <option value="">Todas</option>
      <option value="sim">Com avaliação</option>
    </select>
  </div>

  <!-- Tabela -->
  <div style="overflow-x:auto;border-radius:12px;border:1px solid var(--border-light)">
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem" id="adminTabela">
      <thead>
        <tr style="background:var(--icon-bg);text-align:left">
          <th style="padding:10px 14px;font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">Solicitante</th>
          <th style="padding:10px 14px;font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">Título</th>
          <th style="padding:10px 14px;font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">Tipo</th>
          <th style="padding:10px 14px;font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">Status</th>
          <th style="padding:10px 14px;font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">Data</th>
          <th style="padding:10px 14px;font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">Avaliação</th>
          <th style="padding:10px 14px;font-weight:700;opacity:0.5;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em"></th>
        </tr>
      </thead>
      <tbody id="adminTabelaBody">
        <tr><td colspan="7" style="padding:24px;text-align:center;opacity:0.4">Carregando...</td></tr>
      </tbody>
    </table>
  </div>
  <div class="pagination" id="adminPaginacao" style="margin-top:12px"></div>

</div>
```

### 2c. Adicionar script do painel admin

```js
// ── Admin Dashboard ──────────────────────────────────────────

let adminDias = 7;
let adminPageHistorico = 1;
let adminGraficoModo = 'tipo'; // 'tipo' ou 'status'
let adminGraficoData = null;
let adminSearchTimeout;
let adminPizzaChart = null;

function initAdmin() {
  if (!Auth.isAdmin()) return;
  document.getElementById('tabAdmin').style.display = '';
}

function setAdminPeriodo(btn) {
  document.querySelectorAll('#adminPeriodoBtns .filter-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  adminDias = parseInt(btn.dataset.dias);
  // Limpar inputs de data customizada
  document.getElementById('adminDe').value = '';
  document.getElementById('adminAte').value = '';
  loadAdminStats();
}

function setAdminCustomPeriodo() {
  // Desativar chips de período
  document.querySelectorAll('#adminPeriodoBtns .filter-chip').forEach(b => b.classList.remove('active'));
  adminDias = null; // custom
  loadAdminStats();
}

async function loadAdminStats() {
  try {
    let url = '/api/admin/stats';
    const de = document.getElementById('adminDe').value;
    const ate = document.getElementById('adminAte').value;
    if (de || ate) {
      // Para período customizado, calcular dias aproximado
      if (de && ate) {
        const diff = Math.ceil((new Date(ate) - new Date(de)) / 86400000);
        url += '?dias=' + Math.max(1, diff);
      } else {
        url += '?dias=' + (adminDias || 7);
      }
    } else {
      url += '?dias=' + (adminDias || 7);
    }

    const res = await fetch(url);
    const data = await res.json();

    // Cards
    document.getElementById('adminTotal').textContent = data.total;
    document.getElementById('adminAvaliacoes').textContent = data.avaliacoes;
    document.getElementById('adminMediaNota').textContent =
      data.mediaNotas ? `Média: ${data.mediaNotas}/10` : 'Sem notas ainda';

    // Delta
    const deltaEl = document.getElementById('adminDelta');
    if (data.delta !== undefined) {
      const sinal = data.deltaPositivo ? '+' : '';
      const cor = data.delta === 0 ? 'rgba(34,27,25,0.4)' : data.deltaPositivo ? '#16a34a' : '#dc2626';
      deltaEl.innerHTML = `<span style="color:${cor}">${sinal}${data.delta}% vs período anterior</span>`;
    }

    // Guardar dados para o gráfico
    adminGraficoData = data;
    renderAdminGrafico();
  } catch (e) { console.error(e); }
}

function switchGrafico(modo) {
  adminGraficoModo = modo;
  document.getElementById('graficoBtnTipo').classList.toggle('active', modo === 'tipo');
  document.getElementById('graficoBtnStatus').classList.toggle('active', modo === 'status');
  renderAdminGrafico();
}

function renderAdminGrafico() {
  if (!adminGraficoData) return;

  const itens = adminGraficoModo === 'tipo'
    ? adminGraficoData.porTipo.map(i => ({
        label: TIPO_SOLICITACAO_LABELS[i.tipo] || i.tipo,
        value: i.count
      }))
    : adminGraficoData.porStatus.map(i => ({
        label: (STATUS_SOLICITACAO.find(s => s.id === i.status)?.label) || i.status,
        value: i.count,
        cor: STATUS_SOLICITACAO.find(s => s.id === i.status)?.bg || null,
      }));

  const total = itens.reduce((a, b) => a + b.value, 0);
  if (total === 0) {
    document.getElementById('adminLegenda').innerHTML =
      '<p style="opacity:0.4;font-size:0.85rem">Nenhuma solicitação no período.</p>';
    return;
  }

  // Paleta de cores
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

  // Donut hole
  ctx.beginPath();
  ctx.arc(cx, cy, rInner, 0, 2 * Math.PI);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--paper-white').trim() || '#FFF8F3';
  ctx.fill();

  // Total no centro
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

async function loadAdminHistorico() {
  const tbody = document.getElementById('adminTabelaBody');
  tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;opacity:0.4">Carregando...</td></tr>';

  const params = new URLSearchParams();
  params.set('page', adminPageHistorico);
  params.set('limit', '25');

  const busca = document.getElementById('adminBusca')?.value?.trim();
  if (busca) params.set('busca', busca);

  const tipo = document.getElementById('adminFiltroTipo')?.value;
  if (tipo) params.set('tipo', tipo);

  const status = document.getElementById('adminFiltroStatus')?.value;
  if (status) params.set('status', status);

  const avaliacao = document.getElementById('adminFiltroAvaliacao')?.value;
  if (avaliacao) params.set('avaliacao', avaliacao);

  const de = document.getElementById('adminDe')?.value;
  const ate = document.getElementById('adminAte')?.value;
  if (de) params.set('de', de);
  if (ate) params.set('ate', ate);

  try {
    const res = await fetch('/api/admin/historico?' + params.toString());
    const data = await res.json();
    renderAdminHistorico(data);
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--ruby-red)">Erro ao carregar.</td></tr>';
  }
}

function renderAdminHistorico(data) {
  const tbody = document.getElementById('adminTabelaBody');

  if (!data.data || data.data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;opacity:0.4">Nenhuma solicitação encontrada.</td></tr>';
    document.getElementById('adminPaginacao').innerHTML = '';
    return;
  }

  tbody.innerHTML = data.data.map(item => {
    const tipoLabel = TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao] || item.tipo_solicitacao;
    const statusObj = STATUS_SOLICITACAO.find(s => s.id === item.status) || { label: item.status, bg: '#f1f5f9', text: '#475569' };
    const data_fmt = new Date(item.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const hora_fmt = new Date(item.created_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const avaliacao = item.avaliacao;
    const notaHtml = avaliacao?.nota
      ? `<span style="font-weight:700;color:${avaliacao.nota >= 8 ? '#16a34a' : avaliacao.nota >= 5 ? '#ea580c' : '#dc2626'}">${avaliacao.nota}/10</span>`
      : '<span style="opacity:0.3">—</span>';

    return `<tr style="border-top:1px solid var(--border-light);cursor:pointer;transition:background 0.15s"
      onclick="window.location.href='/solicitacao.html?id=${item.id}'"
      onmouseover="this.style.background='var(--icon-bg)'"
      onmouseout="this.style.background=''">
      <td style="padding:10px 14px;max-width:140px">
        <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.user_email?.split('@')[0] || '—')}</div>
        <div style="font-size:0.72rem;opacity:0.4">${esc(item.user_email?.split('@')[1] || '')}</div>
      </td>
      <td style="padding:10px 14px;max-width:200px">
        <div style="font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.titulo || '—')}</div>
      </td>
      <td style="padding:10px 14px;white-space:nowrap">
        <span style="font-size:0.78rem;opacity:0.7">${esc(tipoLabel)}</span>
      </td>
      <td style="padding:10px 14px">
        <span class="badge" style="background:${statusObj.bg};color:${statusObj.text};font-size:0.72rem;white-space:nowrap">${esc(statusObj.label)}</span>
      </td>
      <td style="padding:10px 14px;white-space:nowrap">
        <div style="font-size:0.8rem">${data_fmt}</div>
        <div style="font-size:0.72rem;opacity:0.4">${hora_fmt}</div>
      </td>
      <td style="padding:10px 14px;text-align:center">
        ${notaHtml}
        ${avaliacao?.comentario ? `<div style="font-size:0.7rem;opacity:0.5;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(avaliacao.comentario)}">${esc(avaliacao.comentario)}</div>` : ''}
      </td>
      <td style="padding:10px 14px">
        ${item.clickup_url ? `<a href="${esc(item.clickup_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" style="font-size:0.75rem;color:var(--ruby-red);font-weight:600;text-decoration:none;opacity:0.7" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">↗ CU</a>` : ''}
      </td>
    </tr>`;
  }).join('');

  // Paginação
  const pag = document.getElementById('adminPaginacao');
  if (data.totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = '';
  html += `<button ${data.page <= 1 ? 'disabled' : ''} onclick="adminGoPage(${data.page - 1})">&laquo;</button>`;
  const start = Math.max(1, data.page - 2);
  const end = Math.min(data.totalPages, data.page + 2);
  if (start > 1) html += `<button onclick="adminGoPage(1)">1</button>${start > 2 ? '<span>…</span>' : ''}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="${i === data.page ? 'active' : ''}" onclick="adminGoPage(${i})">${i}</button>`;
  }
  if (end < data.totalPages) html += `${end < data.totalPages - 1 ? '<span>…</span>' : ''}<button onclick="adminGoPage(${data.totalPages})">${data.totalPages}</button>`;
  html += `<button ${data.page >= data.totalPages ? 'disabled' : ''} onclick="adminGoPage(${data.page + 1})">&raquo;</button>`;
  pag.innerHTML = html;
}

function adminGoPage(page) {
  adminPageHistorico = page;
  loadAdminHistorico();
}

function debounceAdminSearch() {
  clearTimeout(adminSearchTimeout);
  adminSearchTimeout = setTimeout(() => { adminPageHistorico = 1; loadAdminHistorico(); }, 300);
}
```

### 2d. Atualizar `switchTab()` para suportar aba admin

```js
// No switchTab existente, adicionar carregamento da aba admin:
function switchTab(tab) {
  currentTab = tab;
  localStorage.setItem('svn_dashboard_tab', tab);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => {
    c.classList.toggle('active', c.id === 'tab-' + tab);
    c.style.display = c.id === 'tab-' + tab ? '' : 'none';
  });
  if (tab === 'admin') {
    loadAdminStats();
    loadAdminHistorico();
  } else {
    const listEl = document.getElementById(tab === 'eventos' ? 'listEventos' : 'listGeral');
    if (listEl && !listEl.hasChildNodes()) loadList(tab);
  }
}
```

### 2e. Atualizar `init()` para chamar `initAdmin()`

```js
// No final de init(), após Auth.renderHeader:
initAdmin();
```

---

## OBSERVAÇÕES

- Após editar `forms.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- `dashboard.html` não precisa de build
- O gráfico usa Canvas 2D puro — sem dependências externas
- A aba Admin só aparece se `Auth.isAdmin()` retornar true
- O delta é calculado comparando o período atual com o período
  imediatamente anterior de mesma duração
- Comentários de avaliação aparecem truncados na tabela com tooltip
  no hover (`title=`) para não quebrar o layout
- Para exportar o histórico como CSV (feature futura), o endpoint
  `/admin/historico` já retorna todos os campos necessários
