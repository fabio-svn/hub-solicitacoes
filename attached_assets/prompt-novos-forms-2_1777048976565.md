# Novos forms — Lote 2

## IDs das listas ClickUp
- Brindes: `900100469662`
- Patrocínios: `901324638951`
- Solicitações Gerais (existente): `901300673533`

---

## 1. `forms.ts` — Adicionar novos tipos

### VALID_TIPOS:
```ts
"cartao-comemorativo", "brindes", "patrocinio", "email-marketing",
"producao-video", "sessao-fotos", "materiais-impressos",
```

### REQUIRED_FIELDS:
```ts
"cartao-comemorativo": ["nome", "nomeAniversariante", "modeloCartao", "mensagem", "assinatura"],
"brindes":             ["nome", "titulo", "finalidade", "dataEntrega", "itens"],
"patrocinio":          ["nome", "tituloEvento", "dataEvento", "horario", "local", "tipoEvento", "publico", "explicacao"],
"email-marketing":     ["nome", "assunto", "finalidade", "tema", "dataDisparo", "assinaturaEmail"],
"producao-video":      ["nome", "titulo", "ideia", "formato"],
"sessao-fotos":        ["nome", "titulo", "descricao"],
"materiais-impressos": ["nome", "tipoMaterial"],
```

---

## 2. `clickup.ts` — Novos tipos e listas

### 2a. Adicionar à lista de TIPOS_SEM_CLICKUP:
```ts
"cartao-comemorativo",
```

### 2b. Adicionar função getListId para novos tipos:
```ts
function getListId(tipo: string): string {
  if (tipo === "eventos") return CLICKUP_LIST_EVENTOS;
  if (tipo === "brindes") return process.env.CLICKUP_LIST_BRINDES || "900100469662";
  if (tipo === "patrocinio") return process.env.CLICKUP_LIST_PATROCINIO || "901324638951";
  return CLICKUP_LIST_GERAL;
}
```

### 2c. Adicionar em PRAZO_DIAS_UTEIS:
```ts
"email-marketing":     3,
"producao-video":      7,
"sessao-fotos":        7,
"materiais-impressos": 5,
"brindes":             15,
"patrocinio":          30,
```

### 2d. Adicionar labels em REQUEST_TYPE_LABELS:
```ts
"cartao-comemorativo":  "Cartão Comemorativo",
"brindes":              "Brindes",
"patrocinio":           "Patrocínio",
"email-marketing":      "E-mail Marketing",
"producao-video":       "Produção de Vídeo",
"sessao-fotos":         "Sessão de Fotos",
"materiais-impressos":  "Materiais Impressos",
```

### 2e. Adicionar Secrets do Replit (ação manual):
```
CLICKUP_LIST_BRINDES=900100469662
CLICKUP_LIST_PATROCINIO=901324638951
```

---

## 3. `config.js` — Labels e labels do drawer

### TIPO_SOLICITACAO_LABELS:
```js
"cartao-comemorativo": "Cartão Comemorativo",
"brindes":             "Brindes",
"patrocinio":          "Patrocínio",
"email-marketing":     "E-mail Marketing",
"producao-video":      "Produção de Vídeo",
"sessao-fotos":        "Sessão de Fotos",
"materiais-impressos": "Materiais Impressos",
```

### DRAWER_FIELD_LABELS — novos campos:
```js
nomeAniversariante: "Nome do aniversariante",
modeloCartao:       "Modelo do cartão",
mensagem:           "Mensagem",
assinatura:         "Assinatura",
dataEntrega:        "Data de entrega",
itens:              "Itens solicitados",
centroCusto:        "Centro de custo",
valorCota:          "Valor da cota",
orcamentoTotal:     "Orçamento total",
expectativaRetorno: "Expectativa de retorno",
orcAlimentacao:     "Orçamento por pessoa (alimentação)",
orcGrafico:         "Orçamento — material gráfico",
orcBrindes:         "Orçamento — brindes",
orcStaff:           "Orçamento — equipe staff",
assunto:            "Assunto do e-mail",
tema:               "Tema e resumo",
dataDisparo:        "Data de disparo",
assinaturaEmail:    "Assinatura do e-mail",
ideia:              "Ideia / Descrição",
formato:            "Formato",
tipoMaterial:       "Tipo de material",
orientacao:         "Orientação",
formatoPapel:       "Formato do papel",
conteudoMaterial:   "Conteúdo do material",
```

---

## 4. NOVOS ARQUIVOS HTML

---

### 4a. `form-cartao-comemorativo.html`

**1 step. Integração N8N. Não vai ao ClickUp.**

**Dica:**
```html
<div class="alert-card alert-info">
  <div class="alert-text">
    <strong>Parabenize clientes e colegas de trabalho com um cartão personalizado!</strong><br><br>
    • Escreva apenas o nome e 1 sobrenome, para não ultrapassar o espaço da arte;<br>
    • Escolha se deseja o texto padrão ou se quer escrever sua própria mensagem;<br>
    • Defina seu modelo de cartão preferido.<br><br>
    Assim que estiver pronto, o cartão chegará no e-mail informado.
  </div>
</div>
```

**Campos:**
```html
<div class="field">
  <label>Setor <span style="color:var(--ruby-red)">*</span></label>
  <select id="setor" required>...</select>
</div>
<div class="field">
  <label>Nome do aniversariante (nome e 1 sobrenome)</label>
  <input type="text" id="nomeAniversariante" placeholder="Ex: João Silva" required>
</div>
<div class="field">
  <label>Modelo do cartão</label>
  <select id="modeloCartao" required>
    <option value="">Selecione</option>
    <option value="dourado">Dourado</option>
    <option value="vermelho">Vermelho</option>
  </select>
</div>
<div class="field">
  <label>Mensagem</label>
  <textarea id="mensagem" required>Desejamos que este novo ciclo da sua vida seja repleto de conquistas e realizações. Somos gratos por fazer parte da sua trajetória e por sua confiança em nosso trabalho. Conte sempre conosco para acompanhar e apoiar cada passo rumo aos seus objetivos. Parabéns! Que seu dia seja tão extraordinário quanto você merece!</textarea>
  <div class="field-hint">Você pode editar o texto ou usar o modelo padrão acima.</div>
</div>
<div class="field">
  <label>Assinatura</label>
  <textarea id="assinatura" required>Um abraço, Assessor(a).</textarea>
  <div class="field-hint">Personalize com seu nome se preferir.</div>
</div>
```

