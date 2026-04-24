# Correções nos forms existentes

---

## 1. Todos os forms novos — Campo telefone/WhatsApp com largura correta

```css
/* O problema: input[type="tel"] está herdando width:100% mas o container
   pode estar com flex ou grid quebrando a proporção. Garantir em style.css
   que tel segue o mesmo padrão dos demais: */
input[type="tel"] {
  width: 100%;
  border: 1px solid rgba(34,27,25,0.2);
  border-radius: 10px;
  padding: 10px 14px;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 0.9rem;
  /* igual aos outros inputs */
}
/* Se já está no bloco geral de inputs, apenas adicionar "input[type='tel']"
   na lista de seletores do bloco existente */
```

---

## 2. `form-assinatura-email.html` — Adicionar campo CFP

```html
<!-- Adicionar após o campo de Marca: -->
<div class="field">
  <label>Você possui CFP?</label>
  <div class="radio-group" style="flex-direction:row;gap:16px">
    <label class="radio-option">
      <input type="radio" name="cfp" value="sim">
      <span class="radio-custom"></span><span>Sim</span>
    </label>
    <label class="radio-option">
      <input type="radio" name="cfp" value="nao">
      <span class="radio-custom"></span><span>Não</span>
    </label>
  </div>
</div>
```

```js
// No submitForm(), adicionar ao objeto dados:
cfp: document.querySelector('input[name="cfp"]:checked')?.value || '',
```

```js
// Em config.js, adicionar ao DRAWER_FIELD_LABELS:
cfp: "Possui CFP?",
```

---

## 3. `form-cartao-visita.html` — Corrigir visual do step 1

O step 1 deve usar o padrão `radio-cards` lado a lado, igual a outros
forms que apresentam escolhas na primeira etapa (form-assessores, form-apresentacoes).

```html
<!-- Substituir o step 1 inteiro por: -->
<div class="form-step active" id="step1">
  <h2 style="font-weight:600;font-size:1.1rem;margin-bottom:20px">
    Qual tipo de cartão você precisa?
  </h2>
  <div class="radio-cards">
    <div class="radio-card" onclick="selectTipo('fisico')" id="cardFisico">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
          <line x1="1" y1="10" x2="23" y2="10"/>
        </svg>
      </div>
      <div class="card-label">Cartão Físico</div>
      <div class="card-desc">Cartão impresso para uso presencial</div>
    </div>
    <div class="radio-card" onclick="selectTipo('digital')" id="cardDigital">
      <div class="card-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>
      <div class="card-label">Cartão Digital</div>
      <div class="card-desc">Cartão digital enviado por e-mail</div>
    </div>
  </div>
  <div class="form-nav">
    <button class="btn btn-primary" id="btnNext1" disabled onclick="goToStep2()">
      Próximo
    </button>
  </div>
</div>
```

```js
// Atualizar selectTipo() para usar a classe correta:
function selectTipo(tipo) {
  window._tipoCartao = tipo;
  document.getElementById('cardFisico').className =
    'radio-card' + (tipo === 'fisico' ? ' selected' : '');
  document.getElementById('cardDigital').className =
    'radio-card' + (tipo === 'digital' ? ' selected' : '');
  document.getElementById('btnNext1').disabled = false;
}
```

**Remover qualquer referência a "N8N", "Bannerbear" ou detalhes técnicos
de integração de qualquer texto visível ao usuário em todos os forms.**

---

## 4. Remover campo Observações dos forms indicados

Nos seguintes forms, localizar e remover completamente o bloco do campo
"Observações" / "Observações gerais" (o field com id="observacoes"):

- `form-assinatura-email.html`
- `form-cartao-visita.html` (físico e digital)
- `form-cartao-boas-vindas.html`
- `form-divulgacao-nps.html`
- `form-convite-fp.html`
- `form-certificado-eventos.html`
- `form-outro.html`

```html
<!-- REMOVER este bloco de cada um: -->
<div class="field">
  <label>Observações (opcional)</label>
  <textarea id="observacoes" ...></textarea>
</div>
```

```js
// E remover do objeto dados no submitForm() de cada form:
// observacoes: document.getElementById('observacoes')?.value || '',
```

---

## 5. `form-cartao-boas-vindas.html` — Corrigir radio "Cliente Private?" inline

