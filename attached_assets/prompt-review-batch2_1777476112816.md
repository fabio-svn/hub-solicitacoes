# Revisão lote 2 — admin.html, dashboard.html, auth.js, forms novos e antigos

---

## 1. `admin.html` — 4 correções

### 1a. `humanizeValue()` incompleto — não usa DRAWER_FIELD_LABELS nem traduz slugs

```js
// DE:
function humanizeValue(key, value) {
  if (!value) return value;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return value;
}

// PARA (mesma implementação do dashboard.html, que tem mapeamentos completos):
function humanizeValue(key, value) {
  if (!value && value !== 0) return value;
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  const maps = {
    natureza: { presencial: 'Presencial', online: 'Online' },
    localEvento: { unidade: 'Unidade SVN', externo: 'Local externo', 'nao-definido': 'Não definido' },
  };
  if (maps[key]?.[value]) return maps[key][value];
  if (typeof value === 'string' && (value.includes('-') || value.includes('_'))) {
    return value.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  return value;
}
```

### 1b. `renderTable()` usa cache por índice — chave inválida quando página muda

```js
// Problema: a chave é `tab_idx_page`, mas ao mudar de página e voltar,
// os índices se repetem e sobrescrevem o cache anterior silenciosamente.
// Não é um bug crítico mas pode causar drawer com dados errados se o usuário
// voltar rápido. Solução: usar item.id como chave.

// DE:
const cacheKey = tab + '_' + idx + '_' + adminPages[tab];
adminItemsCache[cacheKey] = item;
// ...
html += `<tr onclick="openDrawerByKey('${esc(cacheKey)}')">`

// PARA:
adminItemsCache['item_' + item.id] = item;
// ...
html += `<tr onclick="openDrawerByKey('item_${item.id}')">`
```

### 1c. Drawer não tem botão de ClickUp

```js
// renderAdminDrawer() monta o corpo mas não inclui link para o ClickUp.
// O dashboard.html tem o botão, mas o admin.html não.
// No drawerFooter, adicionar o link se existir:

// Na função renderAdminDrawer(), substituir a linha do footer:
// DE:
document.getElementById('drawerFooter').textContent = `ID: ${item.id} | Criado em: ...`;

// PARA:
const clickupLink = item.clickup_url
  ? `<a href="${esc(item.clickup_url)}" target="_blank" rel="noopener"
       style="display:inline-flex;align-items:center;gap:5px;color:#7c3aed;font-size:0.8rem;font-weight:600;text-decoration:none;margin-left:12px">
       ${CLICKUP_ICON} Abrir no ClickUp</a>`
  : '';
document.getElementById('drawerFooter').innerHTML =
  `ID: ${item.id} | ${new Date(item.created_at).toLocaleString('pt-BR')}` + clickupLink;
```

### 1d. Falta definição de `CLICKUP_ICON` em admin.html

```js
// admin.html não define CLICKUP_ICON mas renderAdminDrawer o usa (após correção 1c).
// Adicionar no topo do script, igual ao dashboard.html:
const CLICKUP_ICON = `<svg width="14" height="14" viewBox="0 0 54.8 65.8" xmlns="http://www.w3.org/2000/svg">
  <path fill="url(#cu1)" d="M0,50.6l10.1-7.8c5.4,7,11.1,10.3,17.4,10.3c6.3,0,11.9-3.2,17-10.2l10.3,7.6c-7.4,10-16.6,15.3-27.3,15.3C16.9,65.8,7.6,60.5,0,50.6z"/>
  <path fill="url(#cu2)" d="M27.5,16.9l-18,15.5l-8.3-9.7L27.6,0l26.2,22.7l-8.4,9.6L27.5,16.9z"/>
</svg>`;
// E adicionar os defs SVG no <body> (igual ao dashboard.html):
// <svg xmlns="..." width="0" height="0" style="position:absolute;overflow:hidden">
//   <defs>... gradientes cu1 e cu2 ...</defs>
// </svg>
```

---

## 2. `dashboard.html` — 5 correções

### 2a. `switchTab()` chama `loadAdminHistorico()` diretamente sem checar se `initAdmin()` já rodou

