# Novos forms — Ativação dos tipos "Em breve"

## VISÃO GERAL

9 novos forms. Todos salvam no banco, aparecem no dashboard, usam thankyou.html.
Setor obrigatório em todos.
- **Com integração N8N (sem ClickUp):** assinatura-email, cartao-visita-digital, cartao-boas-vindas, divulgacao-nps, convite-fp, certificado-eventos
- **Com ClickUp:** cartao-visita-fisico (próxima quarta), pagina-online (5 dias úteis), outro (7 dias úteis)

---

## 1. `config.js`

### 1a. Ativar itens em CATEGORIAS_SOLICITACAO:
```js
{ id: "assinatura-email",    ativo: true }
{ id: "cartao-visita",       ativo: true }
{ id: "cartao-boas-vindas",  ativo: true }
{ id: "divulgacao-nps",      ativo: true }
{ id: "convite-fp",          ativo: true }
{ id: "certificado-eventos", ativo: true }
{ id: "pagina-online",       ativo: true }
{ id: "outro",               ativo: true }
```

### 1b. Adicionar em FORM_ROUTES:
```js
"assinatura-email":     "form-assinatura-email.html",
"cartao-visita":        "form-cartao-visita.html",
"cartao-boas-vindas":   "form-cartao-boas-vindas.html",
"divulgacao-nps":       "form-divulgacao-nps.html",
"convite-fp":           "form-convite-fp.html",
"certificado-eventos":  "form-certificado-eventos.html",
"pagina-online":        "form-pagina-online.html",
"outro":                "form-outro.html",
```

### 1c. Adicionar em TIPO_SOLICITACAO_LABELS:
```js
"assinatura-email":      "Assinatura de E-mail",
"cartao-visita-fisico":  "Cartão de Visita — Físico",
"cartao-visita-digital": "Cartão de Visita — Digital",
"cartao-boas-vindas":    "Cartão de Boas-vindas",
"divulgacao-nps":        "Arte NPS",
"convite-fp":            "Convite Financial Planning",
"certificado-eventos":   "Certificado para Eventos",
"pagina-online":         "Página Online",
"outro":                 "Outro",
```

### 1d. Adicionar constantes:
```js
const MARCAS_SVN = [
  "SVN", "SVN Investimentos", "SVN Capital", "SVN Connect",
  "SVN Agro, Câmbio & Commodities", "SVN Gestão", "SVN Global",
  "SVN Proteção Patrimonial", "SVN Investment & Merchant Banking",
  "SVN Wealth Planning",
];

const CARGOS_ASSESSOR = [
  "Assessor de Investimentos",
  "Assessora de Investimentos",
  "Sócio e Assessor de Investimentos",
  "Sócia e Assessora de Investimentos",
];
```

### 1e. Adicionar em DRAWER_FIELD_LABELS:
```js
nomeCartao:       "Nome no cartão",
whatsapp:         "WhatsApp",
emailCorporativo: "E-mail corporativo",
marca:            "Marca",
nomeCliente:      "Nome do cliente",
isPrivate:        "Cliente Private?",
nomeAssinatura:   "Nome para assinatura",
cargo:            "Cargo",
agradecimento:    "Agradecimento",
modeloArte:       "Modelo de arte",
idEvento:         "ID do evento",
cargaHoraria:     "Carga horária",
tituloPagina:     "Título da página",
```

---

## 2. `forms.ts` — Adicionar novos tipos

### VALID_TIPOS:
```ts
"assinatura-email", "cartao-visita-fisico", "cartao-visita-digital",
"cartao-boas-vindas", "divulgacao-nps", "convite-fp",
"certificado-eventos", "pagina-online", "outro",
```

### REQUIRED_FIELDS:
```ts
"assinatura-email":      ["nome", "nomeCompleto", "telefone", "emailCorporativo", "marca"],
"cartao-visita-fisico":  ["nome", "nomeCartao", "whatsapp", "emailCorporativo", "unidade"],
"cartao-visita-digital": ["nome", "nomeCompleto", "telefone", "emailCorporativo", "marca"],
"cartao-boas-vindas":    ["nome", "nomeCliente", "nomeAssinatura", "contratoSocial", "unidade"],
"divulgacao-nps":        ["nome", "nomeAssinatura", "cargo", "agradecimento", "modeloArte"],
"convite-fp":            ["nome", "codigoAssessor", "nomeAssinatura", "cargo", "contratoSocial"],
"certificado-eventos":   ["nome", "whatsapp", "cargaHoraria"],
"pagina-online":         ["nome", "titulo", "finalidade"],
"outro":                 ["nome", "titulo", "finalidade", "descricao"],
```

---

## 3. `clickup.ts`

