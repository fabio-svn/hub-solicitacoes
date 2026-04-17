# Refatoração — Dashboard: cards expandem para página própria

---

## 1. `dashboard.html` — Cards abrem página própria

### 1a. Substituir `onclick` dos cards de solicitação

No `renderList()`, substituir:
```js
onclick="openDrawerByKey('${esc(cacheKey)}')"
```
Por:
```js
onclick="window.location.href='/solicitacao.html?id=${item.id}'"
```

### 1b. Remover drawer do HTML

Remover completamente:
```html
<div class="drawer-overlay" id="drawerOverlay" onclick="closeDrawer()"></div>
<div class="drawer" id="drawer">
  ...
</div>
```

### 1c. Remover funções do drawer do script

Remover as funções:
- `openDrawerByKey(key)`
- `openDrawer(item)`
- `renderDrawerContent(item)`
- `closeDrawer()`
- `document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); })`

### 1d. Remover `itemsCache` — não é mais necessário

```js
// REMOVER:
let itemsCache = {};
// E todos os blocos que escrevem/leem itemsCache
```

### 1e. Manter todas as funções utilitárias

Manter pois serão usadas em `solicitacao.html`:
- `humanizeValue()`
- `humanizeSlug()`
- `normalizeSlug()`
- `dataRelativa()`
- `periodoGrupo()`
- `getStatusColor()` (se existir)

Obs: essas funções precisarão ser copiadas ou movidas para um arquivo
compartilhado `utils.js` — ver observações ao final.

---

## 2. Criar `solicitacao.html` — Página individual da solicitação

Criar arquivo `/artifacts/api-server/public/solicitacao.html`:

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitação - Hub SVN</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,300;6..12,400;6..12,600;6..12,700&family=Taviraj:wght@300;400&display=swap" media="print" onload="this.media='all'">
  <noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,300;6..12,400;6..12,600;6..12,700&family=Taviraj:wght@300;400&display=swap"></noscript>
  <link rel="stylesheet" href="style.css">