**Webhook config (admin only):**
```js
const WEBHOOK_KEY = 'svn_webhook_comemorativo';
```

---

### 4b. `form-brindes.html`

**1 step. Vai ao ClickUp (lista Brindes). Não entra no sistema de aprovação.**

**Dica:**
```html
<div class="alert-card alert-info">
  <div class="alert-text">
    O prazo mínimo para a solicitação de brindes é de 15 dias de antecedência.
  </div>
</div>
```

**Campos:**
```html
<div class="field">
  <label>Setor <span style="color:var(--ruby-red)">*</span></label>
  <select id="setor" required>...</select>
</div>
<div class="field">
  <label>Título da solicitação</label>
  <input type="text" id="titulo" placeholder="Ex: brinde para [ocasião]" required>
</div>
<div class="field">
  <label>Para qual finalidade você usará esses brindes?</label>
  <input type="text" id="finalidade" placeholder="Descreva a finalidade" required>
</div>
<div class="field">
  <label>Em qual data pretende entregar esse brinde?</label>
  <input type="date" id="dataEntrega" required>
</div>
<div class="field">
  <label>O que você irá oferecer como brinde?</label>
  <div class="checkbox-group" id="itensContainer">
    <label class="checkbox-option"><input type="checkbox" value="Moleskine"><span class="checkbox-custom"></span><span>Moleskine</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Bloco de notas"><span class="checkbox-custom"></span><span>Bloco de notas</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Camiseta"><span class="checkbox-custom"></span><span>Camiseta</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Caneta"><span class="checkbox-custom"></span><span>Caneta</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Cartão presente"><span class="checkbox-custom"></span><span>Cartão presente</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Carteira"><span class="checkbox-custom"></span><span>Carteira</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Copo de café"><span class="checkbox-custom"></span><span>Copo de café</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Garrafa"><span class="checkbox-custom"></span><span>Garrafa</span></label>
    <label class="checkbox-option"><input type="checkbox" value="Lápis"><span class="checkbox-custom"></span><span>Lápis</span></label>
    <label class="checkbox-option" id="outroCheck">
      <input type="checkbox" value="Outro" onchange="toggleOutroBrinde(this)">
      <span class="checkbox-custom"></span><span>Outro</span>
    </label>
  </div>
  <div id="outroBrindeField" style="display:none;margin-top:8px">
    <input type="text" id="outroBrinde" placeholder="Descreva o brinde">
  </div>
</div>
<div class="field">
  <label>Caso haja cartão presente, o que será escrito nele? (opcional)</label>
  <textarea id="textoCartaoPresente" placeholder="Texto para o cartão presente..."></textarea>
</div>
<div class="field">
  <label>Há alguma personalização necessária, ou serão os produtos tradicionais da Store SVN?</label>
  <textarea id="personalizacao" placeholder="Descreva se há personalização..."></textarea>
</div>
<div class="field">
  <label>Arquivos de apoio (opcional)</label>
  <div class="file-input-wrapper">
    <label class="file-input-btn" for="arquivoApoio">Escolher arquivo</label>
    <input type="file" id="arquivoApoio">
    <div class="file-name" id="arquivoApoioName"></div>
  </div>
  <div class="field-hint">
    Caso não consiga, envie para:
    <a href="mailto:gabriela.franca@elevationsvn.com.br">gabriela.franca@elevationsvn.com.br</a>
  </div>
</div>
```

```js
function toggleOutroBrinde(cb) {
  document.getElementById('outroBrindeField').style.display =
    cb.checked ? 'block' : 'none';
}
```

---

### 4c. `form-patrocinio.html`

**2 steps. Vai ao ClickUp (lista Patrocínios).**

**Dica (step 1):**
```html
<div class="alert-card alert-warning">
  <div class="alert-text">
    A solicitação de patrocínio deve ser feita com o mínimo de 30 dias de
    antecedência, pois dependemos do prazo do jurídico para confecção dos
    contratos, além dos prazos de gráficas para produção dos materiais.
  </div>
</div>
```

**Step 1 — campos:**
```html
<div class="field">
  <label>Setor <span style="color:var(--ruby-red)">*</span></label>
  <select id="setor" required>...</select>
</div>
<div class="field">
  <label>Título do evento patrocinado</label>
  <input type="text" id="tituloEvento" required>
</div>
<div class="field">
  <label>Qual ou quais serão as marcas parceiras neste patrocínio?</label>
  <input type="text" id="marcasParceiras" required>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <div class="field">
    <label>Data do evento</label>
    <input type="date" id="dataEvento" required>
  </div>
  <div class="field">
    <label>Horário</label>
    <input type="time" id="horario" required>
  </div>
</div>
<div class="field">
  <label>É horário de Brasília?</label>
  <div class="radio-group" style="flex-direction:row;gap:16px">
    <label class="radio-option"><input type="radio" name="horBrasilia" value="sim" required><span class="radio-custom"></span><span>Sim</span></label>
    <label class="radio-option"><input type="radio" name="horBrasilia" value="nao"><span class="radio-custom"></span><span>Não</span></label>
  </div>
</div>
<div class="field">
  <label>Local (nome e endereço)</label>
  <textarea id="local" placeholder="Nome do local e endereço completo" required></textarea>
</div>
<div class="field">
  <label>Tipo de evento</label>
  <select id="tipoEvento" required>
    <option value="">Selecione</option>
    <option>Almoço</option><option>Jantar</option><option>Esportivo</option>
    <option>Corporativo</option><option>Feira</option><option>Beneficente</option>
    <option>Escolar</option><option>Universitário</option>
  </select>
</div>
<div class="field">
  <label>O evento será aberto ou fechado?</label>
  <select id="publico" required>
    <option value="">Selecione</option>
    <option value="aberto">Será aberto ao público em geral</option>
    <option value="fechado">Será fechado para convidados</option>
  </select>
</div>
<div class="field">
  <label>Explique a ideia do patrocínio</label>
  <textarea id="explicacao" placeholder="Descreva a proposta e objetivos..." required></textarea>
</div>

<!-- Seleção de materiais — igual ao step 3 do form de eventos (ITENS_MATERIAIS) -->
<h3 style="font-weight:600;font-size:0.95rem;margin:16px 0 12px">
  Clique nas opções que fazem parte da solicitação para esse patrocínio:
</h3>
<div id="materiaisContainer"></div>

<div class="field" style="margin-top:16px">
  <label>Mídia kit ou proposta de patrocínio (opcional)</label>
  <div class="file-input-wrapper">
    <label class="file-input-btn" for="midiaKit">Escolher arquivo</label>
    <input type="file" id="midiaKit">
    <div class="file-name" id="midiaKitName"></div>
  </div>
</div>
<div class="field">
  <label>Arquivos de apoio — logos dos parceiros (opcional)</label>
  <div class="file-input-wrapper">
    <label class="file-input-btn" for="arquivoApoio">Escolher arquivo</label>
    <input type="file" id="arquivoApoio">
    <div class="file-name" id="arquivoApoioName"></div>
  </div>
</div>
```

