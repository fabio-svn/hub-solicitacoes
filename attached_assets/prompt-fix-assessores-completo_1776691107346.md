# Correção — form-pagina-assessores.html (Round 9 não aplicado)

---

## 1. Corrigir texto do card "Dados" no step1

```html
<!-- Localizar e substituir: -->

<!-- DE: -->
<div class="card-label">Dados para página de assessores</div>
<div class="card-desc">Para quando o assessor ainda não tem página própria nos sites SVN</div>

<!-- PARA: -->
<div class="card-label">É a primeira vez que preencho meus dados para criação da página de assessor(a)</div>
<div class="card-desc">Para quando sua página ainda não existe nos sites SVN</div>
```

---

## 2. Adicionar `id="field_CAMPO"` nos wrappers de campo do step2

Cada `<div class="field">` do step2 precisa de um id correspondente.
Localizar cada campo e adicionar o id ao wrapper:

```html
<!-- Nome completo -->
<div class="field" id="field_nomeCompleto">
  <label>Nome completo</label>
  <input type="text" id="nomeCompleto" ...>
</div>

<!-- Código de assessor -->
<div class="field" id="field_codigoAssessor">
  <label>Código de assessor</label>
  <input type="text" id="codigoAssessor" ...>
</div>

<!-- Unidade -->
<div class="field" id="field_unidade">
  <label>Unidade</label>
  <select id="unidade" ...></select>
</div>

<!-- Contrato social -->
<div class="field" id="field_contratoSocial">
  <label>Contrato social</label>
  <select id="contratoSocial" ...></select>
</div>

<!-- Foto de perfil — o wrapper já existe, adicionar id -->
<div class="field" id="field_fotoPerfil">
  <label style="display:block;margin-bottom:10px">Foto de perfil</label>
  ...
</div>

<!-- LinkedIn -->
<div class="field" id="field_linkedin">
  <label>Perfil do LinkedIn</label>
  <input type="url" id="linkedin" ...>
</div>

<!-- Instagram -->
<div class="field" id="field_instagram">
  <label>Perfil do Instagram (opcional)</label>
  <input type="text" id="instagram" ...>
</div>

<!-- Mini-bio -->
<div class="field" id="field_miniBio">
  <label>Mini-bio</label>
  <textarea id="miniBio" ...></textarea>
</div>

<!-- Selos — o wrapper já existe, adicionar id -->
<div class="field" id="field_selos">
  <label>Selos e certificações (opcional)</label>
  <div class="pills-wrap" id="selosContainer"></div>
</div>

<!-- Depoimentos — o wrapper já existe, adicionar id -->
<div class="field" id="field_depoimentos" style="margin-top:24px">
  <label>Depoimentos de clientes (opcional, até 3)</label>
  ...
</div>
```

---

## 3. Adicionar `div#step2seletor` ANTES do `div#step2` existente

Inserir este bloco HTML imediatamente antes de `<div class="form-step" id="step2">`:

```html
<div class="form-step" id="step2seletor">
  <h2 style="font-weight:600;font-size:1.05rem;margin-bottom:6px">O que você gostaria de atualizar?</h2>
  <p style="font-size:0.85rem;opacity:0.55;margin-bottom:20px">Selecione todos os campos que deseja atualizar.</p>

  <div style="display:flex;flex-direction:column;gap:8px" id="camposBtnList">
    <button class="campo-toggle-btn" data-campo="nomeCompleto" onclick="toggleCampo(this)">
      <span>Nome completo</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="codigoAssessor" onclick="toggleCampo(this)">
      <span>Código do assessor</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="unidade" onclick="toggleCampo(this)">
      <span>Unidade</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="contratoSocial" onclick="toggleCampo(this)">
      <span>Contrato social</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="fotoPerfil" onclick="toggleCampo(this)">
      <span>Foto de perfil</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="linkedin" onclick="toggleCampo(this)">
      <span>LinkedIn</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="instagram" onclick="toggleCampo(this)">
      <span>Instagram</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="miniBio" onclick="toggleCampo(this)">
      <span>Mini bio</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="selos" onclick="toggleCampo(this)">
      <span>Selos</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
    <button class="campo-toggle-btn" data-campo="depoimentos" onclick="toggleCampo(this)">
      <span>Depoimentos</span>
      <svg class="campo-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    </button>
  </div>

  <div id="seletorError" style="display:none;color:var(--ruby-red);font-size:0.82rem;margin-top:12px">
    Selecione ao menos um campo para continuar.
  </div>

  <div class="form-nav" style="margin-top:24px">
    <button class="btn btn-secondary" onclick="voltarParaStep1()">Voltar</button>
    <button class="btn btn-primary" onclick="confirmarCamposSelecionados()">Próximo</button>
  </div>
</div>
```

