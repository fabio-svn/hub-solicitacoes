# Revisão dos forms — bugs, inconsistências, código morto

---

## 1. `form-eventos.html` — 8 correções

### 1a. Corrigir `getStepCount()` — step 7 não existe no HTML

```js
// O HTML tem apenas steps 1–6. Presencial maturidade 1 e 2 têm
// steps: 1(natureza) → 2(maturidade) → 3(materiais) → 4(palestrantes) → 5(custos) → 6(anexos)
// = 6 steps, não 7.

// DE:
function getStepCount() {
  if (formState.natureza === 'online') return 6;
  if (formState.maturidade === 3) return 6;
  return 7;
}

// PARA:
function getStepCount() {
  return 6; // todos os caminhos têm 6 etapas
}

// E remover a variável morta:
// DE:
let totalSteps = 7;
// PARA: (remover linha)
```

### 1b. Corrigir `selected-green` para `selected` no Online

```js
// DE:
document.getElementById('cardOnline').className = 'radio-card' + (nat === 'online' ? ' selected-green' : '');
// PARA:
document.getElementById('cardOnline').className = 'radio-card' + (nat === 'online' ? ' selected' : '');
```

### 1c. Corrigir ordem em `activateStep(3)` — bind antes de restore

```js
// DE:
if (step === 3) {
  renderMateriais();
  formState.materiais.forEach(id => { ... });
  restoreCondMaterialFields();
  bindCondUploadHandlers();   // ← depois do restore
}

// PARA:
if (step === 3) {
  renderMateriais();
  formState.materiais.forEach(id => { ... });
  bindCondUploadHandlers();   // ← antes do restore
  restoreCondMaterialFields();
}
```

### 1d. Corrigir `closePrazosModal()` — stopPropagation no conteúdo interno

```html
<!-- O modal do prazos não tem stopPropagation no conteúdo, então
     clicar dentro do modal o fecha. Adicionar onclick no div interno: -->
<!-- DE: -->
<div onclick="event.stopPropagation()" style="background:var(--carbon-black)...">

<!-- O div interno JÁ tem onclick="event.stopPropagation()" no orientModal
     mas NÃO no prazosModal. Localizar o prazosModal e adicionar ao div interno: -->
<div onclick="event.stopPropagation()" style="background:var(--carbon-black);color:var(--paper-white);border-radius:16px;padding:32px;...">
```

### 1e. Remover `formLogo` morto do init

```js
// DE:
const _fl = document.getElementById('formLogo'); if (_fl) _fl.src = URL_LOGO_PRETA;
// PARA: (remover linha — elemento não existe no HTML)
```

### 1f. Adicionar campo Cargo ao step 1 (antes dos radio-cards de natureza)

```html
<!-- Localizar em step1, ANTES do div.radio-cards: -->
<div class="field" style="margin-bottom:16px">
  <label>Cargo <span style="color:var(--ruby-red)">*</span></label>
  <input type="text" id="cargo" placeholder="Seu cargo ou função" required>
</div>
<!-- Depois os radio-cards: -->
<div class="field">
  <div class="radio-cards">
    ...
  </div>
</div>
```

```js
// Adicionar "cargo" ao saveFormState() e restoreFormState():
// Em saveFormState(), na lista fields:
const fields = ['nomeEvento','dataEvento','horario','descricao',
  'origem','tipoEvento','publico','convidados','canal','linkTransmissao',
  'objetivos','custoEstimado','rateio','observacoes','localNome','localEndereco',
  'localSugestoes','ideaQuando','cargo'];  // ← adicionar 'cargo'

// Em validateStep1():
const cargo = !!document.getElementById('cargo')?.value?.trim();
document.getElementById('btnNext1').disabled = !(prazos && nat && setor && tutorial && cargo);

// Em submitForm(), dados:
cargo: document.getElementById('cargo')?.value || '',
```

### 1g. Adicionar indicador de subtipo ao avançar para step 2

```js
// Em selectNatureza(), após o código existente, adicionar ao final:
function selectNatureza(nat) {
  // ... código existente ...
  // Atualizar título com subtipo:
  const titulo = document.querySelector('.form-card h2');
  if (titulo) {
    const label = nat === 'presencial' ? 'Presencial' : 'Online';
    titulo.textContent = 'Eventos — ' + label;
  }
}
// Obs: só atualizar quando o usuário SELECIONAR (não no restore inicial)
// Para o restore, a atualização já acontece pois selectNatureza() é chamado
// por restoreFormState().
```

### 1h. Corrigir restauração de estado/cidade — usar callback após loadEstados

