# Correção — Drawer: labels e agrupamento de palestrantes

Dois ajustes no `dashboard.html` e `config.js`:
1. Adicionar labels legíveis para os campos de palestrantes no `DRAWER_FIELD_LABELS`
2. Agrupar palestrantes por número no drawer em vez de exibir campo por campo

---

## 1. `config.js` — Adicionar labels de palestrantes ao `DRAWER_FIELD_LABELS`

Adicionar ao objeto `DRAWER_FIELD_LABELS`:
```js
// Palestrantes
temPalestrante: "Tem palestrante(s)?",
palSvn1:        "Palestrante 1 — SVN?",
palNome1:       "Palestrante 1 — Nome",
palCargo1:      "Palestrante 1 — Cargo",
palSvn2:        "Palestrante 2 — SVN?",
palNome2:       "Palestrante 2 — Nome",
palCargo2:      "Palestrante 2 — Cargo",
palSvn3:        "Palestrante 3 — SVN?",
palNome3:       "Palestrante 3 — Nome",
palCargo3:      "Palestrante 3 — Cargo",
palSvn4:        "Palestrante 4 — SVN?",
palNome4:       "Palestrante 4 — Nome",
palCargo4:      "Palestrante 4 — Cargo",
```

---

## 2. `dashboard.html` — Agrupar palestrantes no drawer

No `renderDrawerContent()`, substituir o loop genérico de `Object.entries(dados)`
por uma versão que detecta campos de palestrantes e os agrupa.

Localizar o bloco que monta `bodyHtml`:
```js
let bodyHtml = '';
for (const [key, value] of Object.entries(dados)) {
  // ...
}
```

Substituir por:

```js
let bodyHtml = '';
const dadosEntries = Object.entries(dados);

// Campos de palestrantes já processados (para não renderizar duas vezes)
const palKeysProcessed = new Set();

for (const [key, value] of dadosEntries) {
  if (value === null || value === undefined || value === '') continue;

  // Detectar se é campo de palestrante numerado
  const palMatch = key.match(/^pal(Svn|Nome|Cargo)(\d)$/);
  if (palMatch) {
    const n = palMatch[2];
    if (palKeysProcessed.has('pal_' + n)) continue;
    palKeysProcessed.add('pal_' + n);

    // Montar bloco agrupado para este palestrante
    const nome  = String(dados['palNome'  + n] || '').trim();
    const cargo = String(dados['palCargo' + n] || '').trim();
    const svn   = String(dados['palSvn'   + n] || '').trim();
    if (!nome) continue;

    const svnBadge = svn.toLowerCase() === 'sim'
      ? `<span style="background:var(--ruby-red);color:var(--paper-white);font-size:0.65rem;padding:2px 8px;border-radius:999px;font-weight:700;margin-left:6px">SVN</span>`
      : '';

    bodyHtml += `
      <div class="drawer-field" style="background:var(--icon-bg);border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="font-size:0.75rem;opacity:0.45;margin-bottom:4px">Palestrante ${n}</div>
        <div style="font-weight:700;font-size:0.9rem;display:flex;align-items:center">
          ${esc(nome)}${svnBadge}
        </div>
        ${cargo ? `<div style="font-size:0.8rem;opacity:0.6;margin-top:2px">${esc(cargo)}</div>` : ''}
      </div>`;
    continue;
  }

  // Campos de array (depoimentos, materiais, selos)
  const label = (typeof DRAWER_FIELD_LABELS !== 'undefined' && DRAWER_FIELD_LABELS[key])
    ? DRAWER_FIELD_LABELS[key] : key;

  if (Array.isArray(value)) {
    if (value.length === 0) continue;
    if (typeof value[0] === 'object') {
      bodyHtml += `<div class="drawer-field"><div class="drawer-field-label">${esc(label)}</div>
        ${value.map(dep => `<div style="background:var(--icon-bg);border-radius:8px;padding:10px 12px;margin-top:6px;font-size:0.85rem">
          ${dep.texto ? `<div style="font-style:italic;margin-bottom:4px">${esc(dep.texto)}</div>` : ''}
          ${dep.nome  ? `<div style="font-weight:600;font-size:0.8rem">${esc(dep.nome)}</div>`  : ''}
        </div>`).join('')}</div>`;
    } else {
      bodyHtml += `<div class="drawer-field"><div class="drawer-field-label">${esc(label)}</div><div class="drawer-field-value">${esc(humanizeValue(key, value))}</div></div>`;
    }
    continue;
  }

  if (typeof value === 'object') continue;

  bodyHtml += `<div class="drawer-field">
    <div class="drawer-field-label">${esc(label)}</div>
    <div class="drawer-field-value">${esc(String(humanizeValue(key, value)))}</div>
  </div>`;
}

document.getElementById('drawerBody').innerHTML = bodyHtml || '<p style="opacity:0.5">Sem dados adicionais</p>';
```

---

## RESULTADO ESPERADO

Antes (campo por campo):
```
palSvn1     → Sim
palSvn2     → Sim
palNome1    → Bruno Silva
palNome2    → Alessandra Pereira
palCargo1   → Analista
```

Depois (agrupado por palestrante):
```
┌─ Palestrante 1 ──────────────┐
│  Bruno Silva  [SVN]           │
│  Analista                     │
└───────────────────────────────┘
┌─ Palestrante 2 ──────────────┐
│  Alessandra Pereira  [SVN]    │
│  Gerente                      │
└───────────────────────────────┘
```

---

## OBSERVAÇÕES
- O campo `temPalestrante` continuará aparecendo normalmente com o label
  "Tem palestrante(s)?" antes dos blocos de palestrantes
- Campos `palFoto1`, `palFoto2` etc. são URLs de arquivo — serão exibidos
  como campos normais com o label mapeado, ou podem ser omitidos do drawer
  adicionando um filtro `if (key.startsWith('palFoto')) continue;`
- A mesma lógica deve ser aplicada ao `admin.html` quando o drawer
  do admin for atualizado para usar `DRAWER_FIELD_LABELS`
