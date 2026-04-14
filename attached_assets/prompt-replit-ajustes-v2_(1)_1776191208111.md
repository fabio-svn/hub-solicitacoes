# Ajustes Hub SVN — Rodada 2

Aplique todos os ajustes abaixo. O código dos arquivos relevantes está disponível para referência.

---


## 3. BOTÃO FLUTUANTE — CORRIGIR DESTINO

No `form-eventos.html` e em **todos** os outros formulários, o botão flutuante que leva de volta ao menu de solicitações está apontando para `/dashboard.html`. Corrigir para `/solicitacoes.html`:

```html
<!-- Trocar -->
<a href="/dashboard.html" class="float-home" style="bottom:78px">
  <svg ...>...</svg>
  <span>Minhas solicitações</span>
</a>
<!-- Por -->
<a href="/solicitacoes.html" class="float-home" style="bottom:78px">
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="3" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="14" y="14" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/>
  </svg>
  <span>Menu de solicitações</span>
</a>
```

---

## 4. HEADER — BOTÃO "MINHAS SOLICITAÇÕES" EM TODOS OS FORMS

O botão "Minhas solicitações" deve aparecer no header em **todos** os formulários, não só na tela de seleção. No arquivo `auth.js`, na função `renderHeader`, adicionar o botão antes do nome do usuário:

```js
// Dentro da função renderHeader, no HTML gerado, adicionar antes do user-name:
<a href="/dashboard.html" style="font-size:0.8rem;font-weight:600;color:var(--carbon-black);opacity:0.7;text-decoration:none;display:flex;align-items:center;gap:5px;margin-right:16px" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
  Minhas solicitações
</a>
```