**Step 2 — campos financeiros:**
```html
<h2 style="font-weight:600;font-size:1.1rem;margin-bottom:20px">Informações financeiras</h2>
<div class="field">
  <label>Centro de custo</label>
  <input type="text" id="centroCusto" placeholder="Centro de custo" required>
</div>
<div class="field">
  <label>Valor da cota de patrocínio</label>
  <input type="text" id="valorCota" placeholder="R$ 0,00" required>
</div>
<div class="field">
  <label>Orçamento total (incluindo patrocínio e materiais extras)</label>
  <input type="text" id="orcamentoTotal" placeholder="R$ 0,00"
    oninput="mascaraMoeda(this)" required>
</div>
<div class="field">
  <label>Expectativa de retorno em Delta de Receita</label>
  <input type="text" id="expectativaRetorno" placeholder="Ex: R$ 50.000" required>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
  <div class="field">
    <label>Orçamento por pessoa para alimentação</label>
    <input type="text" id="orcAlimentacao" placeholder="R$ 0,00"
      oninput="mascaraMoeda(this)">
  </div>
  <div class="field">
    <label>Orçamento para material gráfico</label>
    <input type="text" id="orcGrafico" placeholder="R$ 0,00"
      oninput="mascaraMoeda(this)">
  </div>
  <div class="field">
    <label>Orçamento para brindes</label>
    <input type="text" id="orcBrindes" placeholder="R$ 0,00"
      oninput="mascaraMoeda(this)">
  </div>
  <div class="field">
    <label>Orçamento para equipe staff</label>
    <input type="text" id="orcStaff" placeholder="R$ 0,00"
      oninput="mascaraMoeda(this)">
  </div>
</div>
```

Adicionar `mascaraMoeda` ao `utils.js`:
```js
function mascaraMoeda(el) {
  let v = el.value.replace(/\D/g, '');
  const num = parseInt(v) || 0;
  el.value = (num / 100).toLocaleString('pt-BR', {
    style: 'currency', currency: 'BRL'
  });
}
```

---

### 4d. `form-email-marketing.html`

**1 step. Vai ao ClickUp (lista Geral, ASSIGNEE_GERAL, 3 dias úteis).**

**Dica:**
```html
<div class="alert-card alert-info">
  <div class="alert-text">
    O prazo mínimo para a produção de um e-mail marketing é de 3 dias úteis.
  </div>
</div>
```

**Campos:**
```html
<div class="field">
  <label>Setor <span style="color:var(--ruby-red)">*</span></label>
  <select id="setor" required>...</select>
</div>
<div class="field">
  <label>Assunto do e-mail que quer produzir</label>
  <input type="text" id="assunto" placeholder="Assunto do e-mail" required>
</div>
<div class="field">
  <label>Explique sua finalidade com o e-mail que quer enviar</label>
  <textarea id="finalidade" placeholder="Para que serve esse e-mail?" required></textarea>
</div>
<div class="field">
  <label>Qual o tema e um breve resumo do conteúdo abordado?</label>
  <textarea id="tema" placeholder="Tema e resumo do conteúdo..." required></textarea>
</div>
<div class="field">
  <label>Qual a data esperada para o disparo do e-mail?</label>
  <input type="date" id="dataDisparo" required>
</div>
<div class="field">
  <label>Base para disparo (opcional)</label>
  <div class="file-input-wrapper">
    <label class="file-input-btn" for="baseDisparo">
      Escolher arquivo (.xlsx, .csv)
    </label>
    <input type="file" id="baseDisparo" accept=".xlsx,.csv,.xls">
    <div class="file-name" id="baseDisparoName"></div>
  </div>
</div>
<div class="field">
  <label>Quem irá assinar o e-mail? (nome, cargo e e-mail)</label>
  <input type="text" id="assinaturaEmail"
    placeholder="Ex: João Silva, Assessor de Investimentos, joao@svninvest.com.br"
    required>
</div>
```

---

### 4e. `form-producao-audiovisual.html`

**2 steps. Step 1: escolha Vídeo ou Fotos. Step 2: campos específicos.**
**Ambos vão ao ClickUp (lista Geral, ASSIGNEE_GERAL, 7 dias úteis).**

**Step 1 — dica geral + seleção:**
```html
<div class="alert-card alert-info" style="margin-bottom:20px">
  <div class="alert-text">
    Esta é a página oficial de solicitação de produção audiovisual.
    Preencha todas as informações solicitadas para que sua demanda seja
    analisada com agilidade e clareza.<br><br>
    <strong>Atenção:</strong> o preenchimento deste formulário representa
    um pedido de produção, e não uma garantia de que será realizado.
    Após o envio, a equipe de Produção Visual irá analisar sua solicitação
    levando em consideração critérios técnicos, estratégicos e de
    disponibilidade. Você será notificado(a) por e-mail sobre o status,
    que poderá ser aprovado ou recusado.<br><br>
    Para captação audiovisual em eventos, utilize o formulário de Eventos
    ou Patrocínios. <strong>Solicitações de eventos enviadas por aqui
    não serão executadas.</strong>
  </div>
</div>

<div class="radio-cards">
  <div class="radio-card" onclick="selectModalidade('video')" id="cardVideo">
    <div class="card-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.5">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    </div>
    <div class="card-label">Produção de Vídeo</div>
    <div class="card-desc">Prazo mínimo: 7 dias úteis</div>
  </div>
  <div class="radio-card" onclick="selectModalidade('fotos')" id="cardFotos">
    <div class="card-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>
    <div class="card-label">Sessão de Fotos</div>
    <div class="card-desc">Prazo mínimo: 7 dias úteis</div>
  </div>
</div>
```

