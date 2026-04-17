# Refatoração — Remoção de sub-opções popup + escolha no form

---

## 1. `config.js` — Remover subOpcoes dos itens com popup

Localizar os itens com `subOpcoes` em `CATEGORIAS_SOLICITACAO` e remover
a propriedade `subOpcoes` de cada um, mantendo o item como entrada direta:

```js
// Página de Assessores — remover subOpcoes, rota vai direto para o form
{ id: "pagina-assessores", label: "Página de Assessores", icon: "icon-user", ativo: true },

// Apresentação — remover subOpcoes, rota vai direto para o form
{ id: "apresentacao", label: "Apresentação", icon: "icon-monitor", ativo: true },

// Conteúdo em PDF — remover subOpcoes, rota vai direto para o form
{ id: "conteudo-pdf", label: "Conteúdo em PDF", icon: "icon-file-pdf", ativo: true },
```

### Atualizar `FORM_ROUTES` para apontar para os forms sem subtipo na URL:

```js
// Substituir as entradas dos três tipos:
"pagina-assessores":    "form-pagina-assessores.html",
"apresentacao":         "form-apresentacoes.html",
"conteudo-pdf":         "form-criacao-pdf.html",

// Remover as entradas de subtipo específico que não serão mais usadas via popup:
// "pagina-assessores-dados", "pagina-assessores-atualizacao",
// "apresentacao-nova", "apresentacao-atualizar",
// "conteudo-pdf-informativo", "conteudo-pdf-ebook"
// (mantê-las para compatibilidade com links diretos antigos, mas não são mais necessárias)
```

---

## 2. `solicitacoes.html` — Remover lógica de popup de sub-opções

### 2a. Remover o overlay de sub-opções do HTML

```html
<!-- REMOVER completamente: -->
<div class="sub-options-overlay" id="subOptionsOverlay" onclick="closeSubOptions(event)">
  <div class="sub-options-card" id="subOptionsCard" onclick="event.stopPropagation()">
    <h3 id="subOptionsTitle"></h3>
    <div id="subOptionsList"></div>
  </div>
</div>
```

### 2b. Simplificar `handleItemClick()` — remover lógica de subOpcoes

```js
function handleItemClick(item) {
  const route = FORM_ROUTES[item.id];
  if (route) window.location.href = '/' + route;
}
```

### 2c. Remover funções obsoletas

Remover completamente as funções:
- `showSubOptions(item)`
- `closeSubOptions(e)`

### 2d. Remover listener de Escape do subOptionsOverlay

```js
// REMOVER:
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('subOptionsOverlay').classList.remove('visible');
  }
});
```

---

## 3. `form-pagina-assessores.html` — Adicionar etapa de escolha de subtipo

### 3a. Alterar detecção de subtipo

```js
// DE:
const params = new URLSearchParams(window.location.search);
const subtipo = params.get('subtipo') || 'dados';
const isAtualizacao = subtipo === 'atualização' || subtipo === 'atualizacao';

// PARA:
const params = new URLSearchParams(window.location.search);
let subtipo = params.get('subtipo') || '';
let isAtualizacao = subtipo === 'atualizacao';
// subtipo será definido na etapa 1 se não vier pela URL
```

### 3b. Adicionar Step 1 de escolha antes do formulário atual

Inserir antes do `div#step2` existente (que passa a ser step2):

```html
<div class="form-step active" id="step1">
  <h2 style="font-weight:600;font-size:1.1rem;margin-bottom:8px">Qual tipo de solicitação?</h2>
  <p style="font-size:0.85rem;opacity:0.6;margin-bottom:20px">Selecione o que melhor descreve sua necessidade.</p>
  <div class="radio-cards">
    <div class="radio-card" onclick="selectSubtipo('dados')" id="cardDados">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      </div>
      <div class="card-label">Dados para página de assessores</div>
      <div class="card-desc">Para quando o assessor ainda não tem página própria nos sites SVN</div>
    </div>
    <div class="radio-card" onclick="selectSubtipo('atualizacao')" id="cardAtualizacao">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </div>
      <div class="card-label">Atualizar dados da página</div>
      <div class="card-desc">Para atualizar foto, bio, novos selos adquiridos ou outras informações do perfil existente</div>
    </div>
  </div>
  <div class="form-nav">
    <button class="btn btn-primary" id="btnNext1" disabled onclick="goToStep2()">Próximo</button>
  </div>
</div>
```

### 3c. Adicionar função `selectSubtipo()` e `goToStep2()`

```js
function selectSubtipo(tipo) {
  subtipo = tipo;
  isAtualizacao = tipo === 'atualizacao';
  document.getElementById('cardDados').className = 'radio-card' + (tipo === 'dados' ? ' selected' : '');
  document.getElementById('cardAtualizacao').className = 'radio-card' + (tipo === 'atualizacao' ? ' selected' : '');
  document.getElementById('btnNext1').disabled = false;
}

function goToStep2() {
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('formTitle').textContent = subtipo === 'atualizacao'
    ? 'Página de Assessores — Atualização'
    : 'Página de Assessores — Dados';
  if (isAtualizacao) document.getElementById('updateCard').style.display = 'block';
}
```

### 3d. Atualizar barra de progresso

```js
// No step1: width 50%
// No step2: width 100%
// Adicionar ao goToStep2():
document.getElementById('progressBar').style.width = '100%';
```

### 3e. Atualizar `submitForm()` para usar o subtipo dinâmico