Se não for possível editar o `auth.js`, adicionar diretamente em cada arquivo HTML logo após o `<header>`:
```js
// No script de cada form, dentro da função init(), após Auth.renderHeader():
const headerInner = document.querySelector('.header-inner');
if (headerInner && !document.getElementById('headerDashBtn')) {
  const btn = document.createElement('a');
  btn.id = 'headerDashBtn';
  btn.href = '/dashboard.html';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> Minhas solicitações`;
  btn.style.cssText = 'font-size:0.8rem;font-weight:600;color:var(--carbon-black);opacity:0.7;text-decoration:none;display:flex;align-items:center;gap:5px;margin-right:16px';
  const userSection = headerInner.querySelector('.header-user');
  if (userSection) headerInner.insertBefore(btn, userSection);
}
```

---

## 5. HEADER — BOTÃO "SAIR" EM MENU SUSPENSO

O botão "Sair" deve aparecer em um menu suspenso ao clicar no nome/avatar do usuário. No arquivo `auth.js`, modificar a função `renderHeader` para envolver o nome+avatar em um dropdown:

```js
// Substituir o HTML do header-user por este padrão:
`<div class="header-user" style="position:relative">
  <div id="userMenuTrigger" style="display:flex;align-items:center;gap:8px;cursor:pointer" onclick="toggleUserMenu()">
    <div class="avatar">${initials}</div>
    <span class="user-name">${name}</span>
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4"><polyline points="6 9 12 15 18 9"/></svg>
  </div>
  <div id="userDropdown" style="display:none;position:absolute;top:calc(100% + 8px);right:0;background:var(--card-white);border:1px solid var(--border-light);border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:160px;z-index:200;overflow:hidden">
    <a href="/dashboard.html" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:0.85rem;font-weight:600;color:var(--carbon-black);text-decoration:none;border-bottom:1px solid var(--border-light)" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background='transparent'">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Minhas solicitações
    </a>
    <button onclick="Auth.logout()" style="display:flex;align-items:center;gap:8px;padding:10px 16px;font-size:0.85rem;font-weight:600;color:var(--carbon-black);background:none;border:none;cursor:pointer;width:100%;text-align:left" onmouseover="this.style.background='var(--icon-bg)'" onmouseout="this.style.background='transparent'">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
      Sair
    </button>
  </div>
</div>`
```

Adicionar no `style.css` ou inline no auth.js:
```js
// Adicionar função toggleUserMenu globalmente
window.toggleUserMenu = function() {
  const dd = document.getElementById('userDropdown');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
};
// Fechar ao clicar fora
document.addEventListener('click', function(e) {
  const trigger = document.getElementById('userMenuTrigger');
  const dd = document.getElementById('userDropdown');
  if (dd && trigger && !trigger.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});
```

---

## 6. TELA DE SELEÇÃO — BOTÃO "OUTRO" LARGURA TOTAL

Na linha final das 3 colunas (Audiovisual / Impressos / Obras), o botão "Outro" deve ocupar a largura total do container, alinhado aos botões acima. Remover "Outro" da grade de 3 colunas e colocá-lo em uma linha separada abaixo:

```html
<!-- Após o grid de 3 colunas, adicionar: -->
<div style="margin-top:12px">
  <div class="category-title">Outros</div>
  <button class="selection-btn" style="width:100%;height:80px;flex-direction:row;gap:12px;justify-content:center" ...>
    <!-- ícone + label Outro -->
  </button>
</div>
```

---

## 7. FORM EVENTOS — MATERIAIS EM LINHA ÚNICA

Na etapa de materiais, cada item deve ocupar sua própria linha. No `form-eventos.html`, a função `renderMateriais()` gera os itens dentro de `<div class="pills-wrap">`. 

**Trocar** `<div class="pills-wrap" id="materiaisContainer">` por `<div id="materiaisContainer">` e alterar o CSS do `.material-block .pill` para ocupar linha inteira:

Adicionar no `<style>` do arquivo ou no `style.css`:
```css
#materiaisContainer .material-block {
  width: 100%;
}
#materiaisContainer .pill {
  width: 100%;
  justify-content: flex-start;
  border-radius: 8px;
  padding: 12px 16px;
  text-align: left;
  font-size: 0.875rem;
}
```

---

## 8. FORM EVENTOS — PAINEL LATERAL COM ÍCONES POR ITEM

Na função `updateMateriaisPreview()` no `form-eventos.html`, substituir o HTML de cada item no painel para incluir o ícone SVG correspondente:

```js
function updateMateriaisPreview() {
  const container = document.getElementById('pvItens');
  const items = formState.natureza === 'online' ? ITENS_MATERIAIS_ONLINE : ITENS_MATERIAIS;

  const ICONS = {
    'pacote-padrao': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/><path d="M12 2l2 2-2 2-2-2z" fill="currentColor" stroke="none"/></svg>`,
    'pacote-personalizado': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    'banner-impresso': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    'flyer': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    'brindes-store': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>`,
    'brindes-personalizados': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>`,
    'captacao-audiovisual': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    'coffee-break': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>`,
    'instagram': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
    'email-marketing': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    'equipe-staff': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
    'jantar-almoco': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="2" x2="18" y2="22"/><path d="M14 6c0 2.21 1.79 4 4 4s4-1.79 4-4V2H14v4z"/><path d="M6 2v6c0 2.21-1.79 4-4 4v8a2 2 0 004 0V2"/></svg>`,
    'pagina-sorteio': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    'projeto-stand': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    'pacote-padrao-online': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
    'pacote-personalizado-online': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
    'instagram-online': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>`,
    'link-youtube-online': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>`,
    'apoio-live-online': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>`,
    'email-marketing-online': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`,
  };

  container.innerHTML = [...formState.materiais].map(id => {
    const item = items.find(i => i.id === id);
    const prazo = PRAZOS_MATERIAIS[id];
    const icon = ICONS[id] || '';
    if (!item) return '';
    return `<div style="background:var(--icon-bg);border-radius:8px;padding:8px 10px;font-size:0.75rem;font-weight:600;display:flex;align-items:flex-start;gap:6px">
      <span style="color:var(--ruby-red);flex-shrink:0;margin-top:1px">${icon}</span>
      <div>
        <div>${item.label}</div>
        ${prazo ? `<div style="font-size:0.65rem;color:var(--ruby-red);opacity:0.8;margin-top:2px">${prazo.label}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}
```

---

## 9. FORM EVENTOS — NOME DO EVENTO EM DESTAQUE NO PAINEL

No painel lateral de preview, deixar o nome do evento mais visível. Modificar o HTML do painel:

```html
<!-- Trocar -->
<div class="preview-row"><span class="preview-label">Evento</span><span class="preview-value empty" id="pvEvento">—</span></div>
<!-- Por -->
<div style="padding:12px 0;border-bottom:1px solid var(--border-light)">
  <div style="font-size:0.7rem;font-weight:600;opacity:0.4;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Evento</div>
  <div style="font-family:'Taviraj',serif;font-weight:300;font-size:1.1rem;color:var(--carbon-black)" id="pvEvento">—</div>
</div>
```

---

## 10. FORM EVENTOS — UPLOAD DE FOTO DO PALESTRANTE

Na função `showPalFields(i, isSvn)`, quando `isSvn` é `true`, o input de foto não está atualizando o preview. Adicionar o event listener de upload **dentro** da função, logo após criar o HTML:

```js
function showPalFields(i, isSvn) {
  const container = document.getElementById('palFields' + i);
  if (isSvn) {
    container.innerHTML = `
      <div class="field"><label>Nome do palestrante ${i}</label><input type="text" id="palNome${i}" oninput="updatePalPreview(${i})"></div>
      <div class="field"><label>Cargo do palestrante ${i}</label><input type="text" id="palCargo${i}" oninput="updatePalPreview(${i})"></div>
      <div class="field">
        <label>Foto (opcional)</label>
        <div class="file-input-wrapper">
          <label class="file-input-btn" for="palFoto${i}">Escolher foto</label>
          <input type="file" id="palFoto${i}" accept=".jpg,.jpeg,.png,.webp">
        </div>
        <span id="palFotoStatus${i}" style="display:none;font-size:0.8rem;margin-top:4px"></span>
        <div class="field-hint">Caso não consiga, envie para: ${EMAIL_UPLOAD}</div>
      </div>
      <div id="palPreview${i}"></div>
    `;

    // Listener de upload — adicionado APÓS o HTML ser inserido no DOM
    const fotoInput = document.getElementById('palFoto' + i);
    const statusEl = document.getElementById('palFotoStatus' + i);
    if (fotoInput) {
      fotoInput.addEventListener('change', function() {
        if (!this.files || !this.files[0]) return;
        const reader = new FileReader();
        reader.onload = function(e) {
          // Atualizar preview do palestrante com a foto
          updatePalPreview(i);
          const avatarEl = document.querySelector('#palPreview' + i + ' .speaker-avatar');
          if (avatarEl) {
            avatarEl.innerHTML = `<img src="${e.target.result}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
          }
        };
        reader.onerror = function() {
          if (statusEl) {
            statusEl.textContent = '✗ Erro ao carregar foto. Tente novamente.';
            statusEl.style.color = 'var(--ruby-red)';
            statusEl.style.display = 'block';
          }
        };
        reader.readAsDataURL(this.files[0]);
        if (statusEl) {
          statusEl.textContent = '✓ Foto carregada com sucesso';
          statusEl.style.color = 'var(--sage-green)';
          statusEl.style.display = 'block';
        }
      });
    }

  } else {
    container.innerHTML = `<div class="alert-card alert-danger"><div class="alert-title">Atenção</div><div class="alert-text">Será enviado por e-mail um link para o cadastro do palestrante. Esse passo é obrigatório para o andamento do evento.</div></div>`;
  }
}
```

---

## 11. FORM ASSESSORES — MODAL DE PRÉVIA

### 11a. Ícone do Instagram no preview

No `form-pagina-assessores.html`, o ícone do Instagram não aparece no preview porque não há elemento para ele no HTML do modal. Adicionar ao lado do LinkedIn no `previewContent`:

```html
<!-- Trocar o bloco previewLinkedin por: -->
<div style="display:flex;gap:8px;margin-bottom:16px" id="previewSocialIcons">
  <a id="previewLinkedin" href="#" target="_blank" style="display:none;width:36px;height:36px;background:#0A66C2;border-radius:6px;align-items:center;justify-content:center;text-decoration:none">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6z"/><rect x="2" y="9" width="4" height="12" fill="white"/><circle cx="4" cy="4" r="2" fill="white"/></svg>
  </a>
  <a id="previewInstagram" href="#" target="_blank" style="display:none;width:36px;height:36px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);border-radius:8px;align-items:center;justify-content:center;text-decoration:none">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.5" fill="white" stroke="none"/></svg>
  </a>