**Step 2 — campos Vídeo (visíveis quando modalidade === 'video'):**
```html
<div id="camposVideo">
  <div class="field">
    <label>Setor <span style="color:var(--ruby-red)">*</span></label>
    <select id="setor" required>...</select>
  </div>
  <div class="field">
    <label>Título do material</label>
    <input type="text" id="titulo" placeholder="Título do vídeo" required>
  </div>
  <div class="field">
    <label>Qual a ideia do vídeo?</label>
    <textarea id="ideia" placeholder="Descreva a ideia..." required></textarea>
  </div>
  <div class="field">
    <label>Formato</label>
    <div class="checkbox-group" id="formatoVideo">
      <label class="checkbox-option"><input type="checkbox" value="Feed do Instagram"><span class="checkbox-custom"></span><span>Feed do Instagram</span></label>
      <label class="checkbox-option"><input type="checkbox" value="LinkedIn"><span class="checkbox-custom"></span><span>LinkedIn</span></label>
      <label class="checkbox-option"><input type="checkbox" value="Stories"><span class="checkbox-custom"></span><span>Stories</span></label>
      <label class="checkbox-option"><input type="checkbox" value="WhatsApp"><span class="checkbox-custom"></span><span>WhatsApp</span></label>
      <label class="checkbox-option"><input type="checkbox" value="Sharepoint"><span class="checkbox-custom"></span><span>Sharepoint</span></label>
      <label class="checkbox-option"><input type="checkbox" value="Telão de evento"><span class="checkbox-custom"></span><span>Telão de evento</span></label>
      <label class="checkbox-option"><input type="checkbox" value="Painel de Led"><span class="checkbox-custom"></span><span>Painel de Led</span></label>
      <label class="checkbox-option"><input type="checkbox" value="Televisão"><span class="checkbox-custom"></span><span>Televisão</span></label>
      <label class="checkbox-option">
        <input type="checkbox" value="Outro" onchange="toggleOutroFormato(this)">
        <span class="checkbox-custom"></span><span>Outro</span>
      </label>
    </div>
    <div id="outroFormatoField" style="display:none;margin-top:8px">
      <input type="text" id="outroFormato" placeholder="Descreva o formato">
    </div>
  </div>
  <div class="field">
    <label>Tem algo que não pode estar no vídeo de forma alguma? (opcional)</label>
    <input type="text" id="restricoes" placeholder="Restrições de conteúdo...">
  </div>
  <div class="field">
    <label>Arquivos de apoio (opcional)</label>
    <div class="file-input-wrapper">
      <label class="file-input-btn" for="arquivoApoio">Escolher arquivo</label>
      <input type="file" id="arquivoApoio">
      <div class="file-name" id="arquivoApoioName"></div>
    </div>
  </div>
</div>
```

**Step 2 — campos Fotos (visíveis quando modalidade === 'fotos'):**
```html
<div id="camposFotos" style="display:none">
  <!-- setor já está em camposVideo, reaproveitado -->
  <div class="field">
    <label>Título da sessão de fotos</label>
    <input type="text" id="tituloFotos"
      placeholder="Ex: fotos corporativas de colaboradores, captação em eventos"
      required>
  </div>
  <div class="field">
    <label>Descreva o conteúdo da sessão</label>
    <textarea id="descricaoFotos" placeholder="Descreva o que será fotografado..." required></textarea>
  </div>
</div>
```

```js
let _modalidade = null;

function selectModalidade(m) {
  _modalidade = m;
  document.getElementById('cardVideo').className =
    'radio-card' + (m === 'video' ? ' selected' : '');
  document.getElementById('cardFotos').className =
    'radio-card' + (m === 'fotos' ? ' selected' : '');
  document.getElementById('btnNext1').disabled = false;
}

function goToStep2() {
  document.getElementById('step1').classList.remove('active');
  document.getElementById('step2').classList.add('active');
  document.getElementById('progressBar').style.width = '100%';
  document.getElementById('camposVideo').style.display =
    _modalidade === 'video' ? 'block' : 'none';
  document.getElementById('camposFotos').style.display =
    _modalidade === 'fotos' ? 'block' : 'none';
  window.scrollTo(0, 0);
}

// No submitForm():
// tipo_solicitacao = _modalidade === 'video' ? 'producao-video' : 'sessao-fotos'
```

---

### 4f. `form-materiais-impressos.html`

**Layout split (como form-eventos): form principal à esquerda + painel de preview à direita.**
**1 step principal. Vai ao ClickUp (lista Geral, ASSIGNEE_GERAL, 5 dias úteis).**

**Seleção de tipo — radio único (só 1 seleção):**

O padrão visual dos radio buttons segue o print enviado:
cada opção em uma linha larga com radio à esquerda, estilo pill selecionável.
Quando selecionado, a opção fica com fundo escuro (carbon-black) e texto branco.

```html
<div class="form-split">
  <div class="form-main">
    <div class="form-card">
      <!-- progress bar + header -->

      <div class="field">
        <label>Setor <span style="color:var(--ruby-red)">*</span></label>
        <select id="setor" required>...</select>
      </div>

      <div class="field">
        <label style="margin-bottom:12px">
          Qual tipo de material você quer produzir?
        </label>
        <div id="tipoMaterialContainer" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <!-- Gerado por JS: renderTiposMaterial() -->
        </div>
      </div>

      <!-- Campos condicionais por tipo -->
      <div id="camposCondicionais" style="margin-top:20px"></div>

      <!-- Submit -->
    </div>
  </div>

  <!-- Painel lateral de preview -->
  <div class="form-sidebar">
    <div class="preview-panel" id="previewPainel">
      <div id="previewIcone" style="margin-bottom:12px;display:flex;justify-content:center"></div>
      <div id="previewTitulo" style="font-weight:700;font-size:0.95rem;margin-bottom:8px"></div>
      <div id="previewDicas" style="font-size:0.82rem;opacity:0.6;line-height:1.6"></div>
    </div>
  </div>
</div>
```

**Tipos de material e seus campos condicionais:**

```js
const TIPOS_IMPRESSOS = [
  { id: 'documento',         label: 'Documento' },
  { id: 'flyer-institucional',label: 'Flyer Institucional' },
  { id: 'flyer-personalizado',label: 'Flyer Personalizado' },
  { id: 'carta',             label: 'Carta' },
  { id: 'banner',            label: 'Banner' },
  { id: 'adesivo',           label: 'Adesivo' },
  { id: 'bloco-notas',       label: 'Bloco de Notas' },
  { id: 'camiseta',          label: 'Camiseta' },
  { id: 'outro-impresso',    label: 'Outro material impresso' },
];
```

