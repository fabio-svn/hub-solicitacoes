# Fix — Dropdown do gráfico com position:fixed para escapar do overflow do container

## `dashboard.html`

### Problema
O container do gráfico (`.form-card`) tem `overflow:hidden` implícito, cortando
os dropdowns que usam `position:absolute`. A solução é usar `position:fixed`
e calcular a posição do dropdown com base no `getBoundingClientRect()` do botão.

---

### Alterar os dois divs de dropdown do gráfico para position:fixed

```html
<!-- #graficoDropdownTipo — substituir style: -->
<!-- DE: position:absolute;top:36px;right:0 -->
<!-- PARA: position:fixed (posição calculada por JS) -->

<div id="graficoDropdownTipo"
  style="display:none;position:fixed;z-index:500;background:#fff;
         border:1px solid var(--border-light);border-radius:10px;
         box-shadow:0 4px 20px rgba(0,0,0,.12);padding:8px;min-width:280px">
</div>

<div id="graficoDropdownStatus"
  style="display:none;position:fixed;z-index:500;background:#fff;
         border:1px solid var(--border-light);border-radius:10px;
         box-shadow:0 4px 20px rgba(0,0,0,.12);padding:8px;min-width:280px">
</div>
```

---

### Atualizar `toggleGraficoDropdown()` para posicionar via getBoundingClientRect

```js
function toggleGraficoDropdown(modo) {
  const ddTipo     = document.getElementById('graficoDropdownTipo');
  const ddStatus   = document.getElementById('graficoDropdownStatus');
  const chevTipo   = document.getElementById('graficoChevronTipo');
  const chevStatus = document.getElementById('graficoChevronStatus');
  const btnTipo    = document.getElementById('graficoBtnTipo');
  const btnStatus  = document.getElementById('graficoBtnStatus');

  function posicionarDropdown(dd, btn) {
    const rect = btn.getBoundingClientRect();
    // Alinhar a direita do dropdown com a direita do botão
    const ddWidth = 280;
    let left = rect.right - ddWidth;
    // Garantir que não sai pela esquerda da tela
    if (left < 8) left = 8;
    dd.style.top  = (rect.bottom + 6) + 'px';
    dd.style.left = left + 'px';
  }

  if (modo === 'tipo') {
    const isOpen = ddTipo.style.display === 'block';
    ddTipo.style.display   = isOpen ? 'none' : 'block';
    ddStatus.style.display = 'none';
    chevTipo.style.transform   = isOpen ? 'rotate(0)' : 'rotate(180deg)';
    chevStatus.style.transform = 'rotate(0)';
    if (!isOpen) {
      posicionarDropdown(ddTipo, btnTipo);
      if (adminGraficoModo !== 'tipo') switchGrafico('tipo');
      renderGraficoDropdown('tipo');
    }
  } else {
    const isOpen = ddStatus.style.display === 'block';
    ddStatus.style.display = isOpen ? 'none' : 'block';
    ddTipo.style.display   = 'none';
    chevStatus.style.transform = isOpen ? 'rotate(0)' : 'rotate(180deg)';
    chevTipo.style.transform   = 'rotate(0)';
    if (!isOpen) {
      posicionarDropdown(ddStatus, btnStatus);
      if (adminGraficoModo !== 'status') switchGrafico('status');
      renderGraficoDropdown('status');
    }
  }
}
```

---

### Atualizar listener de clique fora para fechar os dropdowns fixed