```js
// Se o usuário for gestor (isAdmin() true) mas a aba admin aparecer sem
// ter rodado initAdmin() ainda (caso de race), os dropdowns de tipo/status
// não estarão renderizados. Já está tratado porque initAdmin() é chamado
// em init() — mas switchTab() pode ser chamado antes do init() completar
// se currentTab vier do sessionStorage como 'admin'.
// Adicionar guard:

function switchTab(tab) {
  currentTab = tab;
  sessionStorage.setItem('svn_dashboard_tab', tab); // ← garantir que salva
  // ... resto do código
  if (tab === 'admin') {
    if (!Auth.isAdmin()) return; // guard
    Promise.all([loadAdminStats(), loadAdminHistorico()]);
  }
  // ...
}
```

### 2b. `switchTab()` não salva no sessionStorage

```js
// O switchTab() lê do sessionStorage no init mas NÃO salva ao trocar de aba.
// Adicionar no início de switchTab():
function switchTab(tab) {
  currentTab = tab;
  sessionStorage.setItem('svn_dashboard_tab', tab); // ← ADICIONAR
  // ... resto do código
}
```

### 2c. `renderAdminHistorico()` faz `JSON.parse` de `item.dados` mas não usa `dados` para nada

```js
// Em renderAdminHistorico(), o parse de dados.natureza é feito mas o resultado
// (tipoLabel com natureza) não inclui o título do item — a coluna "Título"
// usa `item.titulo` diretamente. O parse está correto mas pode ser
// simplificado: o campo `titulo` já deve estar desnormalizado no banco.
// Verificar se `item.titulo` está preenchido ou se ainda depende do parse.
// Se `item.titulo` for null/empty para eventos antigos, o parse é necessário.
// Manter como está, mas adicionar fallback explícito:

const tituloDisplay = item.titulo || dados.nomeEvento || dados.titulo || '—';
// (substituir `item.titulo || '—'` na célula de título)
```

### 2d. `renderLog()` — `restoreSession` de `logPage` não existe, declaração duplicada

```js
// logPage é declarado em dois lugares:
// 1. `let logPage = 1;` no escopo de initLog() (dentro de initAdmin check)
// 2. `let logPage = 1;` no escopo global (antes de initAdmin)
// Verificar se há de fato duas declarações e remover a duplicata interna.
// Manter apenas a declaração global:
let logPage = 1;
let logSearchTimeout;
// (remover qualquer re-declaração dessas variáveis dentro de funções)
```

### 2e. `exportarLog()` não usa os filtros ativos ao exportar

```js
// exportarLog() sempre chama /api/admin/historico?limit=1000
// sem incluir os filtros de tipo, status, busca ou período ativos.
// Usuário com filtros ativos espera exportar apenas os dados filtrados.
// Adicionar parâmetros de filtro:

function exportarLog() {
  const params = new URLSearchParams();
  params.set('limit', '1000');
  params.set('order', 'created_at');
  params.set('dir', 'desc');
  const busca = document.getElementById('logBusca')?.value?.trim();
  if (busca) params.set('busca', busca);
  const tipo = document.getElementById('logFiltroTipo')?.value;
  if (tipo) params.set('tipos', tipo);
  const clickup = document.getElementById('logFiltroClickup')?.value;
  if (clickup === 'com') params.set('com_clickup', 'sim');
  if (clickup === 'sem') params.set('sem_clickup', 'sim');

  fetch('/api/admin/historico?' + params.toString())
    .then(r => r.json())
    .then(data => { /* ... resto igual */ });
}
```

---

## 3. `auth.js` — 3 correções

### 3a. Interceptor de fetch não trata redirect loop

```js
// O interceptor redireciona para /auth/login quando recebe 401.
// Se a própria chamada para /auth/me retornar 401, o interceptor
// tenta redirecionar ANTES de Auth.initialized ser definido como true —
// mas a condição é `Auth.initialized && Auth.user`, então se user for null
// (usuário deslogado), o interceptor não dispara. Correto ✅.
//
// Porém há um edge case: se o backend retornar 401 para /auth/logout ou
// /auth/login (rotas de auth), o interceptor tenta redirecionar para login
// criando um loop. Adicionar exclusão de rotas de auth:

window.fetch = async function(...args) {
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  const res = await _originalFetch(...args);
  if (res.status === 401 && Auth.initialized && Auth.user) {
    if (url.includes('/auth/')) return res; // ← ADICIONAR — evitar loop
    if (typeof saveFormState === 'function') { try { saveFormState(); } catch {} }
    if (typeof saveDraft === 'function') { try { saveDraft(); } catch {} }
    window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
    return res;
  }
  return res;
};
```