**Preview lateral — ícones e dicas por tipo:**

```js
const PREVIEW_IMPRESSOS = {
  'documento': {
    icone: (fmt, ori) => `<!-- SVG de retângulo proporcional ao formato/orientação -->`,
    titulo: (fmt, ori) => `Documento — ${fmt || 'A4'} — ${ori || 'Horizontal'}`,
    dicas: (fmt, ori) => `Sugestão: ${fmt || 'A4'} • Ideal para comunicados. • ${ori || 'Deitado'}`,
  },
  'flyer-personalizado': {
    icone: () => `<!-- SVG de folha com dobra -->`,
    titulo: (fmt, ori) => `Flyer — ${fmt || 'A5'} — ${ori || 'Vertical'}`,
    dicas: () => 'Sugestão: A5 • Ideal para divulgação. • Vertical',
  },
  'banner': {
    icone: (_, ori) => `<!-- SVG de banner, orientação dinâmica -->`,
    titulo: (tam, ori) => `Banner — ${ori || 'Vertical'}`,
    dicas: () => 'Sugestão: Vertical • Ideal para displays em pé.',
  },
  'adesivo': {
    icone: (tipo) => `<!-- SVG quadrado ou círculo conforme tipo -->`,
    titulo: (tipo) => `Adesivo — ${tipo || 'Quadrado'}`,
    dicas: () => 'Defina o tipo e tamanho para personalizar.',
  },
  'camiseta': {
    icone: (cor) => `<!-- SVG de camiseta preenchida com a cor selecionada -->`,
    titulo: (tipo, cor) => `Camiseta — ${tipo || 'T-shirt'} — ${cor || 'Branco'}`,
    dicas: () => 'A cor do ícone será atualizada conforme sua seleção.',
  },
  // ... outros tipos com dicas genéricas
};

// Cores para o ícone de camiseta:
const CORES_CAMISETA = {
  'Branco':       '#FFFFFF', 'Preto':        '#221B19',
  'Azul':         '#1e40af', 'Vermelho':      '#dc2626',
  'Amarelo':      '#eab308', 'Laranja':       '#ea580c',
  'Roxo':         '#7c3aed', 'Multicolorida': 'linear-gradient(...)',
  'Outro':        '#9ca3af',
};
```

**Função de atualização do preview:**

```js
function atualizarPreview() {
  const tipo = window._tipoMaterial;
  if (!tipo || !PREVIEW_IMPRESSOS[tipo]) {
    // Estado vazio — mostrar placeholder
    document.getElementById('previewTitulo').textContent = 'Selecione um tipo de material';
    document.getElementById('previewDicas').textContent = 'As informações do material aparecerão aqui.';
    document.getElementById('previewIcone').innerHTML = '';
    return;
  }

  const preview = PREVIEW_IMPRESSOS[tipo];
  // Coletar valores atuais dos campos condicionais
  const fmt  = document.getElementById('formatoPapel')?.value ||
               document.querySelector('input[name="formatoPapel"]:checked')?.value || '';
  const ori  = document.querySelector('input[name="orientacao"]:checked')?.value || '';
  const cor  = document.querySelector('input[name="corCamiseta"]:checked')?.value || '';
  const tipoSub = document.querySelector('input[name="tipoAdesivo"]:checked')?.value ||
                  document.querySelector('input[name="tipoCamiseta"]:checked')?.value || '';

  document.getElementById('previewIcone').innerHTML = preview.icone(fmt || tipoSub || cor, ori);
  document.getElementById('previewTitulo').textContent = preview.titulo(fmt || tipoSub, ori || cor);
  document.getElementById('previewDicas').textContent = preview.dicas(fmt, ori);
}
```

**Campos condicionais por tipo — gerados por renderCamposCondicionais(tipo):**