```js
// O listener existente já fecha os dropdowns ao clicar fora — só confirmar
// que os IDs dos wraps batem com os novos IDs. Se os divs de dropdown
// foram movidos para fora do wrap (por serem fixed), ajustar o seletor:

document.addEventListener('click', e => {
  if (!e.target || !document.contains(e.target)) return;
  const ddTipo   = document.getElementById('graficoDropdownTipo');
  const ddStatus = document.getElementById('graficoDropdownStatus');
  const btnTipo   = document.getElementById('graficoBtnTipo');
  const btnStatus = document.getElementById('graficoBtnStatus');

  // Fechar tipo se clicou fora do botão e fora do dropdown
  if (ddTipo && ddTipo.style.display === 'block') {
    if (!btnTipo?.contains(e.target) && !ddTipo.contains(e.target)) {
      ddTipo.style.display = 'none';
      const chev = document.getElementById('graficoChevronTipo');
      if (chev) chev.style.transform = 'rotate(0)';
    }
  }

  // Fechar status se clicou fora do botão e fora do dropdown
  if (ddStatus && ddStatus.style.display === 'block') {
    if (!btnStatus?.contains(e.target) && !ddStatus.contains(e.target)) {
      ddStatus.style.display = 'none';
      const chev = document.getElementById('graficoChevronStatus');
      if (chev) chev.style.transform = 'rotate(0)';
    }
  }

  // Manter o restante do listener existente para os outros dropdowns da tabela
});
```

---

### Mover os divs de dropdown para fora do .form-card no HTML

Os divs `#graficoDropdownTipo` e `#graficoDropdownStatus` devem estar
diretamente no `<body>` ou pelo menos fora de qualquer container com
`overflow:hidden`. Como usam `position:fixed`, podem ficar em qualquer
lugar no DOM — o mais simples é movê-los para logo antes do `</body>`:

```html
<!-- Remover de dentro do graficoDropdownTipoWrap e graficoDropdownStatusWrap -->
<!-- Adicionar antes do </body>: -->

<div id="graficoDropdownTipo"
  style="display:none;position:fixed;z-index:500;background:var(--card-white);
         border:1px solid var(--border-light);border-radius:10px;
         box-shadow:0 4px 20px rgba(0,0,0,.12);padding:8px;min-width:280px">
</div>
<div id="graficoDropdownStatus"
  style="display:none;position:fixed;z-index:500;background:var(--card-white);
         border:1px solid var(--border-light);border-radius:10px;
         box-shadow:0 4px 20px rgba(0,0,0,.12);padding:8px;min-width:280px">
</div>
```

Os wraps `#graficoDropdownTipoWrap` e `#graficoDropdownStatusWrap` podem
permanecer apenas como containers dos botões (sem os divs de dropdown dentro):

```html
<div id="graficoDropdownTipoWrap">
  <button id="graficoBtnTipo" onclick="toggleGraficoDropdown('tipo')" ...>
    Por tipo ...
  </button>
  <!-- dropdown foi para fora do DOM deste wrap -->
</div>
<div id="graficoDropdownStatusWrap">
  <button id="graficoBtnStatus" onclick="toggleGraficoDropdown('status')" ...>
    Por status ...
  </button>
</div>
```

---

## OBSERVAÇÕES

- Nenhum build necessário — apenas `dashboard.html`
- `position:fixed` faz o dropdown flutuar sobre qualquer container,
  ignorando `overflow:hidden` de qualquer ancestral
- `getBoundingClientRect()` garante posicionamento correto mesmo se
  a página tiver scroll ou o layout mudar
- O `z-index:500` é suficiente para ficar sobre todos os elementos,
  incluindo o header sticky (z-index:100)
- Se o usuário rolar a página com o dropdown aberto, o dropdown vai
  ficar desposicionado — adicionar listener de scroll para fechar:

```js
// Adicionar ao init() ou initAdmin():
window.addEventListener('scroll', () => {
  const ddTipo   = document.getElementById('graficoDropdownTipo');
  const ddStatus = document.getElementById('graficoDropdownStatus');
  if (ddTipo)   ddTipo.style.display   = 'none';
  if (ddStatus) ddStatus.style.display = 'none';
  const chevT = document.getElementById('graficoChevronTipo');
  const chevS = document.getElementById('graficoChevronStatus');
  if (chevT) chevT.style.transform = 'rotate(0)';
  if (chevS) chevS.style.transform = 'rotate(0)';
}, { passive: true });
```