</div>
```

Na função `openPreview()`, atualizar o bloco que controla LinkedIn para também controlar Instagram:

```js
// Substituir o trecho que trata previewLinkedin por:
const linkedinEl = document.getElementById('previewLinkedin');
const instagramEl = document.getElementById('previewInstagram');
const linkedin = document.getElementById('linkedin').value;
const instagram = document.getElementById('instagram').value;

if (linkedinEl) {
  linkedinEl.style.display = linkedin ? 'inline-flex' : 'none';
  linkedinEl.href = linkedin || '#';
}
if (instagramEl) {
  instagramEl.style.display = instagram ? 'inline-flex' : 'none';
  const igHandle = instagram.startsWith('@') ? instagram.slice(1) : instagram;
  instagramEl.href = instagram ? `https://instagram.com/${igHandle}` : '#';
}
```

### 11b. Selos com tamanho fixo no preview

Na função `openPreview()`, no trecho que renderiza os selos, limitar o tamanho das imagens:

```js
// Substituir o mapa de selos por:
selosDiv.innerHTML = [...selectedSelos].map(id => {
  const selo = SELOS_ASSESSOR.find(s => s.id === id);
  if (!selo) return '';
  return selo.icon_url
    ? `<img src="${selo.icon_url}" style="height:32px;width:auto;max-width:80px;object-fit:contain" alt="${selo.label}">`
    : `<span style="background:var(--icon-bg);border:1px solid var(--border-light);padding:4px 10px;border-radius:6px;font-size:0.75rem;font-weight:600">${selo.label}</span>`;
}).join('');
```

### 11c. Foto com borda preta e proporção vertical

Adicionar no `style.css`:
```css
.preview-assessor-photo {
  width: 100%;
  height: 380px;
  object-fit: cover;
  object-position: top;
  border-radius: 12px;
  border: 1px solid var(--carbon-black);
  display: block;
}
```

Na função `openPreview()`, no trecho que trata a foto:
```js
if (photoFile) {
  const url = URL.createObjectURL(photoFile);
  photoDiv.innerHTML = `<img src="${url}" class="preview-assessor-photo" alt="Foto de perfil">`;
  photoDiv.style.height = 'auto'; // deixar a imagem definir a altura
} else {
  photoDiv.innerHTML = '<span style="opacity:0.3;font-size:0.85rem">Foto aparecerá aqui</span>';
  photoDiv.style.height = '320px';
}
```

### 11d. Cards de depoimentos com borda preta

Adicionar no `style.css`:
```css
.preview-depoimento-card {
  background: transparent;
  border: 1px solid var(--carbon-black);
  border-radius: 12px;
  padding: 20px 24px;
}
.preview-depoimento-card p {
  font-style: italic;
  font-size: 0.875rem;
  line-height: 1.6;
}
.preview-depoimento-autor {
  font-style: normal;
  font-weight: 600;
  margin-top: 12px;
  font-size: 0.875rem;
}
```

---

## OBSERVAÇÕES FINAIS

- Aplicar todos os ajustes de uma vez
- Não remover funcionalidades existentes
- Testar cada página após as alterações para verificar que nada quebrou
- Para o item 5 (menu suspenso do header), se o `auth.js` for compartilhado entre todos os arquivos, a alteração lá já resolve para todos os forms automaticamente
