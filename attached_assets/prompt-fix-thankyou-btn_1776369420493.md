# Correção — Botão "Nova solicitação" na thankyou.html

O botão "Nova solicitação" está com visual diferente do "Ver minha solicitação".
Ambos devem ter exatamente o mesmo estilo `btn btn-primary`.

---

## `thankyou.html`

### Localizar o botão "Nova solicitação" e corrigir

O botão provavelmente está assim (com estilo inline ou classe diferente):
```html
<a href="/solicitacoes.html" class="btn btn-secondary" ...>Nova solicitação</a>
<!-- ou -->
<a href="/solicitacoes.html" style="..." ...>Nova solicitação</a>
```

Substituir por versão idêntica ao botão principal, com `id` diferente:
```html
<a href="/solicitacoes.html" class="btn btn-primary" id="ctaBtn2" style="opacity:0">Nova solicitação</a>
```

### Garantir que a animação de entrada inclui `ctaBtn2`

No script da thankyou.html, localizar o array de animações:
```js
['title', 'subtitle', 'ctaBtn', 'logoWrap'].forEach((id, i) => {
```

Substituir por:
```js
['title', 'subtitle', 'ctaBtn', 'ctaBtn2', 'logoWrap'].forEach((id, i) => {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '1';
  }, 700 + i * 200);
});
```

O `if (!el) return` garante que se o elemento não existir não quebra a animação.

---

## OBSERVAÇÃO

Nenhum build necessário — apenas `thankyou.html`.