```js
// O subtipo já é a variável dinâmica — verificar que TIPOS usa:
const TIPOS = {
  dados:       'pagina-assessores-dados',
  atualizacao: 'pagina-assessores-atualizacao'
};
// formData.append('tipo_solicitacao', TIPOS[subtipo] || TIPOS.dados);
// Já deve funcionar pois subtipo é a variável definida em selectSubtipo()
```

---

## 4. `form-apresentacoes.html` — Adicionar etapa de escolha de subtipo

### 4a. Alterar detecção de subtipo

```js
// DE:
const subtipo = params.get('subtipo') || 'nova';
const isAtualizar = subtipo === 'atualizar';

// PARA:
let subtipo = params.get('subtipo') || '';
let isAtualizar = subtipo === 'atualizar';
```

### 4b. Adicionar Step 0 de escolha antes do step1 atual

Renomear `step1` atual para `step2` e `step2` para `step3`.
Adicionar novo `step1`:

```html
<div class="form-step active" id="step1">
  <h2 style="font-weight:600;font-size:1.1rem;margin-bottom:8px">Qual tipo de solicitação?</h2>
  <div class="radio-cards">
    <div class="radio-card" onclick="selectSubtipo('nova')" id="cardNova">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </div>
      <div class="card-label">Nova apresentação</div>
      <div class="card-desc">Criar uma apresentação do zero ou a partir de uma base existente</div>
    </div>
    <div class="radio-card" onclick="selectSubtipo('atualizar')" id="cardAtualizar">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
      </div>
      <div class="card-label">Atualizar apresentação</div>
      <div class="card-desc">Atualizar dados, layout ou conteúdo de uma apresentação existente</div>
    </div>
  </div>
  <div class="form-nav">
    <button class="btn btn-primary" id="btnNext1" disabled onclick="goToStep2()">Próximo</button>
  </div>
</div>
```

### 4c. Atualizar `goStep()` para refletir numeração correta (3 etapas total)

```js
function selectSubtipo(tipo) {
  subtipo = tipo;
  isAtualizar = tipo === 'atualizar';
  document.getElementById('cardNova').className = 'radio-card' + (tipo === 'nova' ? ' selected' : '');
  document.getElementById('cardAtualizar').className = 'radio-card' + (tipo === 'atualizar' ? ' selected' : '');
  document.getElementById('btnNext1').disabled = false;
}

function goToStep2() {
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('progressBar').style.width = '50%';
  document.getElementById('stepLabel').textContent = 'Etapa 2 de 3';
  document.getElementById('formTitle').textContent = isAtualizar ? 'Atualizar Apresentação' : 'Nova Apresentação';
  if (isAtualizar) document.getElementById('uploadAtualizar').style.display = 'block';
  else document.getElementById('tipoCriacaoField').style.display = 'block';
}
```

Atualizar `goStep()` para mapear step2→step3 corretamente:
```js
function goStep(step) {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById('step' + step).classList.add('active');
  const progress = step === 1 ? 33 : step === 2 ? 66 : 100;
  document.getElementById('progressBar').style.width = progress + '%';
  document.getElementById('stepLabel').textContent = `Etapa ${step} de 3`;
  window.scrollTo(0, 0);
}
```

---

## 5. `form-criacao-pdf.html` — Adicionar etapa de escolha de subtipo

### 5a. Mesma estrutura dos forms anteriores

```js
let subtipo = params.get('subtipo') || '';
```

### 5b. Adicionar Step 1 de escolha

```html
<div class="form-step active" id="step1">
  <h2 style="font-weight:600;font-size:1.1rem;margin-bottom:8px">Qual tipo de PDF?</h2>
  <div class="radio-cards">
    <div class="radio-card" onclick="selectSubtipo('informativo')" id="cardInformativo">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </div>
      <div class="card-label">Informativo</div>
      <div class="card-desc">Material de apoio, resumo ou documento informativo em PDF</div>
    </div>
    <div class="radio-card" onclick="selectSubtipo('ebook')" id="cardEbook">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
      </div>
      <div class="card-label">E-book</div>
      <div class="card-desc">Material educativo ou guia completo em formato de e-book</div>
    </div>
  </div>
  <div class="form-nav">
    <button class="btn btn-primary" id="btnNext1" disabled onclick="goToStep2()">Próximo</button>
  </div>
</div>
```

### 5c. Funções de controle

```js
function selectSubtipo(tipo) {
  subtipo = tipo;
  document.getElementById('cardInformativo').className = 'radio-card' + (tipo === 'informativo' ? ' selected' : '');
  document.getElementById('cardEbook').className = 'radio-card' + (tipo === 'ebook' ? ' selected' : '');
  document.getElementById('btnNext1').disabled = false;
}

function goToStep2() {
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('progressBar').style.width = '50%';
  document.getElementById('stepLabel').textContent = 'Etapa 2 de 3';
  document.getElementById('formTitle').textContent = subtipo === 'ebook' ? 'PDF — E-book' : 'PDF — Informativo';
}
```

Renomear `step1` atual para `step2` e `step2` para `step3`.
Atualizar `goStep()` para 3 etapas (igual ao form-apresentacoes).

---

## OBSERVAÇÕES

- Após as mudanças, os links diretos com `?subtipo=nova` ainda funcionam
  pois `let subtipo = params.get('subtipo') || ''` aceita valor via URL
- O `style.css` não precisa de alterações — `.radio-card` já está estilizado
- Não há necessidade de build — apenas arquivos HTML e JS do frontend
- Os botões Voltar nos step2/step3 devem voltar para step1 (escolha de subtipo)
  nos forms que receberam a nova etapa inicial