```js
// O problema: restoreFormState() chama selectNatureza() → renderMaturityFields()
// → setupDynamicListeners() → loadEstados() (async), mas o estado salvo
// só pode ser restaurado APÓS as options serem carregadas.
// 
// Em loadEstados(), após popular o select, verificar se há valor pendente:
async function loadEstados() {
  try {
    const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
    estados = await res.json();
    const sel = document.getElementById('estado');
    if (!sel) return;
    sel.innerHTML = '<option>Selecione</option>';
    estados.forEach(e => { sel.innerHTML += `<option value="${e.id}">${e.sigla} — ${e.nome}</option>`; });

    // Restaurar estado salvo após carregar as options:
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // O estado salvo pode ser o ID (ex: "41") ou o texto "PR — Paraná"
        // Tentar restaurar pelo value:
        if (saved._estado) {
          sel.value = saved._estado;
          if (sel.value) await loadCidades(saved._cidade);
        }
      }
    } catch {}
  } catch (e) { console.error('IBGE error:', e); }
}

// loadCidades() precisa aceitar um valor a restaurar:
async function loadCidades(cidadeParaRestaurar) {
  const estadoId = document.getElementById('estado').value;
  const cidSel = document.getElementById('cidade');
  if (!estadoId || estadoId === 'Selecione') { cidSel.disabled = true; cidSel.innerHTML = '<option>Selecione o estado</option>'; return; }
  cidSel.innerHTML = '<option>Carregando...</option>';
  try {
    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoId}/municipios?orderBy=nome`);
    const cidades = await res.json();
    cidSel.innerHTML = '<option>Selecione</option>';
    cidades.forEach(c => { cidSel.innerHTML += `<option>${c.nome}</option>`; });
    cidSel.disabled = false;
    if (cidadeParaRestaurar) cidSel.value = cidadeParaRestaurar; // ← restaurar cidade
  } catch (e) { console.error(e); }
}

// Em saveFormState(), salvar estado e cidade:
data._estado = document.getElementById('estado')?.value || '';
data._cidade = document.getElementById('cidade')?.value || '';
```

---

## 2. `form-producao-audiovisual.html` — 2 correções

### 2a. Adicionar `tipo_id` ao resumo do sessionStorage

```js
// Em submitForm(), dentro do bloco if (res.ok):
// DE:
sessionStorage.setItem('svn_ultimo_resumo', JSON.stringify({
  tipo: ... ,
  solicitante: Auth.getUserName(),
  ...
}));

// PARA:
sessionStorage.setItem('svn_ultimo_resumo', JSON.stringify({
  tipo_id: tipoSolicitacao,   // ← adicionar
  tipo: ... ,
  solicitante: Auth.getUserName(),
  ...
}));
```

### 2b. Adicionar indicador de subtipo ao goToStep2()

```js
// Em goToStep2(), após document.getElementById('stepLabel').textContent:
function goToStep2() {
  // ... código existente ...
  // Atualizar título:
  const titulo = document.querySelector('.form-card > div > h2');
  if (titulo) {
    const label = _modalidade === 'video' ? 'Produção de Vídeo' : 'Sessão de Fotos';
    titulo.textContent = 'Produção Audiovisual — ' + label;
  }
  window.scrollTo(0, 0);
}
```

---

## 3. `form-assinatura-email.html` — 1 correção

### 3a. Confirmar lógica de cargo/CFP por marca

```
VERIFICAR com o usuário antes de aplicar:
- MARCAS_CONTRATO = ['SVN Capital', 'SVN Connect', 'SVN Investimentos']
- Para essas marcas: campo Cargo é OCULTO, campo CFP é MOSTRADO
- Para outras marcas (ex: SVN Educação, SVN Gestora): Cargo é MOSTRADO, CFP é OCULTO

Se a lógica estiver correta, nenhuma mudança necessária.
Se estiver invertida (as 3 marcas principais DEVERIAM mostrar cargo), inverter:
const isContrato = MARCAS_CONTRATO.includes(marca);
// Trocar isContrato por !isContrato nos display dos campos
```

---

## 4. `form-cartao-boas-vindas.html` — 2 correções

### 4a. Corrigir validação de radio `isPrivate`

```js
// validateRequiredFields() usa !input.value.trim() que não funciona para radios.
// Adicionar validação específica para o radio isPrivate:

