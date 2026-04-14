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
