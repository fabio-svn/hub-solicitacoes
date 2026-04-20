# Responsável — badge exclusivo abaixo do título

## `solicitacao.html` — Separar responsável em linha própria

### Localizar o bloco que monta `metaParts` no `renderPage()`:

```js
// REMOVER do metaParts o trecho que adiciona o responsável inline:
// DE (remover estas linhas):
if (item.responsavel) metaParts.push(`<span class="sol-meta-sep"></span><span style="display:inline-flex;align-items:center;gap:4px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;flex-shrink:0"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${esc(item.responsavel)}</span>`);
```

### Atualizar o HTML do `solMeta` para incluir o badge do responsável separado:

```js
// Substituir a linha:
document.getElementById('solMeta').innerHTML = metaParts.join('');

// POR:
document.getElementById('solMeta').innerHTML = metaParts.join('');

// E logo após, atualizar o badge do responsável (elemento separado):
const respEl = document.getElementById('solResponsavel');
if (respEl) {
  if (item.responsavel) {
    respEl.style.display = 'inline-flex';
    respEl.querySelector('.resp-nome').textContent = item.responsavel;
  } else {
    respEl.style.display = 'none';
  }
}
```

### Adicionar elemento `#solResponsavel` no HTML, logo após `#solMeta`:

```html
<!-- Localizar no HTML: -->
<div class="sol-meta" id="solMeta"></div>

<!-- Substituir por: -->
<div class="sol-meta" id="solMeta"></div>
<div id="solResponsavel" style="display:none;margin-top:8px">
  <span style="
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 8px;
    background: rgba(34,27,25,0.05);
    border: 1px solid rgba(34,27,25,0.1);
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--carbon-black);
    opacity: 0.75;
  ">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.55;flex-shrink:0">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
    <span style="opacity:0.55;font-weight:400">Responsável:</span>
    <span class="resp-nome" style="font-weight:700"></span>
  </span>
</div>
```

## OBSERVAÇÕES

- Nenhum build necessário
- O badge usa o mesmo estilo visual do sistema (border-radius:999px,
  border rgba, fundo sutil) sem introduzir novas classes
- "Responsável:" em peso normal e cor mais fraca, nome em bold —
  cria hierarquia dentro do badge
- Se `responsavel` for null (solicitações antigas), o elemento
  fica com display:none e não ocupa espaço