function validateRequiredFields() {
  document.querySelectorAll('.field-invalid').forEach(el => el.classList.remove('field-invalid'));
  const invalidFields = [];

  // Validação geral de inputs text/select/textarea:
  document.querySelectorAll('input[required]:not([type="radio"]), select[required], textarea[required]').forEach(input => {
    const isEmpty = !input.value.trim();
    if (isEmpty) {
      const fieldWrapper = input.closest('.field');
      if (fieldWrapper) {
        fieldWrapper.classList.add('field-invalid');
        let errorEl = fieldWrapper.querySelector('.field-error');
        if (!errorEl) { errorEl = document.createElement('div'); errorEl.className = 'field-error'; input.parentElement.appendChild(errorEl); }
        errorEl.textContent = 'Este campo é obrigatório.';
        invalidFields.push(fieldWrapper);
      }
    }
  });

  // Validação de radio groups obrigatórios:
  const radioNames = new Set(
    [...document.querySelectorAll('input[type="radio"][required]')].map(r => r.name)
  );
  radioNames.forEach(name => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    if (!checked) {
      const firstRadio = document.querySelector(`input[name="${name}"]`);
      const fieldWrapper = firstRadio?.closest('.field');
      if (fieldWrapper && !fieldWrapper.classList.contains('field-invalid')) {
        fieldWrapper.classList.add('field-invalid');
        invalidFields.push(fieldWrapper);
      }
    }
  });

  if (invalidFields.length > 0) { invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
  return true;
}
```

### 4b. Remover `cidade` do REQUIRED_FIELDS no backend (`forms.ts`)

```ts
// Já incluído no prompt-cleanup-geral.md (item 1e), mas confirmar que foi aplicado.
// DE:
"cartao-boas-vindas": ["nome", "nomeCliente", "nomeAssinatura", "contratoSocial", "unidade", "cidade"],
// PARA:
"cartao-boas-vindas": ["nome", "nomeCliente", "nomeAssinatura", "contratoSocial", "unidade"],
```

---

## 5. `form-cartao-comemorativo.html` — 2 correções

### 5a. Adicionar campo de e-mail (CRÍTICO — sem este campo o cartão não sabe para onde enviar)

```html
<!-- Adicionar campo de e-mail ANTES do botão Enviar: -->
<div class="field">
  <label>E-mail para envio do cartão <span style="color:var(--ruby-red)">*</span></label>
  <input type="email" id="emailDestinatario" placeholder="email@svninvest.com.br" required>
  <div class="field-hint">O cartão será enviado para este e-mail.</div>
</div>
```

```js
// Em saveSession(), adicionar:
emailDestinatario: document.getElementById('emailDestinatario')?.value || '',

// Em restoreSession(), adicionar:
if (data.emailDestinatario) document.getElementById('emailDestinatario').value = data.emailDestinatario;

// Em submitForm(), adicionar ao dados:
emailDestinatario: document.getElementById('emailDestinatario').value,

// Em buildWebhookFields() no forms.ts, atualizar o case:
case 'cartao-comemorativo':
  return {
    nome_aniversariante: s(dados.nomeAniversariante),
    modelo:              s(dados.modeloCartao),
    mensagem:            s(dados.mensagem),
    assinatura:          s(dados.assinatura),
    email:               s(dados.emailDestinatario) || userEmail,
  };
```

### 5b. Corrigir inconsistência no handler de change

```js
// DE (tem condição .trim() desnecessária no change):
document.addEventListener('change', function(e) {
  const field = e.target.closest('.field');
  if (field && field.classList.contains('field-invalid') && e.target.value.trim())
    field.classList.remove('field-invalid');  // ← .trim() na condição do change
  saveSession();
});

// PARA (igual ao padrão dos outros forms):
document.addEventListener('change', function(e) {
  const field = e.target.closest('.field');
  if (field && field.classList.contains('field-invalid'))
    field.classList.remove('field-invalid');
  saveSession();
});
```

---

## 6. `form-certificado-eventos.html` — 2 correções

### 6a. Tornar `idEvento` obrigatório (já previsto no prompt-round17)

```html
<!-- DE: -->
<div class="field">
  <label>ID do evento (opcional)</label>
  <input type="text" id="idEvento" placeholder="Código ou ID do evento no sistema">
</div>

<!-- PARA: -->
<div class="field">
  <label>ID do evento <span style="color:var(--ruby-red)">*</span></label>
  <input type="text" id="idEvento" placeholder="Ex: P-MGF-2026-04-15-123" required>
  <div class="field-hint">O ID está disponível na página do evento no Hub.</div>
</div>
```

### 6b. CANCELAR item 1b do prompt-cleanup-geral — `emailCertificado` existe no HTML

```
ATENÇÃO: O prompt-cleanup-geral.md (item 1b) instrui a REMOVER "emailCertificado"
do REQUIRED_FIELDS. Isso está ERRADO — o campo existe no HTML com id="emailCertificado".
NÃO aplicar o item 1b do prompt-cleanup-geral.

REQUIRED_FIELDS correto para certificado-eventos:
"certificado-eventos": ["nome", "nomeCompleto", "whatsapp", "emailCertificado", "cargaHoraria"]
Manter como está.
```

---

## RESUMO DE PRIORIDADES

**Críticos:**
- 5a: cartão comemorativo sem e-mail → N8N não sabe para onde enviar
- 1a: `getStepCount()` retorna 7 mas HTML tem 6 steps → barra de progresso errada
- 1b: `selected-green` provavelmente não existe no CSS → Online sem estilo visual

**Importantes:**
- 1f: campo Cargo no step 1 de eventos (já estava no round17)
- 1g: indicador de subtipo em eventos (round17)
- 4a: radio `isPrivate` não é validado → form envia sem seleção sem erro
- 1h: estado/cidade nunca restaurados do rascunho
- 6a: ID do evento obrigatório (round17)
- 6b: NÃO remover emailCertificado do REQUIRED_FIELDS (cancelar item do cleanup)

**Baixa prioridade:**
- 1c: ordem bind/restore em materiais
- 1d: stopPropagation no modal de prazos
- 1e: remover linha `formLogo` morta
- 2a: tipo_id faltando no resumo do audiovisual
- 5b: inconsistência no handler de change do comemorativo