</head>
<body class="page-light">
  <header class="header" id="mainHeader"></header>

  <div class="container" style="padding-top:32px;padding-bottom:80px;max-width:760px">

    <!-- Botão voltar -->
    <a href="/dashboard.html" style="display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;color:var(--carbon-black);opacity:0.5;margin-bottom:24px;text-decoration:none">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      Minhas solicitações
    </a>

    <!-- Skeleton loader -->
    <div id="skeletonLoader">
      <div style="background:var(--icon-bg);border-radius:12px;height:32px;width:60%;margin-bottom:12px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.5) 50%,transparent 75%);background-size:200% 100%;animation:shimmer 1.2s infinite"></div>
      </div>
      <div style="background:var(--icon-bg);border-radius:12px;height:20px;width:40%;margin-bottom:32px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.5) 50%,transparent 75%);background-size:200% 100%;animation:shimmer 1.2s infinite"></div>
      </div>
      <div style="background:var(--icon-bg);border-radius:12px;height:200px;position:relative;overflow:hidden">
        <div style="position:absolute;inset:0;background:linear-gradient(90deg,transparent 25%,rgba(255,255,255,0.5) 50%,transparent 75%);background-size:200% 100%;animation:shimmer 1.2s infinite"></div>
      </div>
    </div>

    <!-- Conteúdo principal -->
    <div id="pageContent" style="display:none">

      <!-- Header da solicitação -->
      <div style="margin-bottom:24px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
          <h1 id="solTitulo" style="font-family:'Taviraj',serif;font-weight:300;font-size:1.8rem;color:var(--carbon-black);margin:0"></h1>
          <span id="solStatus" class="badge" style="font-size:0.8rem;padding:6px 14px;flex-shrink:0"></span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px" id="solBadges"></div>
        <div style="font-size:0.8rem;opacity:0.4;margin-top:8px" id="solMeta"></div>
      </div>

      <!-- Fluxo de andamento -->
      <div class="form-card" style="margin-bottom:20px;padding:24px" id="fluxoCard"></div>

      <!-- Bloco de aprovação (visível só quando em-aprovacao) -->
      <div id="aprovacaoCard" style="display:none;margin-bottom:20px"></div>

      <!-- Dados da solicitação -->
      <div class="form-card" style="padding:24px" id="dadosCard">
        <h3 style="font-weight:700;font-size:0.85rem;text-transform:uppercase;letter-spacing:0.06em;opacity:0.4;margin-bottom:16px">Dados da solicitação</h3>
        <div id="dadosContent"></div>
      </div>

      <!-- Rodapé com ID e data -->
      <div style="margin-top:16px;font-size:0.75rem;opacity:0.35;display:flex;gap:16px;flex-wrap:wrap" id="solRodape"></div>

    </div>
  </div>

  <a href="/solicitacoes.html" class="float-home" style="bottom:78px">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
    <span>Menu</span>
  </a>
  <a href="/" class="float-home">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    <span>Início</span>
  </a>

  <script src="config.js"></script>
  <script src="auth.js"></script>
  <script>
    const params = new URLSearchParams(window.location.search);
    const solicitacaoId = params.get('id');

    function esc(str) {
      if (!str) return '';
      const d = document.createElement('div');
      d.textContent = String(str);
      return d.innerHTML;
    }

    async function init() {
      await _configReady;
      await Auth.init();
      if (!Auth.isAuthenticated()) {
        window.location.href = '/auth/login?redirect=/solicitacao.html?id=' + solicitacaoId;
        return;
      }
      Auth.renderHeader(document.getElementById('mainHeader'));

      if (!solicitacaoId) {
        window.location.href = '/dashboard.html';
        return;
      }

      await loadSolicitacao();
    }

    async function loadSolicitacao() {
      try {
        // Buscar dados da solicitação
        const res = await fetch('/api/solicitacoes/' + solicitacaoId);
        if (!res.ok) { window.location.href = '/dashboard.html'; return; }
        const item = await res.json();

        // Atualizar status via ClickUp em background
        syncStatus(item);

        renderPage(item);
      } catch (e) {
        console.error(e);
        window.location.href = '/dashboard.html';
      }
    }

    async function syncStatus(item) {
      try {
        const syncRes = await fetch('/api/solicitacoes/' + solicitacaoId + '/status');
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.updated && syncData.status !== item.status) {
            item.status = syncData.status;
            renderPage(item);
          }
        }
      } catch {}
    }

    function renderPage(item) {
      document.getElementById('skeletonLoader').style.display = 'none';
      document.getElementById('pageContent').style.display = 'block';

      let dados = {};
      try { dados = typeof item.dados === 'string' ? JSON.parse(item.dados) : (item.dados || {}); } catch {}

      const titulo = dados.nomeEvento || dados.tituloEvento || dados.titulo || dados.nomeCompleto || item.tipo_solicitacao;
      const tipoLabel = TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao] || item.tipo_solicitacao;
      const statusObj = STATUS_SOLICITACAO.find(s => s.id === item.status) || { label: item.status, bg: '#f1f5f9', text: '#475569' };

      // Título e status
      document.getElementById('solTitulo').textContent = titulo;
      const statusEl = document.getElementById('solStatus');
      statusEl.textContent = statusObj.label;
      statusEl.style.background = statusObj.bg;
      statusEl.style.color = statusObj.text;

      // Badges
      const badgesEl = document.getElementById('solBadges');
      badgesEl.innerHTML = `
        <span class="badge" style="background:var(--carbon-black);color:var(--paper-white)">${esc(tipoLabel)}</span>
        ${dados.natureza ? `<span class="badge" style="background:var(--icon-bg);color:var(--carbon-black)">${dados.natureza === 'presencial' ? 'Presencial' : 'Online'}</span>` : ''}
        ${dados.setor ? `<span class="badge" style="background:var(--icon-bg);color:var(--carbon-black)">${esc(dados.setor)}</span>` : ''}
      `;

      // Meta
      document.getElementById('solMeta').textContent =
        `Solicitado em ${new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} às ${new Date(item.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      // Fluxo de andamento
      renderFluxo(item, dados);

      // Bloco de aprovação
      renderAprovacao(item, dados);

      // Dados
      renderDados(dados, item);

      // Rodapé
      document.getElementById('solRodape').innerHTML = `
        <span>ID: ${item.id}</span>
        ${dados.idSolicitacao ? `<span>Código: ${dados.idSolicitacao}</span>` : ''}
      `;

      // Título da página
      document.title = `${titulo} — Hub SVN`;
    }

    function renderFluxo(item, dados) {
      const fluxoCard = document.getElementById('fluxoCard');
      const tipoBase = item.tipo_solicitacao === 'eventos' ? 'eventos' : '_default';
      const fluxo = (typeof FLUXOS_ETAPAS !== 'undefined')
        ? (FLUXOS_ETAPAS[item.tipo_solicitacao] || FLUXOS_ETAPAS[tipoBase] || FLUXOS_ETAPAS['_default'])
        : [];
      const etapasVisiveis = fluxo.filter(e => e.visivel);
      const etapaExcepcional = fluxo.find(e => !e.visivel && e.id === item.status);
      const idxAtual = etapasVisiveis.findIndex(e => e.id === item.status);

      if (etapaExcepcional) {
        fluxoCard.innerHTML = `
          <div style="background:rgba(159,63,55,0.08);border:1px solid rgba(159,63,55,0.2);border-radius:8px;padding:12px 16px;font-size:0.9rem;font-weight:600;color:var(--ruby-red);display:flex;align-items:center;gap:8px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ${etapaExcepcional.label}
          </div>`;
        return;
      }

      if (etapasVisiveis.length === 0) { fluxoCard.style.display = 'none'; return; }

      fluxoCard.innerHTML = `
        <p style="font-size:0.7rem;font-weight:600;letter-spacing:0.07em;text-transform:uppercase;opacity:0.4;margin-bottom:20px">Andamento da solicitação</p>
        <div style="display:flex;flex-direction:column;gap:0">
          ${etapasVisiveis.map((etapa, idx) => {
            const isConcluida = idx < idxAtual;
            const isAtual = idx === idxAtual;
            const isUltima = idx === etapasVisiveis.length - 1;
            const statusEntry = STATUS_SOLICITACAO.find(s => s.id === etapa.id);
            const cor = statusEntry ? { bg: statusEntry.bg, text: statusEntry.text } : { bg: 'transparent', text: 'rgba(34,27,25,0.15)' };
            const circBg = isConcluida ? '#065f46' : isAtual ? cor.bg : 'transparent';
            const circBorder = isConcluida ? '#065f46' : isAtual ? cor.text : 'rgba(34,27,25,0.15)';
            const icone = isConcluida
              ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'
              : isAtual ? `<div style="width:6px;height:6px;border-radius:50%;background:${cor.text}"></div>` : '';
            const lblColor = isConcluida ? '#065f46' : isAtual ? cor.text : 'rgba(34,27,25,0.35)';
            const lblWeight = isAtual ? '700' : '400';
            const estadoLabel = isConcluida
              ? '<span style="font-size:11px;color:#065f46;margin-left:auto;opacity:0.8">Concluído</span>'
              : isAtual ? `<span style="font-size:11px;font-weight:600;color:${cor.text};margin-left:auto">Atual</span>` : '';
            const connector = !isUltima
              ? `<div style="width:2px;height:12px;background:${isConcluida ? '#065f46' : 'rgba(34,27,25,0.1)'};margin-left:9px;flex-shrink:0"></div>`
              : '';
            return `
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:20px;height:20px;border-radius:50%;background:${circBg};border:2px solid ${circBorder};display:flex;align-items:center;justify-content:center;flex-shrink:0">${icone}</div>
                <div style="flex:1;display:flex;align-items:center;justify-content:space-between">
                  <span style="font-size:0.85rem;font-weight:${lblWeight};color:${lblColor}">${etapa.label}</span>
                  ${estadoLabel}
                </div>
              </div>
              ${connector}`;
          }).join('')}
        </div>`;
    }

    function renderAprovacao(item, dados) {
      // Implementado no próximo prompt (sistema de aprovação)
      const card = document.getElementById('aprovacaoCard');
      card.style.display = 'none';
    }

    function renderDados(dados, item) {
      const container = document.getElementById('dadosContent');
      const palKeysProcessed = new Set();
      let html = '';
      let temPalestranteHtml = '';
      let palestrantesHtml = '';

      for (const [key, value] of Object.entries(dados)) {
        if (value === null || value === undefined || value === '') continue;
        if (/^palFoto\d$/.test(key)) continue;

        if (key === 'temPalestrante') {
          const label = (typeof DRAWER_FIELD_LABELS !== 'undefined' && DRAWER_FIELD_LABELS[key]) ? DRAWER_FIELD_LABELS[key] : key;
          temPalestranteHtml = `<div class="drawer-field"><div class="drawer-field-label">${esc(label)}</div><div class="drawer-field-value">${esc(String(value))}</div></div>`;
          continue;
        }

        const palMatch = key.match(/^pal(Svn|Nome|Cargo)(\d)$/);
        if (palMatch) {
          const n = palMatch[2];
          if (palKeysProcessed.has('pal_' + n)) continue;
          palKeysProcessed.add('pal_' + n);
          const nome = String(dados['palNome' + n] || '').trim();
          const cargo = String(dados['palCargo' + n] || '').trim();
          const svn = String(dados['palSvn' + n] || '').trim();
          if (!nome) continue;
          const svnBadge = svn.toLowerCase() === 'sim'
            ? '<span style="background:var(--ruby-red);color:var(--paper-white);font-size:0.65rem;padding:2px 8px;border-radius:999px;font-weight:700;margin-left:6px">SVN</span>' : '';
          palestrantesHtml += `
            <div class="drawer-field" style="background:var(--icon-bg);border-radius:8px;padding:10px 14px;margin-bottom:8px">
              <div style="font-size:0.75rem;opacity:0.45;margin-bottom:4px">Palestrante ${n}</div>
              <div style="font-weight:700;font-size:0.9rem;display:flex;align-items:center">${esc(nome)}${svnBadge}</div>
              ${cargo ? `<div style="font-size:0.8rem;opacity:0.6;margin-top:2px">${esc(cargo)}</div>` : ''}
            </div>`;
          continue;
        }

        const label = (typeof DRAWER_FIELD_LABELS !== 'undefined' && DRAWER_FIELD_LABELS[key]) ? DRAWER_FIELD_LABELS[key] : key;

        if (Array.isArray(value)) {
          if (value.length === 0) continue;
          if (typeof value[0] === 'object') {
            html += `<div class="drawer-field"><div class="drawer-field-label">${esc(label)}</div>
              ${value.map(dep => `<div style="background:var(--icon-bg);border-radius:8px;padding:10px 12px;margin-top:6px;font-size:0.85rem">
                ${dep.texto ? `<div style="font-style:italic;margin-bottom:4px">${esc(dep.texto)}</div>` : ''}
                ${dep.nome ? `<div style="font-weight:600;font-size:0.8rem">${esc(dep.nome)}</div>` : ''}
              </div>`).join('')}</div>`;
          } else {
            html += `<div class="drawer-field"><div class="drawer-field-label">${esc(label)}</div><div class="drawer-field-value">${esc(humanizeValue(key, value))}</div></div>`;
          }
          continue;
        }
        if (typeof value === 'object') continue;
        html += `<div class="drawer-field"><div class="drawer-field-label">${esc(label)}</div><div class="drawer-field-value">${esc(String(humanizeValue(key, value)))}</div></div>`;
      }

      if (temPalestranteHtml || palestrantesHtml) html += temPalestranteHtml + palestrantesHtml;
      container.innerHTML = html || '<p style="opacity:0.5;font-size:0.9rem">Sem dados adicionais</p>';
    }

    // ── Funções utilitárias copiadas do dashboard ──────────────────────────

    function normalizeSlug(value) {
      return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    }

    function titleCasePtBr(text) {
      return String(text).split(' ').filter(Boolean).map(word => {
        const lower = word.toLowerCase();
        const keepLower = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'ao', 'aos'];
        if (keepLower.includes(lower)) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      }).join(' ').replace(/^./, c => c.toUpperCase());
    }

    function humanizeSlug(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return raw;
      const normalized = normalizeSlug(raw);
      const directMap = {
        'pacote-padrao': 'Pacote Padrão', 'em-producao': 'Em produção',
        'nao-definido': 'Não definido', 'aberto ao publico em geral': 'Aberto ao público em geral',
      };
      if (directMap[normalized]) return directMap[normalized];
      let humanized = titleCasePtBr(raw.replace(/[_-]+/g, ' ').trim());
      [
        [/\bPadrao\b/g,'Padrão'],[/\bProducao\b/g,'Produção'],[/\bNao\b/g,'Não'],
        [/\bPagina\b/g,'Página'],[/\bDivulgacao\b/g,'Divulgação'],[/\bAtualizacao\b/g,'Atualização'],
      ].forEach(([p, r]) => { humanized = humanized.replace(p, r); });
      return humanized;
    }

    function humanizeValue(key, value) {
      const maps = {
        natureza: { presencial: 'Presencial', online: 'Online' },
        maturidade: { 1: 'Tenho a maioria das informações', 2: 'Tenho algumas informações', 3: 'Ainda estou estruturando' },
        localEvento: { unidade: 'Unidade SVN', externo: 'Local externo', 'nao-definido': 'Não definido' },
      };
      const materiaisMap = {};
      if (typeof ITENS_MATERIAIS !== 'undefined') ITENS_MATERIAIS.forEach(i => { materiaisMap[normalizeSlug(i.id)] = i.label; });
      if (typeof ITENS_MATERIAIS_ONLINE !== 'undefined') ITENS_MATERIAIS_ONLINE.forEach(i => { materiaisMap[normalizeSlug(i.id)] = i.label; });
      if (key === 'materiais' && Array.isArray(value)) return value.map(v => materiaisMap[normalizeSlug(v)] || humanizeSlug(v)).join(', ');
      if (key === 'selos' && Array.isArray(value) && typeof SELOS_ASSESSOR !== 'undefined') {
        const selosMap = {};
        SELOS_ASSESSOR.forEach(s => { selosMap[normalizeSlug(s.id)] = s.label; });
        return value.map(v => selosMap[normalizeSlug(v)] || humanizeSlug(v)).join(' · ');
      }
      if (maps[key]) {
        const nv = normalizeSlug(value);
        for (const [mk, ml] of Object.entries(maps[key])) { if (normalizeSlug(mk) === nv) return ml; }
      }
      if (typeof value === 'string' && (value.includes('-') || value.includes('_'))) return humanizeSlug(value);
      return value;
    }

    init();
  </script>
</body>
</html>
```

---

## OBSERVAÇÕES

- O `GET /api/solicitacoes/:id` já existe no backend e retorna os dados ✅
- As funções utilitárias (`humanizeValue`, `normalizeSlug`, etc.) foram
  copiadas para `solicitacao.html` — considerar extrair para `utils.js`
  compartilhado em um próximo cleanup
- O bloco `renderAprovacao()` está vazio propositalmente — será implementado
  no próximo prompt (sistema de aprovação)
- Não é necessário build — apenas arquivos HTML/JS do frontend