### 3b. `renderHeader()` injeção via innerHTML com dados do usuário sem sanitizar

```js
// `name` e `initials` vêm de Auth.user.name que vem do servidor.
// Se o nome contiver caracteres HTML (<, >, &, "), injetar via innerHTML
// é uma vulnerabilidade XSS. Usar textContent para os valores dinâmicos:

// DE:
container.innerHTML = `
  ...
  <span class="user-name">${name}</span>
  ...
  <div class="avatar">${initials}</div>
`;

// PARA — criar elementos separados ou escapar:
// Substituir as ocorrências de ${name} e ${initials} por esc(name) e esc(initials)
// (a função esc() já existe em dashboard.html e admin.html — adicionar ao auth.js
// ou usar uma versão inline):

const escHtml = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Então usar escHtml(name) e escHtml(initials) no template string.
```

### 3c. `_outsideClickListenerAdded` é por instância mas Auth é singleton

```js
// Auth._outsideClickListenerAdded é false no objeto literal.
// Se renderHeader() for chamado múltiplas vezes (ex: impersonação re-renderiza),
// o listener só é adicionado uma vez. Correto ✅ — sem problema aqui.
// Porém o evento de click no document usa getElementById para encontrar
// trigger e dropdown — se renderHeader() re-renderizar e o usuário já
// tinha o dropdown aberto, os elementos são substituídos e o handler
// do clique externo vai encontrar null para trigger. Adicionar null check:

document.addEventListener('click', function(e) {
  const trigger = document.getElementById('userMenuTrigger');
  const dd = document.getElementById('userDropdown');
  if (!dd || !trigger) return; // ← ADICIONAR null check
  if (!trigger.contains(e.target) && !dd.contains(e.target)) {
    dd.style.display = 'none';
  }
});
```

---

## 4. `form-apresentacoes.html` — 3 correções

### 4a. `formLogo` morto (igual ao eventos)

```js
// DE:
const _fl = document.getElementById('formLogo'); if (_fl) _fl.src = URL_LOGO_PRETA;
// PARA: remover linha — elemento não existe no HTML
```

### 4b. Duplo submit possível — btn não é desabilitado imediatamente no edge case

```js
// submitForm() desabilita o botão na primeira linha, mas se validateRequiredFields()
// lançar uma exceção não tratada, o botão pode voltar a ficar ativo.
// Já tem btn.disabled = true antes do fetch — correto ✅. Sem problema real.
```

### 4c. `goToStep1()` e `goToStep2()` não atualizam o indicador de subtipo no h2

```js
// Já previsto no prompt-round17.md (item 3c).
// Garantir que goToStep2() inclui:
document.getElementById('formTitle').textContent =
  isAtualizar ? 'Apresentação — Atualização' : 'Apresentação — Nova';
// (já está implementado — ✅ correto)
```

---

## 5. `form-artes-divulgacao.html` — 2 correções

### 5a. `formLogo` morto

```js
// DE:
const _fl = document.getElementById('formLogo'); if (_fl) _fl.src = URL_LOGO_PRETA;
// PARA: remover linha
```

### 5b. Setor não é salvo no sessionStorage

```js
// saveSession() salva setor, título, finalidade, conteudo, observacoes.
// restoreSession() restaura todos. Porém o setor é um <select> populado
// de forma assíncrona (SETORES no init()) — se restoreSession() rodar
// antes do init() completar, o select pode não ter as options ainda.
// O fluxo atual é init() → restoreSession() dentro de init(), então está OK ✅.
// Sem correção necessária.
```

---

## 6. `form-atualizacao-material.html` — 1 correção

### 6a. `restoreDraft()` é chamado fora de `init()`

