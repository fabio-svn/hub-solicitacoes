# Correção — solicitacoes.html e dashboard.html

---

## 1. solicitacoes.html — Corrigir init()

Substituir a função `init()` atual por:

```js
async function init() {
  await _configReady;  // aguardar URLs do servidor
  await Auth.init();
  if (!Auth.isAuthenticated()) {
    window.location.href = '/auth/login?redirect=/solicitacoes.html';
    return;
  }
  Auth.renderHeader(document.getElementById('mainHeader'));
  // Remover bloco que adiciona dashBtn manualmente — já está no menu suspenso
  renderCategories();
}
```

**Remover completamente** o bloco abaixo que vem após `Auth.renderHeader(...)`:
```js
// REMOVER este bloco inteiro:
const headerInner = document.querySelector('.header-inner');
if (headerInner) {
  const dashBtn = document.createElement('a');
  dashBtn.href = '/dashboard.html';
  // ... etc
}
```

---

## 2. solicitacoes.html — Remover importação de transitions.js

As transições foram incorporadas ao `auth.js`. Remover do `<head>`:
```html
<!-- REMOVER esta linha: -->
<script src="transitions.js"></script>
```

---

## 3. solicitacoes.html — Fechar sub-options com Escape

Adicionar no `<script>`, junto ao restante dos event listeners:

```js
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('subOptionsOverlay').classList.remove('visible');
  }
});
```

---

## 4. dashboard.html — Remover importação de transitions.js

Remover do `<head>`:
```html
<!-- REMOVER esta linha: -->
<script src="transitions.js"></script>
```

---

## 5. dashboard.html — Corrigir openDrawer() com DRAWER_FIELD_LABELS

Substituir a função `openDrawer()` completa por:

```js
async function openDrawer(item) {
  try {
    const syncRes = await fetch('/api/solicitacoes/' + item.id + '/status');
    if (syncRes.ok) {
      const syncData = await syncRes.json();
      if (syncData.updated) item.status = syncData.status;
    }
  } catch {}

  // Parsear dados com segurança
  let dados = {};
  try {
    dados = typeof item.dados === 'string' ? JSON.parse(item.dados) : (item.dados || {});
  } catch {
    dados = {};
  }

  const titulo = dados.nomeEvento || dados.tituloEvento || dados.titulo || dados.nomeCompleto || item.tipo_solicitacao;
  const tipoLabel = TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao] || item.tipo_solicitacao;
  const statusObj = STATUS_SOLICITACAO.find(s => s.id === item.status) || { label: item.status, cor: '--carbon-black' };

  document.getElementById('drawerTitle').textContent = titulo;
  document.getElementById('drawerBadges').innerHTML = `
    <span class="badge" style="background:var(--carbon-black);color:var(--paper-white)">${esc(tipoLabel)}</span>
    <span class="badge" style="background:var(${statusObj.cor || '--carbon-black'});color:var(--paper-white)">${esc(statusObj.label)}</span>
  `;

  // Renderizar campos usando DRAWER_FIELD_LABELS para labels legíveis
  let bodyHtml = '';
  for (const [key, value] of Object.entries(dados)) {
    if (value === null || value === undefined || value === '') continue;

    const label = (typeof DRAWER_FIELD_LABELS !== 'undefined' && DRAWER_FIELD_LABELS[key])
      ? DRAWER_FIELD_LABELS[key]
      : key; // fallback para a chave se não tiver label

    // Arrays: exibir como lista legível
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      // Arrays de objetos (ex: depoimentos)
      if (typeof value[0] === 'object') {
        bodyHtml += `<div class="drawer-field">
          <div class="drawer-field-label">${esc(label)}</div>
          ${value.map(dep => `
            <div style="background:var(--icon-bg);border-radius:8px;padding:10px 12px;margin-top:6px;font-size:0.85rem">
              ${dep.texto ? `<div style="font-style:italic;margin-bottom:4px">${esc(dep.texto)}</div>` : ''}
              ${dep.nome ? `<div style="font-weight:600;font-size:0.8rem">${esc(dep.nome)}</div>` : ''}
            </div>
          `).join('')}
        </div>`;
      } else {
        // Arrays simples (ex: selos, materiais)
        bodyHtml += `<div class="drawer-field">
          <div class="drawer-field-label">${esc(label)}</div>
          <div class="drawer-field-value">${value.map(v => esc(String(v))).join(' · ')}</div>
        </div>`;
      }
      continue;
    }

    // Objetos aninhados — pular (não exibir JSON cru)
    if (typeof value === 'object') continue;

    bodyHtml += `<div class="drawer-field">
      <div class="drawer-field-label">${esc(label)}</div>
      <div class="drawer-field-value">${esc(String(value))}</div>
    </div>`;
  }

  document.getElementById('drawerBody').innerHTML = bodyHtml || '<p style="opacity:0.5">Sem dados adicionais</p>';
  document.getElementById('drawerFooter').textContent = `ID: ${item.id} | Criado em: ${new Date(item.created_at).toLocaleString('pt-BR')}`;

  document.getElementById('drawerOverlay').classList.add('visible');
  document.getElementById('drawer').classList.add('open');
}
```

---

## 6. dashboard.html — Corrigir renderList() com JSON.parse seguro

Na função `renderList()`, substituir a linha:
```js
const dados = typeof item.dados === 'string' ? JSON.parse(item.dados) : (item.dados || {});
```
Por:
```js
let dados = {};
try {
  dados = typeof item.dados === 'string' ? JSON.parse(item.dados) : (item.dados || {});
} catch { dados = {}; }
```

---

## 7. dashboard.html — Corrigir animateNumber com target=0

Substituir a função `animateNumber()` por:

```js
function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  // Se target é 0, exibir diretamente sem animação
  if (!target || target === 0) {
    el.textContent = '0';
    return;
  }
  let current = 0;
  const duration = 600;
  const step = target / (duration / 16);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = Math.round(current);
  }, 16);
}
```

---

## 8. dashboard.html — Limpar itemsCache ao trocar de aba

Na função `switchTab()`, adicionar limpeza do cache:

```js
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
  // Limpar cache da aba anterior para evitar crescimento indefinido
  const otherTab = tab === 'eventos' ? 'geral' : 'eventos';
  Object.keys(itemsCache).forEach(k => {
    if (k.startsWith(otherTab + '_')) delete itemsCache[k];
  });
}
```

---

## OBSERVAÇÕES

- Não alterar nenhuma outra função além das listadas
- O `transitions.js` pode ser mantido como arquivo vazio ou deletado — as transições agora estão no `auth.js`
- Após aplicar, verificar se o drawer exibe corretamente os campos com labels legíveis
