# Ajustes visuais — Ícone ClickUp, botões na página de solicitação e botão WhatsApp flutuante

---

## ÍCONE CLICKUP (reutilizável)

Adicionar esta constante JS em todos os arquivos que usam o ícone ClickUp.
É o SVG oficial inline, redimensionado para 14×14px:

```js
const CLICKUP_ICON = `<svg width="14" height="14" viewBox="0 0 54.8 65.8" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cu1" x1="0" y1="15.05" x2="54.84" y2="15.05" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 69.36)">
      <stop offset="0" stop-color="#8930FD"/><stop offset="1" stop-color="#49CCF9"/>
    </linearGradient>
    <linearGradient id="cu2" x1="1.2" y1="53.17" x2="53.74" y2="53.17" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 69.36)">
      <stop offset="0" stop-color="#FF02F0"/><stop offset="1" stop-color="#FFC800"/>
    </linearGradient>
  </defs>
  <path fill="url(#cu1)" d="M0,50.6l10.1-7.8c5.4,7,11.1,10.3,17.4,10.3c6.3,0,11.9-3.2,17-10.2l10.3,7.6c-7.4,10-16.6,15.3-27.3,15.3C16.9,65.8,7.6,60.5,0,50.6z"/>
  <path fill="url(#cu2)" d="M27.5,16.9l-18,15.5l-8.3-9.7L27.6,0l26.2,22.7l-8.4,9.6L27.5,16.9z"/>
</svg>`;
```

**Nota:** os IDs dos gradientes (`cu1`, `cu2`) são únicos para evitar
conflito quando o ícone aparece múltiplas vezes na mesma página.

---

## 1. `dashboard.html` — Substituir botão "ClickUp ↗" por ícone

### 1a. No `renderList()`, substituir o link de ClickUp

```js
// DE:
${isAdm && item.clickup_url ? `<a href="${esc(item.clickup_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" class="badge" style="background:rgba(118,180,71,0.12);color:#4a7c2f;text-decoration:none;font-size:0.7rem">ClickUp ↗</a>` : ''}

// PARA:
${isAdm && item.clickup_url ? `
  <a href="${esc(item.clickup_url)}" target="_blank" rel="noopener"
     onclick="event.stopPropagation()"
     title="Abrir no ClickUp"
     style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;background:rgba(137,48,253,0.08);text-decoration:none;transition:background 0.15s;flex-shrink:0"
     onmouseover="this.style.background='rgba(137,48,253,0.15)'"
     onmouseout="this.style.background='rgba(137,48,253,0.08)'">
    ${CLICKUP_ICON}
  </a>` : ''}
```

### 1b. Adicionar `CLICKUP_ICON` no script do dashboard

Adicionar a constante no topo do bloco `<script>`, antes de `init()`.

### 1c. Na tabela admin (`renderAdminHistorico()`), substituir o link "↗ CU"

```js
// DE:
${item.clickup_url ? `<a href="${esc(item.clickup_url)}" ...>↗ CU</a>` : ''}

// PARA:
${item.clickup_url ? `
  <a href="${esc(item.clickup_url)}" target="_blank" rel="noopener"
     onclick="event.stopPropagation()"
     title="Abrir no ClickUp"
     style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;background:rgba(137,48,253,0.08);text-decoration:none;transition:background 0.15s"
     onmouseover="this.style.background='rgba(137,48,253,0.15)'"
     onmouseout="this.style.background='rgba(137,48,253,0.08)'">
    ${CLICKUP_ICON}
  </a>` : ''}
```

---

## 2. `solicitacao.html` — Mover botões ClickUp e avaliação para o header

### 2a. Remover botões do rodapé

No `renderPage()`, localizar e remover o bloco do rodapé que contém:
```js
// REMOVER do rodapé:
${Auth.isAdmin() && item.clickup_url ? `<a href="...">Abrir no ClickUp</a>` : ''}
${Auth.isAdmin() ? `<button onclick="verAvaliacao(...)">Ver avaliação</button>` : ''}
```

### 2b. Adicionar CLICKUP_ICON no script da solicitacao.html

