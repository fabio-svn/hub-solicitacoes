# Correção — Animações (Round 3)

Dois problemas introduzidos pelas animações do Round 3 precisam ser corrigidos.

---

## 1. Remover animação de entrada do `body`

No `style.css`, remover completamente este bloco:

```css
/* REMOVER este bloco inteiro: */
body {
  opacity: 0;
  animation: pageEnter 0.25s ease forwards;
}
@keyframes pageEnter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

**Motivo:** o `transform` no `body` quebra o `position: fixed` de todos os modais e drawers, fazendo-os aparecer no rodapé em vez do centro. Além disso, o `opacity: 0` inicial causa a percepção de lentidão.

---

## 2. Ajustar fade de saída entre páginas

No `auth.js` ou `transitions.js`, substituir o listener de clique por:

```js
document.addEventListener('click', function(e) {
  const link = e.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto') || link.target === '_blank') return;
  e.preventDefault();
  document.body.style.transition = 'opacity 0.15s ease';
  document.body.style.opacity = '0';
  setTimeout(() => { window.location.href = href; }, 150);
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) {
    document.body.style.opacity = '1';
  }
});
```

**Mudanças:** transição aplicada via `style` inline diretamente no `opacity` do body — sem `transform`, sem `animation`, sem contexto de empilhamento. Delay reduzido de 200ms para 150ms.

---

## 3. No `style.css`, remover a classe `.page-leaving`

```css
/* REMOVER: */
body.page-leaving {
  opacity: 0;
  transition: opacity 0.2s ease;
}
```

---

## 4. Manter o restante das animações

Manter sem alteração:
- Entrada escalonada dos cards do dashboard (`.request-card` com `animationDelay`)
- Transição entre etapas do formulário (`fadeSlide` / `fadeSlideOut`)
- Abertura dos modais (`.modal-overlay.visible .modal-card`)
- Abertura do drawer
- `@media (prefers-reduced-motion: reduce)`

Essas animações não usam `transform` no `body` e não causam os problemas acima.

---

## 5. Drawer permanentemente aberto e largo — correção adicional

O drawer está ficando visível e expandindo a página horizontalmente. Além do fix da animação do `body` (item 1 acima), garantir que o drawer tenha `overflow: hidden` no container pai e que o estado inicial esteja correto:

No `style.css`, verificar e garantir que o drawer tenha:
```css
.drawer {
  position: fixed;
  top: 0;
  right: -440px;        /* começa fora da tela */
  width: 420px;
  height: 100vh;
  background: var(--card-white);
  z-index: 301;
  transition: right 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  overflow-y: auto;
  box-shadow: -4px 0 24px rgba(0,0,0,0.15);
}
.drawer.open { right: 0; }
```

E no `body` ou no container principal do dashboard, adicionar:
```css
body { overflow-x: hidden; }
```

Isso evita que o drawer fora da tela cause scroll horizontal.

Se o drawer estiver abrindo automaticamente ao carregar a página, verificar se há alguma chamada a `openDrawer()` ou `drawer.classList.add('open')` sendo executada no `init()` por engano.

---

## 6. Botão flutuante "Início" no dashboard

No `dashboard.html`, adicionar o botão flutuante de voltar à home (já existe nos formulários, adicionar aqui também):

```html
<!-- Adicionar antes do </body> do dashboard.html -->
<a href="/" class="float-home">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
  <span>Início</span>
</a>
```