```js
function renderCamposCondicionais(tipo) {
  const container = document.getElementById('camposCondicionais');
  // Limpar campos anteriores
  container.innerHTML = '';
  window._tipoMaterial = tipo;
  atualizarPreview();

  switch (tipo) {
    case 'documento':
    case 'carta':
      container.innerHTML = `
        <div class="field">
          <label>Formato do papel</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${radioRecomendado('formatoPapel','A4','A4',true)}
            ${radioSimples('formatoPapel','A5','A5')}
            ${radioSimples('formatoPapel','outro-papel','Outro')}
          </div>
          <div id="outroPapelField" style="display:none;margin-top:8px">
            <input type="text" id="outroPapel" placeholder="Ex.: 10x15cm, 20x20cm">
          </div>
        </div>
        <div class="field">
          <label>Orientação</label>
          <div style="display:flex;gap:8px">
            ${radioSimples('orientacao','horizontal','Horizontal')}
            ${radioRecomendado('orientacao','vertical','Vertical',true)}
          </div>
        </div>
        <div class="field">
          <label>Descrição da solicitação</label>
          <input type="text" id="descricaoSolicitacao" placeholder="Descreva a solicitação" required>
        </div>
        <div class="field">
          <label>Conteúdo do documento</label>
          <textarea id="conteudoMaterial" placeholder="Descreva o conteúdo..." required></textarea>
        </div>
        <div class="field">
          <label>Arquivos de apoio (opcional)</label>
          ${uploadField('arquivoApoio','arquivoApoioName')}
        </div>`;
      break;

    case 'flyer-institucional':
      container.innerHTML = `
        <div class="alert-card alert-info">
          <div class="alert-text">
            O flyer institucional segue o modelo padrão SVN.
            <a href="#" onclick="verModeloFlyer()" style="color:var(--ruby-red)">
              Ver modelo padrão
            </a>
          </div>
        </div>
        <div class="field">
          <label>Descrição da solicitação</label>
          <textarea id="conteudoMaterial" placeholder="Descreva o conteúdo..." required></textarea>
        </div>`;
      break;

    case 'flyer-personalizado':
      container.innerHTML = `
        <div class="field">
          <label>Usar o modelo padrão como base?</label>
          <div style="display:flex;gap:8px">
            ${radioSimples('baseFlyer','sim','Sim')}
            ${radioSimples('baseFlyer','nao','Não')}
          </div>
        </div>
        <div class="field">
          <label>Formato</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${radioSimples('formatoPapel','A4','A4')}
            ${radioRecomendado('formatoPapel','A5','A5',true)}
            ${radioSimples('formatoPapel','outro-papel','Outro')}
          </div>
          <div id="outroPapelField" style="display:none;margin-top:8px">
            <input type="text" id="outroPapel" placeholder="Ex.: 10x15cm">
          </div>
        </div>
        <div class="field">
          <label>Orientação</label>
          <div style="display:flex;gap:8px">
            ${radioSimples('orientacao','horizontal','Horizontal')}
            ${radioRecomendado('orientacao','vertical','Vertical',true)}
          </div>
        </div>
        <div class="field">
          <label>Qual conteúdo deve constar no material?</label>
          <div class="checkbox-group">
            <label class="checkbox-option"><input type="checkbox" value="Sobre a empresa"><span class="checkbox-custom"></span><span>Sobre a empresa</span></label>
            <label class="checkbox-option"><input type="checkbox" value="Números Institucionais"><span class="checkbox-custom"></span><span>Números Institucionais</span></label>
            <label class="checkbox-option"><input type="checkbox" value="Serviços PF"><span class="checkbox-custom"></span><span>Serviços PF</span></label>
            <label class="checkbox-option"><input type="checkbox" value="Serviços PJ"><span class="checkbox-custom"></span><span>Serviços PJ</span></label>
            <label class="checkbox-option"><input type="checkbox" value="Bio do solicitante"><span class="checkbox-custom"></span><span>Bio do solicitante</span></label>
            <label class="checkbox-option"><input type="checkbox" value="Outro"><span class="checkbox-custom"></span><span>Outro</span></label>
          </div>
        </div>
        <div class="field">
          <label>Descreva o conteúdo</label>
          <textarea id="conteudoMaterial" placeholder="Descreva o conteúdo..." required></textarea>
        </div>`;
      break;

    case 'banner':
      container.innerHTML = `
        <div class="field">
          <label>Tamanho</label>
          <input type="text" id="tamanhoBanner" placeholder="Ex.: 80x200cm, 100x200cm" required>
        </div>
        <div class="field">
          <label>Orientação</label>
          <div style="display:flex;gap:8px">
            ${radioSimples('orientacao','horizontal','Horizontal (tipo testeira)')}
            ${radioRecomendado('orientacao','vertical','Vertical',true)}
          </div>
        </div>
        <div class="field">
          <label>Descreva o conteúdo</label>
          <textarea id="conteudoMaterial" placeholder="Descreva o conteúdo..." required></textarea>
        </div>`;
      break;

    case 'adesivo':
      container.innerHTML = `
        <div class="field">
          <label>Tipo</label>
          <div style="display:flex;gap:8px">
            ${radioSimples('tipoAdesivo','quadrado','Quadrado')}
            ${radioSimples('tipoAdesivo','redondo','Redondo')}
          </div>
        </div>
        <div class="field">
          <label>Tamanho</label>
          <input type="text" id="tamanhoAdesivo" placeholder="Ex.: 5x5cm, 10cm diâmetro" required>
        </div>
        <div class="field">
          <label>Descreva o conteúdo</label>
          <textarea id="conteudoMaterial" placeholder="Descreva o conteúdo..." required></textarea>
        </div>`;
      break;

    case 'bloco-notas':
      container.innerHTML = `
        <div class="field">
          <label>Descreva o conteúdo</label>
          <textarea id="conteudoMaterial" placeholder="Descreva o que deve constar no bloco..." required></textarea>
        </div>
        <div class="field">
          <label>Arquivos de apoio (opcional)</label>
          ${uploadField('arquivoApoio','arquivoApoioName')}
        </div>`;
      break;

    case 'camiseta':
      container.innerHTML = `
        <div class="field">
          <label>Tipo de camiseta</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${radioSimples('tipoCamiseta','polo','Polo')}
            ${radioSimples('tipoCamiseta','dryfit','DryFit')}
            ${radioSimples('tipoCamiseta','tshirt','T-shirt (Algodão)')}
          </div>
        </div>
        <div class="field">
          <label>Cor</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap" id="coresCamiseta">
            ${['Branco','Preto','Azul','Vermelho','Amarelo','Laranja','Roxo','Multicolorida','Outro']
              .map(cor => radioSimples('corCamiseta', cor.toLowerCase(), cor)).join('')}
          </div>
        </div>
        <div class="field">
          <label>Descreva o visual esperado da camiseta</label>
          <textarea id="conteudoMaterial"
            placeholder="Ex.: logo na frente, frase nas costas, etc." required></textarea>
        </div>
        <div class="field">
          <label>Quantidade e tamanhos (opcional)</label>
          <textarea id="qtdTamanhos"
            placeholder="Ex.: 10 un G, 20 un P, etc."></textarea>
        </div>
        <div class="field">
          <label>Fornecedor de preferência (opcional)</label>
          <input type="text" id="fornecedor" placeholder="Nome do fornecedor">
        </div>`;
      break;

    case 'outro-impresso':
      container.innerHTML = `
        <div class="field">
          <label>Descreva o material</label>
          <textarea id="conteudoMaterial"
            placeholder="Descreva o material impresso que precisa..." required></textarea>
        </div>
        <div class="field">
          <label>Arquivos de apoio (opcional)</label>
          ${uploadField('arquivoApoio','arquivoApoioName')}
        </div>`;
      break;
  }

  // Adicionar listeners para atualizar o preview dinamicamente
  container.querySelectorAll('input[type="radio"], select, input[type="text"]')
    .forEach(el => el.addEventListener('change', atualizarPreview));

  // Re-bind file uploads
  if (document.getElementById('arquivoApoio')) {
    FileUpload.bind('arquivoApoio', 'arquivoApoioName');
  }
}

// Helpers para radio buttons com tag "Recomendado":
function radioRecomendado(name, value, label, recomendado) {
  return `<label class="radio-option" style="padding:8px 14px;border:1.5px solid var(--border-light);
    border-radius:999px;background:var(--card-white);cursor:pointer;transition:0.15s"
    onmouseover="this.style.borderColor='var(--ruby-red)'"
    onmouseout="if(!this.querySelector('input').checked)this.style.borderColor='var(--border-light)'">
    <input type="radio" name="${name}" value="${value}" style="display:none"
      onchange="atualizarPreview();this.closest('label').style.borderColor='var(--carbon-black)';
        this.closest('label').style.background='var(--carbon-black)';
        this.closest('label').querySelector('.radio-label').style.color='white'">
    <span class="radio-label" style="font-size:0.85rem;font-weight:600">${label}</span>
    ${recomendado ? `<span style="margin-left:8px;background:rgba(34,27,25,0.1);
      border-radius:999px;padding:2px 8px;font-size:0.68rem;font-weight:700">
      Recomendado</span>` : ''}
  </label>`;
}

function radioSimples(name, value, label) {
  return radioRecomendado(name, value, label, false);
}

function uploadField(inputId, nameId) {
  return `<div class="file-input-wrapper">
    <label class="file-input-btn" for="${inputId}">Escolher arquivo</label>
    <input type="file" id="${inputId}">
    <div class="file-name" id="${nameId}"></div>
  </div>`;
}
```

