# Limpeza e Correções — Prompt Consolidado

---

## 1. `form-artes-divulgacao.html`

### 1a. Remover `transitions.js`
```html
<!-- REMOVER: -->
<script src="transitions.js"></script>
```

### 1b. Corrigir chaves acentuadas no objeto `dados{}`
No `submitForm()`, substituir:
```js
// DE:
conteúdo: document.getElementById('conteudo').value,
público:  público.join(', '),

// PARA:
conteudo:   document.getElementById('conteudo').value,
publicoAlvo: público.join(', '),
```

### 1c. Corrigir prazo inconsistente
O `alert-card` dentro do `form-card` (step2) diz "3 dias úteis" — substituir pelo correto:
```html
<!-- Substituir o alert-card.alert-danger do step2 por: -->
<div class="alert-card alert-info">
  <div class="alert-text">O prazo de entrega varia conforme a complexidade: artes simples (stories, posts, banners) <strong>2 dias úteis</strong>; artes complexas (kits, flyers, apresentações) <strong>5 dias úteis</strong>.</div>
</div>
```

### 1d. Substituir `alert()` por erro inline no `submitForm()`
```js
// Substituir:
else { alert('Erro ao enviar. Tente novamente.'); btn.disabled = false; btn.textContent = 'Enviar'; }
} catch (e) { alert('Erro de conexão.'); btn.disabled = false; btn.textContent = 'Enviar'; }

// Por:
else {
  const errEl = document.getElementById('submitError');
  if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro ao enviar. Tente novamente.'; }
  btn.disabled = false; btn.textContent = 'Enviar';
}
} catch (e) {
  const errEl = document.getElementById('submitError');
  if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.'; }
  btn.disabled = false; btn.textContent = 'Enviar';
}
```

Adicionar o elemento de erro antes do botão de envio:
```html
<div id="submitError" class="alert-card alert-danger" style="display:none;margin-bottom:16px"></div>
```

---

## 2. `form-atualizacao-material.html`

### 2a. Substituir `alert()` por erro inline no `submitForm()`
```js
// Substituir:
else { alert('Erro ao enviar.'); btn.disabled = false; btn.textContent = 'Enviar'; }
} catch (e) { alert('Erro de conexão.'); btn.disabled = false; btn.textContent = 'Enviar'; }

// Por:
else {
  const errEl = document.getElementById('submitError');
  if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro ao enviar. Tente novamente.'; }
  btn.disabled = false; btn.textContent = 'Enviar';
}
} catch (e) {
  const errEl = document.getElementById('submitError');
  if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.'; }
  btn.disabled = false; btn.textContent = 'Enviar';
}
```

Adicionar o elemento de erro antes do botão de envio:
```html
<div id="submitError" class="alert-card alert-danger" style="display:none;margin-bottom:16px"></div>
```

---

## 3. `thankyou.html` — Remover transform inline

No elemento `id="card"`, substituir o estilo inicial inline por versão sem transform (a animação já está no JS):

```html
<!-- Substituir: -->
<div class="thankyou-card" style="opacity:0;transform:scale(0.95)" id="card">

<!-- Por: -->
<div class="thankyou-card" style="opacity:0" id="card">
```

O script já aplica `transform: scale(1)` via JS ao animar a entrada — o estado inicial pode ser apenas `opacity:0`.

---

## 4. `api-server/src/index.ts` — Corrigir app.listen para Express 5

No Express 5, o callback do `listen` não recebe `err` como primeiro argumento. Substituir:

```ts
// Substituir:
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

// Por:
const server = app.listen(port, () => {
  logger.info({ port }, "Server listening");
});

server.on('error', (err) => {
  logger.error({ err }, "Error listening on port");
  process.exit(1);
});
```

---

## 5. `api-server/src/middleware/auth.middleware.ts` — Corrigir acentuação

```ts
// Substituir:
res.status(401).json({ error: "Autenticacao necessaria" });

// Por (em ambas as ocorrências):
res.status(401).json({ error: "Autenticação necessária" });
```

---

## 6. `dashboard.html` — Limpeza de código

### 6a. Remover `getStatusColor()` e usar `STATUS_SOLICITACAO` diretamente

Remover a função `getStatusColor()` completa e substituir sua utilização em `renderDrawerContent()` por:

```js
// Substituir:
const cor = getStatusColor(etapa.id);

// Por:
const statusEntry = STATUS_SOLICITACAO.find(s => s.id === etapa.id);
const cor = statusEntry ? { bg: statusEntry.bg, text: statusEntry.text } : { bg: 'transparent', text: 'rgba(34,27,25,0.15)' };
```

### 6b. Mover `NATUREZA_LABEL` para fora de `renderList()`

Antes da função `renderList`, adicionar como constante de módulo:
```js
const NATUREZA_LABEL = { presencial: 'Presencial', online: 'Online' };
```

E remover a linha `const NATUREZA_LABEL = ...` de dentro da função `renderList()`.

### 6c. Corrigir escopo de `lastPeriodo`

Dentro de `renderList()`, mover a declaração para dentro da função (já está dentro — verificar que está declarado como `let lastPeriodo = null` NO INÍCIO da função, não fora dela):

```js
function renderList(tab, data) {
  let lastPeriodo = null; // deve estar aqui, dentro da função
  const container = ...
  // ...
}
```

Se `lastPeriodo` estiver declarado fora da função (como variável de módulo), mover para dentro.

---

## 7. `solicitacoes.html` — Mover CSS do trio-grid para `style.css`

### 7a. Remover criação dinâmica de `<style>` em `renderCategories()`

Localizar e remover o bloco:
```js
// REMOVER:
const trioStyle = document.createElement('style');
trioStyle.textContent = '@media(max-width:768px){.trio-grid{grid-template-columns:1fr!important}}';
trioWrapper.classList.add('trio-grid');
document.head.appendChild(trioStyle);
```

Manter apenas:
```js
trioWrapper.classList.add('trio-grid');
```

### 7b. Adicionar regra no `style.css`

No bloco `@media (max-width: 768px)`, adicionar:
```css
.trio-grid { grid-template-columns: 1fr !important; }
```

---

## 8. `style.css` — Remover código morto e corrigir nome de classe

### 8a. Renomear `.pacote-padrão-img` para `.pacote-padrao-img`
```css
/* Substituir: */
.pacote-padrão-img { ... }
/* Por: */
.pacote-padrao-img { ... }
```

### 8b. Remover classes obsoletas do `@media (max-width: 768px)`
```css
/* REMOVER estas linhas do breakpoint mobile: */
.hero-card { height: 280px; }
.hero-buttons { flex-direction: column; }
.filters { overflow-x: auto; flex-wrap: nowrap; }
```

---

## 9. `config.js` — Completar `DRAWER_FIELD_LABELS`

Adicionar as chaves faltantes:
```js
// Adicionar ao objeto DRAWER_FIELD_LABELS:
titulo:     "Título do material",
finalidade: "Finalidade",
canais:     "Canais de compartilhamento",
descricao:  "Descrição",
```

---

## OBSERVAÇÕES

- O `upload-feedback.js` está correto e bem implementado — não precisa de alteração
- Após aplicar, fazer build no Replit: `cd artifacts/api-server && pnpm run build`
- O ponto de `requireRole` no `forms.ts` será endereçado quando as rotas do admin forem revisadas — não incluído aqui para não quebrar o que já funciona