```js
// No final do arquivo:
// document.querySelectorAll('input,textarea,select').forEach(el => el.addEventListener('change', saveDraft));
// restoreDraft();   ← chamado ANTES de init(), antes do setor ser populado!

// O setor não será restaurado porque o select está vazio quando restoreDraft() roda.
// O script de população do setor está dentro de init() que é async.
// Mover restoreDraft() para dentro de init(), após popular os selects:

async function init() {
  await _configReady;
  await Auth.init();
  // ...
  const setorSel = document.getElementById('setor');
  if (setorSel) { SETORES.filter(...).forEach(...) }
  restoreDraft(); // ← MOVER PARA CÁ
}
// E remover a chamada solta no final do arquivo.
```

---

## 7. `form-cartao-visita.html` — 2 correções

### 7a. Indicador de subtipo ausente no h2

```js
// irParaPasso2() não atualiza o título com "Cartão de Visita — Físico/Digital".
// Já previsto no prompt-round17.md (item 3b).
// Confirmar que está sendo aplicado.
```

### 7b. `validateStep()` não valida arquivo obrigatório do digital

```js
// O campo fotoPerfilDigital tem required no input[type="file"],
// mas validateStep() só checa input.value.trim() — para file inputs,
// value é o caminho C:\fakepath\... que nunca é vazio se um arquivo
// foi selecionado. O problema é a verificação de required para files:
// input.value é '' quando nenhum arquivo foi selecionado.
// Na prática, a validação FUNCIONA porque input.value === '' quando vazio.
// ✅ Correto — sem correção.
```

---

## 8. `form-convite-fp.html` — 1 correção

### 8a. Placeholder do código de assessor ainda incorreto

```html
<!-- O placeholder ainda é "Ex: XP12345" — previsto no prompt-round17.md item 1.
     Confirmar aplicação: -->
<input type="text" id="codigoAssessor" placeholder="Ex.: 12345" required>
```

---

## 9. `form-criacao-pdf.html` — 2 correções

### 9a. `formLogo` morto

```js
// DE:
const _fl = document.getElementById('formLogo'); if (_fl) _fl.src = URL_LOGO_PRETA;
// PARA: remover linha
```

### 9b. `submitForm()` usa `alert()` em vez de exibir erro no elemento

```js
// DE:
else { alert('Erro ao enviar.'); btn.disabled = false; btn.textContent = 'Enviar'; }
} catch (e) { alert('Erro de conexão.'); btn.disabled = false; btn.textContent = 'Enviar'; }

// PARA (usar o padrão dos outros forms com submitError):
else {
  const d = await res.json().catch(() => ({}));
  const errEl = document.getElementById('submitError');
  if (errEl) { errEl.style.display = 'block'; errEl.textContent = d.error || 'Erro ao enviar. Tente novamente.'; }
  btn.disabled = false; btn.textContent = 'Enviar';
}
// No HTML, step3 não tem div#submitError — adicionar antes do form-nav:
// <div id="submitError" class="alert-card alert-danger" style="display:none;margin-bottom:16px"></div>
```

---

## 10. `form-divulgacao-nps.html` — 1 correção

### 10a. Foto de perfil não é obrigatória quando modelo "com-foto" selecionado

```js
// O campo fotoField aparece quando modelo = "com-foto", mas o input
// não tem `required` — o form pode ser enviado sem foto mesmo com "com-foto".
// Adicionar validação:

async function submitForm() {
  if (!validateRequiredFields()) return;

  // Validar foto quando modelo com-foto:
  if (document.getElementById('modeloArte').value === 'com-foto' &&
      !document.getElementById('fotoPerfil').files[0]) {
    const fieldEl = document.getElementById('fotoField');
    if (fieldEl) {
      fieldEl.classList.add('field-invalid');
      let errorEl = fieldEl.querySelector('.field-error');
      if (!errorEl) { errorEl = document.createElement('div'); errorEl.className = 'field-error'; fieldEl.appendChild(errorEl); }
      errorEl.textContent = 'A foto de perfil é obrigatória para o modelo selecionado.';
      fieldEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return;
  }
  // ... resto
}
```

---

## 11. `form-email-marketing.html` — 1 correção

### 11a. `init().then(restoreSession)` — race condition