```html
<!-- Substituir o campo isPrivate por versão inline sem duplicação: -->
<div class="field">
  <label>Seu cliente se enquadra como Private?</label>
  <div class="radio-group" style="flex-direction:row;gap:24px">
    <label class="radio-option">
      <input type="radio" name="isPrivate" value="sim" required>
      <span class="radio-custom"></span>
      <span>Sim</span>
    </label>
    <label class="radio-option">
      <input type="radio" name="isPrivate" value="nao">
      <span class="radio-custom"></span>
      <span>Não</span>
    </label>
  </div>
</div>
```

---

## 6. `form-divulgacao-nps.html` — Campo "Modelo de arte" como select

```html
<!-- Substituir os radio-cards por select: -->
<div class="field">
  <label>Modelo de arte desejada</label>
  <select id="modeloArte" required onchange="handleModeloArte()">
    <option value="">Selecione</option>
    <option value="com-foto">Com foto</option>
    <option value="sem-foto">Sem foto</option>
  </select>
</div>

<!-- Campo de foto condicional logo abaixo: -->
<div class="field" id="fotoField" style="display:none">
  <label>Foto de perfil</label>
  <div class="file-input-wrapper">
    <label class="file-input-btn" for="fotoPerfil">Escolher foto</label>
    <input type="file" id="fotoPerfil" accept=".jpg,.jpeg,.png,.webp">
    <div class="file-name" id="fotoPerfilName"></div>
  </div>
</div>
```

```js
// Substituir selectModelo() por:
function handleModeloArte() {
  const val = document.getElementById('modeloArte').value;
  document.getElementById('fotoField').style.display =
    val === 'com-foto' ? 'block' : 'none';
}
```

```js
// No submitForm(), atualizar:
modeloArte: document.getElementById('modeloArte').value,
// (remover window._modeloArte)
```

---

## 7. `config.js` — Remover botões obsoletos e mover Material Impresso

### 7a. Remover itens de CATEGORIAS_SOLICITACAO:
```js
// Remover completamente estes itens de onde estiverem:
{ id: "obras-manutencao",    ... }
{ id: "materia-blog",        ... }
{ id: "conteudos-central",   ... }
```

### 7b. Remover categorias que ficam vazias após remoções:
```js
// Se "Audiovisual", "Impressos" e "Obras e manutenções" ficarem
// com apenas itens removidos, remover a categoria inteira.
// "Audiovisual" vai receber "producao-audiovisual" (ativo:true) — manter.
// "Impressos" vai receber "materiais-impressos" movido — manter ou fundir.
```

### 7c. Mover "Materiais Impressos" para "Marketing e conteúdo":
```js
// Em CATEGORIAS_SOLICITACAO, remover o item da categoria "Impressos"
// e adicionar ao array da categoria "Marketing e conteúdo":
{ id: "materiais-impressos", label: "Materiais Impressos",
  icon: "icon-printer", ativo: true }
```

### 7d. Renomear "Produção de Vídeo" para "Produção Audiovisual":
```js
// Em CATEGORIAS_SOLICITACAO:
{ id: "producao-audiovisual", label: "Produção Audiovisual",
  icon: "icon-video", ativo: true }

// Em TIPO_SOLICITACAO_LABELS:
"producao-audiovisual":     "Produção Audiovisual",
"producao-video":           "Produção de Vídeo",      // manter por compatibilidade
"sessao-fotos":             "Sessão de Fotos",
```

### 7e. Atualizar FORM_ROUTES:
```js
"producao-audiovisual": "form-producao-audiovisual.html",
"materiais-impressos":  "form-materiais-impressos.html",
"brindes":              "form-brindes.html",
"patrocinio":           "form-patrocinio.html",
"email-marketing":      "form-email-marketing.html",
"cartao-comemorativo":  "form-cartao-comemorativo.html",
```

### 7f. Ativar itens adicionais:
```js
{ id: "cartao-comemorativo", ativo: true }
{ id: "brindes",             ativo: true }
{ id: "patrocinio",          ativo: true }
{ id: "email-marketing",     ativo: true }
{ id: "producao-audiovisual", ativo: true } // renomeado de producao-video
{ id: "materiais-impressos", ativo: true }
```

---

## OBSERVAÇÕES

- `style.css`: adicionar `input[type="tel"]` ao bloco de seletores de inputs
- Nenhum desses arquivos precisa de build
- O campo "observacoes" removido dos forms não afeta o banco —
  simplesmente não será enviado, sem quebrar validações existentes