### 3a. Tipos sem ClickUp — retorno antecipado:
```ts
const TIPOS_SEM_CLICKUP = [
  "assinatura-email", "cartao-visita-digital", "cartao-boas-vindas",
  "divulgacao-nps", "convite-fp", "certificado-eventos",
];

// No início de createClickUpTask(), após as declarações:
if (TIPOS_SEM_CLICKUP.includes(tipo)) {
  logger.info({ tipo }, "ClickUp: tipo sem integração, pulando");
  return { taskId: null, taskName: "", responsavel: "" };
}
```

### 3b. Prazo dinâmico — próxima quarta-feira:
```ts
function proximaQuarta(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  const dow = d.getDay(); // 0=dom, 3=qua
  const diasAte = (3 - dow + 7) % 7 || 7;
  d.setDate(d.getDate() + diasAte);
  return d;
}

// No bloco de cálculo de prazo em createClickUpTask():
let prazoDate: Date;
if (tipo === "cartao-visita-fisico") {
  prazoDate = proximaQuarta();
} else {
  const diasUteis = PRAZO_DIAS_UTEIS[tipo] ?? 3;
  prazoDate = addBusinessDays(new Date(), diasUteis);
}
prazoDate.setHours(12, 0, 0, 0);
taskPayload.due_date = prazoDate.getTime();
```

### 3c. Adicionar em PRAZO_DIAS_UTEIS:
```ts
"pagina-online": 5,
"outro":         7,
// cartao-visita-fisico usa proximaQuarta() — não entra aqui
```

### 3d. Adicionar labels em REQUEST_TYPE_LABELS:
```ts
"cartao-visita-fisico": "Cartão de Visita — Físico",
"pagina-online":        "Página Online",
"outro":                "Outro",
```

---

## 4. UTILITÁRIO COMPARTILHADO — `utils.js`

Criar arquivo `utils.js` com a máscara de telefone usada em múltiplos forms:

```js
function mascaraTelefone(el) {
  let v = el.value.replace(/\D/g, '').substring(0, 11);
  if (v.length > 6) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2,7) + '-' + v.substring(7);
  } else if (v.length > 2) {
    v = '(' + v.substring(0,2) + ') ' + v.substring(2);
  } else if (v.length > 0) {
    v = '(' + v;
  }
  el.value = v;
}
```

Adicionar `<script src="utils.js"></script>` em todos os novos forms
(e nos forms existentes que usam mascaraTelefone, se não tiverem).

---

## 5. COMPONENTE WEBHOOK CONFIG (admin only)

HTML reutilizável — adicionar acima do `.form-card` em cada form com N8N:

```html
<div id="webhookConfig" style="display:none;margin-bottom:16px">
  <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;
    background:var(--icon-bg);border:1px solid var(--border-light);
    border-radius:10px;font-size:0.82rem">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
    </svg>
    <span style="opacity:0.6;flex-shrink:0;white-space:nowrap">Webhook N8N:</span>
    <input type="url" id="webhookUrl"
      placeholder="https://n8n.portalsvn.com.br/webhook/..."
      style="flex:1;border:none;background:transparent;
             font-family:'Nunito Sans',sans-serif;font-size:0.82rem;
             outline:none;min-width:0">
    <button onclick="salvarWebhook()"
      style="padding:4px 10px;border-radius:6px;background:var(--carbon-black);
             color:white;border:none;font-family:'Nunito Sans',sans-serif;
             font-size:0.75rem;font-weight:600;cursor:pointer;white-space:nowrap">
      Salvar
    </button>
  </div>
</div>
```

JS (cada form tem sua própria chave localStorage):
```js
// WEBHOOK_KEY = constante definida em cada form, ex: 'svn_webhook_assinatura'
function iniciarWebhookConfig() {
  if (!Auth.isAdmin()) return;
  document.getElementById('webhookConfig').style.display = 'block';
  const saved = localStorage.getItem(WEBHOOK_KEY);
  if (saved) document.getElementById('webhookUrl').value = saved;
}

function salvarWebhook() {
  const url = document.getElementById('webhookUrl').value.trim();
  if (url) localStorage.setItem(WEBHOOK_KEY, url);
  const btn = event.currentTarget;
  const orig = btn.textContent;
  btn.textContent = 'Salvo ✓';
  setTimeout(() => { btn.textContent = orig; }, 1500);
}
```

Chamar `iniciarWebhookConfig()` no final do `init()` de cada form.

Chaves por form:
- Assinatura e-mail: `'svn_webhook_assinatura'`
- Cartão digital: `'svn_webhook_cartao_digital'`
- Cartão boas-vindas: `'svn_webhook_boas_vindas'`
- Arte NPS: `'svn_webhook_nps'`
- Convite FP: `'svn_webhook_convite_fp'`
- Certificado: `'svn_webhook_certificado'`

---

## 6. ESTRUTURA PADRÃO DOS NOVOS FORMS HTML

Cada form segue este esqueleto (adaptar conforme campos específicos):

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[NOME DO FORM] - Hub SVN</title>
  <!-- fonts + style.css padrão -->