---

## 4. Adicionar estilos `.campo-toggle-btn` no `style.css`

```css
.campo-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: var(--icon-bg);
  border: 1.5px solid transparent;
  border-radius: 10px;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--carbon-black);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  text-align: left;
}

.campo-toggle-btn .campo-check {
  opacity: 0;
  color: var(--ruby-red);
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.campo-toggle-btn.selecionado {
  border-color: var(--ruby-red);
  background: rgba(172,54,49,0.05);
}

.campo-toggle-btn.selecionado .campo-check {
  opacity: 1;
}
```

---

## 5. Substituir `goToStep2()` no script

```js
// DE:
function goToStep2() {
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('progressBar').style.width = '100%';
  document.getElementById('stepLabel').textContent = 'Etapa 2 de 2';
  document.getElementById('formTitle').textContent = isAtualizacao
    ? 'Página de Assessores — Atualização'
    : 'Página de Assessores — Dados';
  if (isAtualizacao) document.getElementById('updateCard').style.display = 'block';
  window.scrollTo(0, 0);
}

// PARA:
function goToStep2() {
  document.getElementById('step1').classList.remove('active');

  if (isAtualizacao) {
    document.getElementById('step2seletor').classList.add('active');
    document.getElementById('progressBar').style.width = '50%';
    document.getElementById('stepLabel').textContent = 'Etapa 2 de 3';
    document.getElementById('formTitle').textContent = 'Página de Assessores — Atualização';
  } else {
    document.getElementById('step2').classList.add('active');
    document.getElementById('progressBar').style.width = '100%';
    document.getElementById('stepLabel').textContent = 'Etapa 2 de 2';
    document.getElementById('formTitle').textContent = 'Página de Assessores — Dados';
  }
  window.scrollTo(0, 0);
}
```

---

## 6. Adicionar funções de controle do seletor no script

Adicionar após `goToStep2()`:

```js
const camposSelecionados = new Set();

function toggleCampo(btn) {
  const campo = btn.dataset.campo;
  if (camposSelecionados.has(campo)) {
    camposSelecionados.delete(campo);
    btn.classList.remove('selecionado');
  } else {
    camposSelecionados.add(campo);
    btn.classList.add('selecionado');
  }
  document.getElementById('seletorError').style.display = 'none';
}

function voltarParaStep1() {
  document.getElementById('step2seletor').classList.remove('active');
  document.getElementById('step1').classList.add('active');
  document.getElementById('progressBar').style.width = '50%';
  document.getElementById('stepLabel').textContent = 'Etapa 1 de 3';
}

function confirmarCamposSelecionados() {
  if (camposSelecionados.size === 0) {
    document.getElementById('seletorError').style.display = 'block';
    return;
  }

  const todosCampos = [
    'nomeCompleto','codigoAssessor','unidade','contratoSocial',
    'fotoPerfil','linkedin','instagram','miniBio','selos','depoimentos'
  ];

  // Ocultar todos e remover required
  todosCampos.forEach(campo => {
    const el = document.getElementById('field_' + campo);
    if (el) {
      el.style.display = 'none';
      const inputs = el.querySelectorAll('input,textarea,select');
      inputs.forEach(i => i.required = false);
    }
  });

  // Mostrar selecionados e tornar obrigatórios
  camposSelecionados.forEach(campo => {
    const el = document.getElementById('field_' + campo);
    if (el) {
      el.style.display = 'block';
      const inputs = el.querySelectorAll('input,textarea,select');
      inputs.forEach(i => {
        // Só tornar required se não for opcional por natureza
        const optionalCampos = ['instagram', 'selos', 'depoimentos'];
        if (!optionalCampos.includes(campo)) i.required = true;
      });
    }
  });

  // Mostrar updateCard (já estava visível para atualização)
  document.getElementById('updateCard').style.display = 'block';

  document.getElementById('step2seletor').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('progressBar').style.width = '100%';
  document.getElementById('stepLabel').textContent = 'Etapa 3 de 3';
  window.scrollTo(0, 0);
}
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas `form-pagina-assessores.html` e `style.css`
- O campo Setor não entra no seletor pois é sempre obrigatório
- Os campos opcionais por natureza (instagram, selos, depoimentos)
  nunca recebem `required = true` mesmo quando selecionados
- O botão Voltar no step2seletor vai para step1,
  e o botão Voltar no step2 (se existir) deve voltar para step2seletor
  quando `isAtualizacao === true`