---

## 5. Dashboard — Nova aba de log (item 1 das novas mudanças)

### 5a. Adicionar aba "Log" em `dashboard.html`

```html
<!-- No bloco de .tabs, após #tabAdmin: -->
<button class="tab" data-tab="log" id="tabLog"
  onclick="switchTab('log')"
  style="display:none;align-items:center;gap:6px">
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" style="flex-shrink:0">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
  Log de atividade
</button>
```

```html
<!-- Conteúdo da aba log: -->
<div class="tab-content" id="tab-log" style="display:none">
  <div style="display:flex;align-items:center;justify-content:space-between;
    margin-bottom:16px;flex-wrap:wrap;gap:8px">
    <p style="font-size:0.8rem;opacity:0.5;margin:0">
      Registro de todas as solicitações criadas no hub.
      Útil para acompanhar integrações e identificar problemas.
    </p>
    <button onclick="exportarLog()"
      style="padding:5px 14px;border-radius:8px;border:1px solid var(--border-light);
             background:var(--card-white);font-family:'Nunito Sans',sans-serif;
             font-size:0.8rem;font-weight:600;cursor:pointer">
      Exportar CSV
    </button>
  </div>

  <!-- Filtros do log -->
  <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center">
    <div class="search-bar" style="flex:1;max-width:240px;margin-bottom:0;
      height:32px;padding:0 14px;border-radius:8px">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" opacity="0.4">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input type="text" id="logBusca" placeholder="Buscar por e-mail, tipo..."
        oninput="debounceLogSearch()">
    </div>
    <select id="logFiltroTipo" onchange="loadLog()"
      style="height:32px;border:1px solid var(--border-light);border-radius:8px;
             padding:0 10px;font-family:'Nunito Sans',sans-serif;font-size:0.8rem">
      <option value="">Todos os tipos</option>
      <!-- Preenchido dinamicamente com TIPO_SOLICITACAO_LABELS -->
    </select>
    <select id="logFiltroClickup" onchange="loadLog()"
      style="height:32px;border:1px solid var(--border-light);border-radius:8px;
             padding:0 10px;font-family:'Nunito Sans',sans-serif;font-size:0.8rem">
      <option value="">ClickUp: todos</option>
      <option value="com">Com task ClickUp</option>
      <option value="sem">Sem task ClickUp</option>
    </select>
  </div>

  <!-- Tabela de log -->
  <div style="border-radius:12px;border:1px solid var(--border-light);
    overflow:hidden;position:relative">
    <table style="width:100%;border-collapse:collapse;font-size:0.82rem;
      table-layout:fixed" id="logTabela">
      <colgroup>
        <col style="width:100px"> <!-- Data/hora -->
        <col style="width:120px"> <!-- Solicitante -->
        <col style="width:auto">  <!-- Tipo -->
        <col style="width:80px">  <!-- Status -->
        <col style="width:100px"> <!-- ClickUp -->
      </colgroup>
      <thead>
        <tr style="background:var(--carbon-black)">
          <th style="padding:10px 14px;font-weight:700;font-size:0.72rem;
            text-transform:uppercase;letter-spacing:0.06em;
            color:rgba(255,255,255,0.7);text-align:left">Data/Hora</th>
          <th style="padding:10px 14px;font-weight:700;font-size:0.72rem;
            text-transform:uppercase;letter-spacing:0.06em;
            color:rgba(255,255,255,0.7);text-align:left">Solicitante</th>
          <th style="padding:10px 14px;font-weight:700;font-size:0.72rem;
            text-transform:uppercase;letter-spacing:0.06em;
            color:rgba(255,255,255,0.7);text-align:left">Tipo</th>
          <th style="padding:10px 14px;font-weight:700;font-size:0.72rem;
            text-transform:uppercase;letter-spacing:0.06em;
            color:rgba(255,255,255,0.7);text-align:left">Status</th>
          <th style="padding:10px 14px;font-weight:700;font-size:0.72rem;
            text-transform:uppercase;letter-spacing:0.06em;
            color:rgba(255,255,255,0.7);text-align:left">ClickUp</th>
        </tr>
      </thead>
      <tbody id="logTabelaBody">
        <tr><td colspan="5" style="padding:24px;text-align:center;opacity:0.4">
          Carregando...
        </td></tr>
      </tbody>
    </table>
  </div>
  <div class="pagination" id="logPaginacao" style="margin-top:12px"></div>
</div>
```

### 5b. JS para o log em `dashboard.html`

```js
// Variáveis de estado do log:
let logPage = 1;
let logSearchTimeout;

function initLog() {
  // Popular select de tipos
  const sel = document.getElementById('logFiltroTipo');
  if (sel && typeof TIPO_SOLICITACAO_LABELS !== 'undefined') {
    Object.entries(TIPO_SOLICITACAO_LABELS).forEach(([id, label]) => {
      const o = document.createElement('option');
      o.value = id; o.textContent = label;
      sel.appendChild(o);
    });
  }
}

async function loadLog() {
  const tbody = document.getElementById('logTabelaBody');
  tbody.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;
    opacity:0.4">Carregando...</td></tr>`;

  const params = new URLSearchParams();
  params.set('page', logPage);
  params.set('limit', '30');
  params.set('order', 'created_at');
  params.set('dir', 'desc');

  const busca = document.getElementById('logBusca')?.value?.trim();
  if (busca) params.set('busca', busca);

  const tipo = document.getElementById('logFiltroTipo')?.value;
  if (tipo) params.set('tipos', tipo);

  const clickup = document.getElementById('logFiltroClickup')?.value;
  if (clickup === 'com') params.set('com_clickup', 'sim');
  if (clickup === 'sem') params.set('sem_clickup', 'sim');

  try {
    const res = await fetch('/api/admin/historico?' + params.toString());
    const data = await res.json();
    renderLog(data);
  } catch {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:24px;text-align:center;
      color:var(--ruby-red)">Erro ao carregar log.</td></tr>`;
  }
}