```js
// No final do arquivo:
// init().then(restoreSession);
//
// init() popula o select de setor e termina. restoreSession() é chamado
// no .then() mas ANTES de _configReady resolver completamente se
// SETORES não estiver disponível ainda. Na prática init() await _configReady
// antes de popular — então quando .then() chama restoreSession(), SETORES
// já está disponível e o select já tem options.
// ✅ Funciona, mas é confuso. Recomendar mover restoreSession() para dentro de init():

async function init() {
  await _configReady;
  await Auth.init();
  // ...popular setor...
  FileUpload.bind('baseDisparo', 'baseDisparoName');
  restoreSession(); // ← mover para cá
}
// Remover: init().then(restoreSession);
// Trocar por: init();
```

---

## 12. `form-materiais-impressos.html` — 2 correções

### 12a. `pill()` usa `onclick` inline que chama `this.classList.toggle` — não funciona corretamente

```js
// A função pill() gera:
// onclick="this.classList.toggle('checked',this.querySelector('input').checked);
//   document.querySelectorAll('[name=X]').forEach(el=>
//     el.closest('label').classList.toggle('checked',el.checked));
//   atualizarPreview()"
//
// O problema: `this.querySelector('input').checked` é lido ANTES do
// browser processar o change — no momento do onclick o radio ainda não
// foi marcado (o click no label vai propagar e marcar DEPOIS).
// Para radios dentro de <label>, o browser marca o radio quando o label
// recebe click, mas o timing pode variar.
// Solução: usar o evento change do input diretamente:

function pill(name, value, label, recomendado) {
  const tag = recomendado ? `<span class="pill-tag">Recomendado</span>` : '';
  return `<label class="pill-radio" id="pill_${name}_${value}">
    <input type="radio" name="${name}" value="${value}"
      onchange="
        document.querySelectorAll('[name=${name}]').forEach(function(el){
          var l=el.closest('label');
          if(l) l.classList.toggle('checked',el.checked);
        });
        atualizarPreview();
      ">
    <span>${label}</span>${tag}
  </label>`;
}
```

### 12b. `selecionarTipo()` não remove `field-invalid` do container de tipos

```js
// Quando o usuário seleciona um tipo após erro de validação,
// o field-invalid do tipoMaterialContainer não é removido.
// Adicionar ao início de selecionarTipo():

function selecionarTipo(tipo) {
  // Remover field-invalid do container ao selecionar
  const field = document.getElementById('tipoMaterialContainer')?.closest('.field');
  if (field) field.classList.remove('field-invalid');
  // ... resto do código
}
```

---

## 13. `form-pagina-assessores.html` — 3 correções

### 13a. `formLogo` morto

```js
// DE:
const _fl = document.getElementById('formLogo'); if (_fl) _fl.src = URL_LOGO_PRETA;
// PARA: remover linha
```

### 13b. `submitForm()` inclui todos os campos mesmo no modo atualização

```js
// No modo isAtualizacao, camposSelecionados controla quais campos
// o usuário quer atualizar — mas dados no submitForm() inclui TODOS
// os campos independentemente de estar visible ou preenchido.
// O backend vai receber campos vazios ("") para campos não selecionados.
// Filtrar os dados para incluir apenas campos com valor:

// Na montagem do objeto dados em submitForm():
const dados = {
  nome: Auth.getUserName(),
  setor: document.getElementById('setor')?.value || '',
};
// Para isAtualizacao, incluir apenas os campos selecionados:
if (!isAtualizacao || camposSelecionados.has('nomeCompleto'))
  dados.nomeCompleto = document.getElementById('nomeCompleto').value;
if (!isAtualizacao || camposSelecionados.has('codigoAssessor'))
  dados.codigoAssessor = document.getElementById('codigoAssessor').value;
// ... mesmo padrão para linkedin, instagram, miniBio, unidade, contratoSocial
```

### 13c. `closePreview()` verifica `e.target` mas é chamado sem argumento pelo botão

```js
// DE:
function closePreview(e) {
  if (e && e.target !== document.getElementById('previewModal')) return;
  document.getElementById('previewModal').classList.remove('visible');
}
// O botão "Fechar" chama closePreview() sem argumento — `e` é undefined,
// então a condição `e && ...` é false e o modal fecha. ✅ Correto.
// Mas o botão × chama closePreview() também sem argumento. ✅ OK.
// O overlay tem onclick="closePreview(event)" — correto.
// Sem bug real aqui.
```

