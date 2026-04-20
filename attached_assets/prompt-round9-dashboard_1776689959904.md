# Round 9 — Dashboard

---

## 1. `dashboard.html` — Inverter ordem das abas + memória de aba

### 1a. Inverter ordem das abas no HTML

```html
<!-- DE: -->
<button class="tab-btn active" data-tab="eventos">Eventos</button>
<button class="tab-btn" data-tab="geral">Solicitações gerais</button>

<!-- PARA: -->
<button class="tab-btn active" data-tab="geral">Solicitações gerais</button>
<button class="tab-btn" data-tab="eventos">Eventos</button>
```

### 1b. Adicionar memória de aba com `localStorage`

Substituir a função `switchTab()`:

```js
function switchTab(tab) {
  pages[tab] = 1;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  // Salvar aba ativa
  localStorage.setItem('dashboard_tab', tab);
  loadList(tab);
}
```

No `init()`, após renderizar as abas, restaurar a aba salva:

```js
// Restaurar aba salva ou usar padrão
const tabSalva = localStorage.getItem('dashboard_tab') || 'geral';
switchTab(tabSalva);
```

Remover qualquer chamada inicial fixa a `switchTab('eventos')` ou
`loadList('eventos')` que possa existir no init.

---

## 2. `dashboard.html` — Botão de link ClickUp visível apenas para admins

### 2a. No `renderList()`, adicionar botão de link após o badge de status

Dentro do template do card de solicitação, após o badge de status,
adicionar botão condicional:

```js
// Após: <span class="badge" style="...">...</span>
// Adicionar:

${Auth.isAdmin() && item.clickup_task_id ? `
  <a href="https://app.clickup.com/t/${esc(item.clickup_task_id)}"
     target="_blank" rel="noopener"
     onclick="event.stopPropagation()"
     title="Abrir no ClickUp"
     style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(124,45,18,0.08);border-radius:6px;font-size:0.72rem;font-weight:600;color:var(--ruby-red);text-decoration:none;flex-shrink:0;transition:background 0.15s"
     onmouseover="this.style.background='rgba(124,45,18,0.15)'"
     onmouseout="this.style.background='rgba(124,45,18,0.08)'">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    ClickUp
  </a>
` : ''}
```

### 2b. Garantir que `Auth.isAdmin()` existe

Em `auth.js`, verificar que existe a função:
```js
isAdmin() {
  return this._user?.role === 'admin' || this._user?.role === 'gestor';
}
```
Se não existir, adicionar ao objeto `Auth`.

---

## OBSERVAÇÕES

- Sem build necessário — apenas `dashboard.html` e `auth.js`
- O `event.stopPropagation()` no link ClickUp evita que o clique
  abra a página da solicitação ao mesmo tempo que abre o ClickUp
- A aba salva persiste entre sessões via `localStorage`