function renderLog(data) {
  const tbody = document.getElementById('logTabelaBody');
  if (!data.data || data.data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding:24px;
      text-align:center;opacity:0.4">Nenhum registro encontrado.</td></tr>`;
    document.getElementById('logPaginacao').innerHTML = '';
    return;
  }

  tbody.innerHTML = data.data.map(item => {
    const dt = new Date(item.created_at);
    const data_fmt = dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit' });
    const hora_fmt = dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
    const tipoLabel = (typeof TIPO_SOLICITACAO_LABELS !== 'undefined' &&
      TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao]) || item.tipo_solicitacao;
    const statusObj = STATUS_SOLICITACAO?.find(s => s.id === item.status) ||
      { bg: '#e2e8f0', text: '#475569', label: item.status };
    const temClickup = !!item.clickup_url;

    return `<tr style="border-top:1px solid var(--border-light);transition:background 0.12s"
      onmouseover="this.style.background='var(--icon-bg)'"
      onmouseout="this.style.background=''">
      <td style="padding:8px 14px;white-space:nowrap">
        <div style="font-size:0.8rem">${data_fmt}</div>
        <div style="font-size:0.72rem;opacity:0.4">${hora_fmt}</div>
      </td>
      <td style="padding:8px 14px;overflow:hidden">
        <div style="font-size:0.82rem;font-weight:600;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis"
          title="${esc(item.user_email || '')}">
          ${esc(item.user_email?.split('@')[0] || '—')}
        </div>
      </td>
      <td style="padding:8px 14px;overflow:hidden">
        <div style="font-size:0.78rem;white-space:nowrap;overflow:hidden;
          text-overflow:ellipsis" title="${esc(tipoLabel)}">
          ${esc(tipoLabel)}
        </div>
      </td>
      <td style="padding:8px 14px">
        <span style="display:inline-block;padding:3px 8px;border-radius:999px;
          font-size:0.7rem;font-weight:700;background:${statusObj.bg};
          color:${statusObj.text}">
          ${esc(statusObj.label)}
        </span>
      </td>
      <td style="padding:8px 14px;text-align:center">
        ${temClickup
          ? `<a href="${esc(item.clickup_url)}" target="_blank"
               style="display:inline-flex;align-items:center;gap:4px;
                      color:#7c3aed;font-size:0.75rem;font-weight:600;
                      text-decoration:none">${CLICKUP_ICON} Task</a>`
          : `<span style="font-size:0.75rem;opacity:0.3">—</span>`
        }
      </td>
    </tr>`;
  }).join('');

  // Paginação
  const pag = document.getElementById('logPaginacao');
  if (data.totalPages <= 1) { pag.innerHTML = ''; return; }
  let html = `<button ${data.page <= 1 ? 'disabled' : ''} onclick="logGoPage(${data.page-1})">&laquo;</button>`;
  for (let i = Math.max(1, data.page-2); i <= Math.min(data.totalPages, data.page+2); i++) {
    html += `<button class="${i === data.page ? 'active' : ''}" onclick="logGoPage(${i})">${i}</button>`;
  }
  html += `<button ${data.page >= data.totalPages ? 'disabled' : ''} onclick="logGoPage(${data.page+1})">&raquo;</button>`;
  pag.innerHTML = html;
}

function logGoPage(page) {
  logPage = page;
  loadLog();
}

function debounceLogSearch() {
  clearTimeout(logSearchTimeout);
  logSearchTimeout = setTimeout(() => { logPage = 1; loadLog(); }, 300);
}

function exportarLog() {
  // Buscar todos os dados sem paginação e gerar CSV
  fetch('/api/admin/historico?limit=1000&order=created_at&dir=desc')
    .then(r => r.json())
    .then(data => {
      if (!data.data) return;
      const headers = ['Data', 'Hora', 'Solicitante', 'E-mail', 'Tipo', 'Status', 'ClickUp URL'];
      const rows = data.data.map(item => {
        const dt = new Date(item.created_at);
        const tipoLabel = (typeof TIPO_SOLICITACAO_LABELS !== 'undefined' &&
          TIPO_SOLICITACAO_LABELS[item.tipo_solicitacao]) || item.tipo_solicitacao;
        return [
          dt.toLocaleDateString('pt-BR'),
          dt.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
          item.user_email?.split('@')[0] || '',
          item.user_email || '',
          tipoLabel,
          item.status,
          item.clickup_url || '',
        ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
      });
      const csv = [headers.join(','), ...rows].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'log-hub-svn-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
    })
    .catch(() => alert('Erro ao exportar.'));
}
```

### 5c. Atualizar `initAdmin()` e `switchTab()` para incluir o log:

```js
function initAdmin() {
  if (!Auth.isAdmin()) return;
  document.getElementById('tabAdmin').style.display = '';
  document.getElementById('tabLog').style.display = ''; // ← ADICIONAR
  initLog(); // ← ADICIONAR
  renderDropdownTipos();
  // ... resto existente
}

// Em switchTab(), adicionar case para 'log':
if (tab === 'log') {
  logPage = 1;
  loadLog();
}
```

### 5d. `forms.ts` — Adicionar filtros de ClickUp no endpoint /admin/historico

```ts
// No endpoint GET /admin/historico, adicionar suporte aos novos filtros:
if (req.query.com_clickup === 'sim') {
  conditions.push(sql`${solicitacoesTable.clickup_url} IS NOT NULL`);
}
if (req.query.sem_clickup === 'sim') {
  conditions.push(sql`${solicitacoesTable.clickup_url} IS NULL`);
}
```

---

## OBSERVAÇÕES GERAIS

- `forms.ts` e `clickup.ts` precisam de build após edições
- Novos HTMLs e `config.js` não precisam de build
- Adicionar Secrets no Replit: `CLICKUP_LIST_BRINDES=900100469662` e `CLICKUP_LIST_PATROCINIO=901324638951`
- A aba de log reutiliza o endpoint `/api/admin/historico` existente —
  zero mudança estrutural no backend, apenas 2 filtros adicionais opcionais
- O form de materiais impressos é o mais complexo — testar bem o preview
  lateral e os campos condicionais antes de subir