```js
const CLICKUP_ICON = `<svg width="14" height="14" viewBox="0 0 54.8 65.8" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cu1b" x1="0" y1="15.05" x2="54.84" y2="15.05" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 69.36)">
      <stop offset="0" stop-color="#8930FD"/><stop offset="1" stop-color="#49CCF9"/>
    </linearGradient>
    <linearGradient id="cu2b" x1="1.2" y1="53.17" x2="53.74" y2="53.17" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1 0 0 -1 0 69.36)">
      <stop offset="0" stop-color="#FF02F0"/><stop offset="1" stop-color="#FFC800"/>
    </linearGradient>
  </defs>
  <path fill="url(#cu1b)" d="M0,50.6l10.1-7.8c5.4,7,11.1,10.3,17.4,10.3c6.3,0,11.9-3.2,17-10.2l10.3,7.6c-7.4,10-16.6,15.3-27.3,15.3C16.9,65.8,7.6,60.5,0,50.6z"/>
  <path fill="url(#cu2b)" d="M27.5,16.9l-18,15.5l-8.3-9.7L27.6,0l26.2,22.7l-8.4,9.6L27.5,16.9z"/>
</svg>`;
```

**Nota:** IDs `cu1b`/`cu2b` para evitar conflito com o dashboard
caso ambas as páginas sejam abertas em iframes ou futuras SPAs.

### 2c. Adicionar botões ao lado do badge de status no header

No `renderPage()`, substituir o bloco do header onde está o badge de status:

```js
// DE:
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
  <h1 id="solTitulo" ...></h1>
  <span id="solStatus" class="badge" ...></span>
</div>

// PARA:
<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
  <h1 id="solTitulo" ...></h1>
  <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap">
    <span id="solStatus" class="badge" ...></span>
    ${Auth.isAdmin() && item.clickup_url ? `
      <a href="${esc(item.clickup_url)}" target="_blank" rel="noopener"
         title="Abrir no ClickUp"
         style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(137,48,253,0.08);text-decoration:none;transition:background 0.15s"
         onmouseover="this.style.background='rgba(137,48,253,0.15)'"
         onmouseout="this.style.background='rgba(137,48,253,0.08)'">
        ${CLICKUP_ICON}
      </a>` : ''}
    ${Auth.isAdmin() ? `
      <button onclick="verAvaliacao(${item.id})" id="btnVerAvaliacao"
        title="Ver avaliação"
        style="display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:var(--icon-bg);border:none;cursor:pointer;transition:background 0.15s"
        onmouseover="this.style.background='rgba(34,27,25,0.1)'"
        onmouseout="this.style.background='var(--icon-bg)'">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>` : ''}
  </div>
</div>
```

---

## 3. `style.css` + todos os HTMLs — Botão flutuante do WhatsApp

### 3a. Adicionar estilo em `style.css`

```css
/* ── Botão flutuante WhatsApp ─────────────────── */
.float-whatsapp {
  position: fixed;
  bottom: 138px; /* acima dos outros botões flutuantes */
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #25D366;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  box-shadow: 0 2px 12px rgba(37,211,102,0.4);
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 100;
}

.float-whatsapp:hover {
  transform: scale(1.08);
  box-shadow: 0 4px 18px rgba(37,211,102,0.5);
}
```

### 3b. Adicionar botão em todas as páginas EXCETO `index.html`

Adicionar antes do `</body>` nas seguintes páginas:
- `dashboard.html`
- `solicitacao.html`
- `solicitacoes.html`
- `form-eventos.html`
- `form-artes-divulgacao.html`
- `form-atualizacao-material.html`
- `form-apresentacoes.html`
- `form-criacao-pdf.html`
- `form-pagina-assessores.html`
- `thankyou.html`

```html
<a href="https://wa.me/5544991689207" target="_blank" rel="noopener"
   class="float-whatsapp" title="Falar com o time de Marketing">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
</a>
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas HTML e CSS
- O número `5544991689207` no link WhatsApp corresponde a +55 44 99168-9207
  (sem espaços, hífen ou parênteses)
- O botão WhatsApp fica em `bottom: 138px` para não sobrepor os
  dois botões flutuantes existentes (Menu e Início) que ficam em
  `bottom: 78px` e `bottom: 20px`
- Os IDs dos gradientes SVG são únicos por página (`cu1`/`cu2` no
  dashboard, `cu1b`/`cu2b` na solicitação) para evitar conflito
  caso ambas sejam renderizadas simultaneamente
- O ícone de estrela no botão "Ver avaliação" é intuitivo e economiza
  espaço sem precisar de texto