</head>
<body class="page-light">
  <header class="header" id="mainHeader"></header>
  <div class="container-narrow" style="padding-top:32px;padding-bottom:80px">

    <!-- Webhook config (admin only) -->
    [BLOCO WEBHOOKCONFIG se form N8N]

    <div class="form-card">
      <div class="form-progress">
        <div class="form-progress-bar" id="progressBar" style="width:100%"></div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <h2 style="font-weight:500;font-size:1.1rem;margin:0">[TÍTULO]</h2>
      </div>
      <div style="height:1px;background:var(--border-light);margin-bottom:24px"></div>

      <!-- Dica -->
      [BLOCO ALERT-CARD]

      <!-- Campos -->
      [CAMPOS]

      <!-- Submit -->
      <div style="border-top:1px solid rgba(34,27,25,.08);margin:28px 0 20px;padding-top:22px">
        <div id="submitError" class="alert-card alert-danger" style="display:none;margin-bottom:16px"></div>
        <div class="form-nav" style="justify-content:flex-end">
          <button class="btn btn-primary btn-submit-gold" id="btnSubmit" onclick="submitForm()">
            Enviar
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Botões flutuantes Menu + Início + WhatsApp (padrão do sistema) -->
  [FLOAT BUTTONS]

  <script src="utils.js"></script>
  <script src="upload-feedback.js"></script>
  <script src="config.js"></script>
  <script src="auth.js"></script>
  <script>
    const TIPO = '[tipo_solicitacao]';
    [WEBHOOK_KEY se aplicável]

    async function init() {
      await _configReady;
      await Auth.init();
      if (!Auth.isAuthenticated()) {
        window.location.href = '/auth/login?redirect=/[form].html';
        return;
      }
      Auth.renderHeader(document.getElementById('mainHeader'));

      // Popular select de setor
      const setorSel = document.getElementById('setor');
      if (setorSel) {
        SETORES.filter(s => s !== 'Selecione seu setor').forEach(s => {
          const o = document.createElement('option');
          o.value = s; o.textContent = s;
          setorSel.appendChild(o);
        });
      }

      // Popular outros selects (UNIDADES_SVN, MARCAS_SVN, CARGOS_ASSESSOR etc.)
      [POPULAR SELECTS]

      // FileUpload.bind para uploads se aplicável
      [FILE UPLOADS]

      iniciarWebhookConfig(); // apenas forms N8N
      restoreDraft();
    }

    function validateRequiredFields() { /* padrão existente */ }

    async function submitForm() {
      if (!validateRequiredFields()) return;
      const btn = document.getElementById('btnSubmit');
      btn.disabled = true; btn.textContent = 'Enviando...';

      const dados = {
        nome:  Auth.getUserName(),
        setor: document.getElementById('setor')?.value || '',
        // ... campos específicos ...
      };

      const formData = new FormData();
      formData.append('tipo_solicitacao', TIPO);
      formData.append('dados', JSON.stringify(dados));
      // Arquivos se aplicável

      try {
        const res = await fetch('/api/solicitacoes', { method: 'POST', body: formData });
        if (res.ok) {
          try {
            sessionStorage.setItem('svn_ultimo_resumo', JSON.stringify({
              tipo: TIPO_SOLICITACAO_LABELS[TIPO] || TIPO,
              solicitante: Auth.getUserName(),
              setor: dados.setor,
              data: new Date().toLocaleDateString('pt-BR'),
              hora: new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }),
            }));
          } catch {}
          window.location.href = '/thankyou.html';
        } else {
          const d = await res.json().catch(() => ({}));
          const errEl = document.getElementById('submitError');
          if (errEl) { errEl.style.display = 'block'; errEl.textContent = d.error || 'Erro ao enviar.'; }
          btn.disabled = false; btn.textContent = 'Enviar';
        }
      } catch {
        const errEl = document.getElementById('submitError');
        if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro de conexão.'; }
        btn.disabled = false; btn.textContent = 'Enviar';
      }
    }

    function saveDraft() { /* sessionStorage por form */ }
    function restoreDraft() { /* sessionStorage por form */ }

    document.addEventListener('input', e => {
      const f = e.target.closest('.field');
      if (f?.classList.contains('field-invalid') && e.target.value.trim())
        f.classList.remove('field-invalid');
    });
    document.addEventListener('change', e => {
      const f = e.target.closest('.field');
      if (f?.classList.contains('field-invalid')) f.classList.remove('field-invalid');
    });

    init();
  </script>
</body>
</html>
```

---

## OBSERVAÇÕES

- `forms.ts` e `clickup.ts` precisam de build após edições
- `config.js`, HTMLs e `utils.js` não precisam de build
- O webhook N8N salva a URL no `localStorage` do browser — é por dispositivo.
  Para MVP é suficiente; pode migrar para endpoint de configuração no banco depois
- Forms N8N não criam task no ClickUp mas aparecem no painel admin normalmente
- O form de cartão de visita tem 2 steps: step 1 escolhe físico/digital,
  step 2 mostra os campos correspondentes e o tipo de ClickUp muda conforme escolha