---

## 14. `form-patrocinio.html` — 2 correções

### 14a. Indicador de subtipo ausente — Patrocínio não tem step com escolha inicial

```
// Patrocínio tem 2 passos (dados do evento → financeiro) mas NÃO tem
// escolha de subtipo na etapa 1 — o h2 não precisa de indicador.
// Não se aplica o prompt-round17 item 3 para este form. ✅ Correto.
```

### 14b. Validação do step1 não verifica estado/cidade

```js
// validateStep('step1') itera input[required] dentro do step.
// O select #cidade tem required mas é disabled enquanto estado não é selecionado.
// Um input disabled não é submetido nem validado pelo browser.
// A validação custom de validateStep() checa input.value.trim() sem checar disabled.
// Se o usuário selecionar estado mas não selecionar cidade,
// cidSel.disabled = false e cidSel.value = '' — a validação vai pegar. ✅
// Se o usuário não selecionar estado, cidSel.disabled = true — correto
// porque `required` em disabled é ignorado pelo browser.
// O check de validateStep() não filtra disabled, então tentará validar
// cidade mesmo disabled. Como cidade.value = 'Selecione o estado' com value="",
// será considerado inválido MESMO com estado não selecionado.
// Adicionar filtro:

step.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
  if (input.disabled) return; // ← ADICIONAR
  // ... resto da validação
});
```

---

## 15. `form-producao-audiovisual.html` (doc 24) — duplicata de doc 2

```
O arquivo do documento 24 é IDÊNTICO ao documento 2 (form-producao-audiovisual.html).
São o mesmo arquivo enviado duas vezes. Aplicar as mesmas correções do
prompt-forms-review.md item 2.
```

---

## 16. `index.html` — 1 correção já identificada anteriormente

```js
// Já no prompt de lote anterior. Confirmar aplicação:
// goTo() não reabilita botões em caso de erro no Auth.init().
// Ver prompt-cleanup-geral.md item 7.
```

---

## 17. `form-outro.html`, `form-pagina-online.html`, `form-email-marketing.html`, `form-brindes.html` — limpos

```
Esses 4 forms estão bem estruturados.

form-outro.html: sem problemas.
form-pagina-online.html: sem problemas.
form-brindes.html: sem problemas — validação de checkboxes funciona corretamente.

form-email-marketing.html: apenas o race condition do init().then(restoreSession)
identificado no item 11a acima.
```

---

## RESUMO DE PRIORIDADES — LOTE 2

**Críticos:**
- 3a. auth.js: interceptor de fetch pode criar redirect loop em rotas /auth/
- 3b. auth.js: XSS potencial no renderHeader() com dados não sanitizados
- 10a. form-divulgacao-nps: foto obrigatória para "com-foto" não é validada
- 13b. form-pagina-assessores: modo atualização envia todos os campos mesmo os não selecionados
- 6a. form-atualizacao-material: restoreDraft() antes do setor ser populado

**Importantes:**
- 1a. admin.html: humanizeValue() retorna slugs brutos no drawer
- 1b. admin.html: cache de drawer por índice pode retornar item errado
- 1c/1d. admin.html: drawer sem botão ClickUp; CLICKUP_ICON não definido
- 2b. dashboard.html: switchTab não salva no sessionStorage
- 2e. dashboard.html: exportarLog ignora filtros ativos
- 9b. form-criacao-pdf: usa alert() em vez do padrão de erro inline
- 12a. form-materiais-impressos: pill() timing incorreto no onclick de radio
- 12b. form-materiais-impressos: field-invalid não limpo ao selecionar tipo
- 14b. form-patrocinio: validateStep não filtra inputs disabled

**Baixa prioridade / code quality:**
- 4a/5a/9a/13a. formLogo morto em 4 forms (form-apresentacoes, form-artes, form-criacao-pdf, form-pagina-assessores)
- 2a. dashboard.html: guard de Admin em switchTab
- 2c. dashboard.html: fallback de título para solicitações antigas
- 2d. dashboard.html: declaração duplicada de logPage
- 11a. form-email-marketing: init().then(restoreSession) — mover para dentro de init
- 15. form-producao-audiovisual duplicado (doc 24 = doc 2)
