# Cleanup geral — bugs, código morto, redundâncias, inconsistências

---

## 1. `forms.ts` — 5 correções

### 1a. Voltar checkRateLimit para 10

```ts
// DE:
if (entry.count >= 100) return false;
// PARA:
if (entry.count >= 10) return false;
```

### 1b. Corrigir REQUIRED_FIELDS de certificado-eventos

```ts
// O campo "emailCertificado" não existe — o form usa user.email.
// DE:
"certificado-eventos": ["nome", "nomeCompleto", "whatsapp", "emailCertificado", "cargaHoraria"],
// PARA:
"certificado-eventos": ["nome", "nomeCompleto", "whatsapp", "cargaHoraria"],
```

### 1c. Adicionar email ao webhook de cartao-comemorativo

```ts
// Em buildWebhookFields, case "cartao-comemorativo":
case "cartao-comemorativo":
  return {
    nome_aniversariante: s(dados.nomeAniversariante),
    modelo:              s(dados.modeloCartao),
    mensagem:            s(dados.mensagem),
    assinatura:          s(dados.assinatura),
    email:               userEmail, // ← ADICIONAR
  };
```

### 1d. Remover extractUrl() duplicada

```ts
// extractUrl() está definida em forms.ts MAS só é usada em clickup.ts.
// Em forms.ts, localizar e REMOVER a definição:
function extractUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')]+/);
  return m ? m[0].replace(/[.,;:!?)]+$/, "") : null;
}
// (manter apenas em clickup.ts onde é realmente usada)
```

### 1e. Remover "cidade" de REQUIRED_FIELDS de cartao-boas-vindas

```ts
// DE:
"cartao-boas-vindas": ["nome", "nomeCliente", "nomeAssinatura", "contratoSocial", "unidade", "cidade"],
// PARA:
"cartao-boas-vindas": ["nome", "nomeCliente", "nomeAssinatura", "contratoSocial", "unidade"],
```

---

## 2. `clickup.ts` — 4 correções

### 2a. Corrigir lógica isVideo em buildProducaoAudiovisualDescription

```ts
// DE:
const isVideo = dados.modalidade === "video" ||
  str(dados.titulo).length > 0 || str(dados.ideia).length > 0;

// PARA (usar o tipo da solicitação, passado via parâmetro):
// A função precisa receber o tipo — adicionar parâmetro:
function buildProducaoAudiovisualDescription(
  dados: FormDados,
  user: UserData,
  arquivos: ArquivosMap,
  tipo: string  // ← ADICIONAR parâmetro
): string {
  const isVideo = tipo === "producao-video";
  // ... resto igual
}

// E na chamada em createClickUpTask():
// DE:
description = buildProducaoAudiovisualDescription(dados, user, safeArquivos);
// PARA:
description = buildProducaoAudiovisualDescription(dados, user, safeArquivos, tipo);
```

### 2b. Corrigir mutação de dados.localEndereco

```ts
// Em setEventosCustomFields, substituir a mutação direta:
// DE:
(dados as Record<string, unknown>).localEndereco = enderecoUnidade;
logger.info({ unidade, endereco: enderecoUnidade }, "ClickUp: endereço da unidade SVN injetado");

// PARA (usar dadosLocal que já existe):
dadosLocal.localEndereco = enderecoUnidade;
logger.info({ unidade, endereco: enderecoUnidade }, "ClickUp: endereço da unidade SVN injetado");

// Garantir que o campo EVENTOS_CUSTOM_FIELDS para "localEndereco"
// busque de dadosLocal, não de dados:
// No loop de EVENTOS_CUSTOM_FIELDS, já está usando:
// const raw = field.dadosKey in dadosLocal ? dadosLocal[field.dadosKey] : dados[field.dadosKey];
// ✅ Correto — apenas a linha de mutação precisa mudar de `dados` para `dadosLocal`
```

### 2c. Adicionar bloco de solicitante ao buildCartaoFisicoDescription

```ts
// DE:
function buildCartaoFisicoDescription(dados: FormDados, user: UserData): string {
  const items: string[] = [];
  items.push(`• Nome: ${str(dados.nomeCartao)}`);
  items.push(`• WhatsApp: ${str(dados.whatsapp)}`);
  items.push(`• E-mail: ${str(dados.emailCorporativo)}`);
  items.push(`• Link para planilha: https://svninvest-my.sharepoint.com/...`);
  return items.join("\n");
}

// PARA:
function buildCartaoFisicoDescription(dados: FormDados, user: UserData): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user));
  const items: string[] = [];
  items.push(`• Nome: ${str(dados.nomeCartao)}`);
  items.push(`• WhatsApp: ${str(dados.whatsapp)}`);
  items.push(`• E-mail: ${str(dados.emailCorporativo)}`);
  items.push(`• Contrato social: ${str(dados.contratoSocial)}`);
  items.push(`• Link para planilha: https://svninvest-my.sharepoint.com/:x:/r/personal/gabriela_franca_svninvest_com_br/_layouts/15/Doc.aspx?sourcedoc=%7B7D66B897-EA4E-4C43-AB8C-20DB6B8B745C%7D&file=Solicitac%25u0327o%25u0303es%20Marketing.xlsx&nav=MTVfezAwMDAwMDAwLTAwMDEtMDAwMC0wNjAwLTAwMDAwMDAwMDAwMH0&action=default&mobileredirect=true`);
  blocks.push(`📇 CARTÃO DE VISITA\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`);
  return blocks.join("\n\n");
}
```

### 2d. Remover NATUREZA_CODIGO "patrocinio" desnecessário

```ts
// DE:
const NATUREZA_CODIGO: Record<string, string> = {
  "presencial": "P",
  "online":     "L",
  "patrocinio": "PC",  // ← REMOVER — tipo patrocínio não usa natureza
};
// PARA:
const NATUREZA_CODIGO: Record<string, string> = {
  "presencial": "P",
  "online":     "L",
};
```

---

## 3. `config.js` — 4 correções

### 3a. Remover constantes URL_FORM_* obsoletas

```js
// REMOVER completamente do topo do arquivo:
const URL_FORM_EVENTOS = "form-eventos.html";
const URL_FORM_PAGINA_ASSESSORES = "form-pagina-assessores.html";
const URL_FORM_APRESENTACOES = "form-apresentacoes.html";
const URL_FORM_ARTES_DIVULGACAO = "form-artes-divulgacao.html";
const URL_FORM_ATUALIZACAO_MATERIAL = "form-atualizacao-material.html";
const URL_FORM_CRIACAO_PDF = "form-criacao-pdf.html";
const URL_SOLICITACOES = "solicitacoes.html";
const URL_DASHBOARD = "dashboard.html";
const URL_ADMIN = "admin.html";
// Essas constantes nunca são usadas — substituídas por FORM_ROUTES.
```

### 3b. Remover tipos obsoletos de TIPO_SOLICITACAO_LABELS

```js
// REMOVER as seguintes entradas:
"materia-blog":       "Matéria para Blog/Jornal/Revista",
"conteudos-central":  "Conteúdos Central SVN",
"obras-manutencao":   "Obras e Manutenções",
"analise-gravacoes":  "Análise de Elegibilidade para Gravações",
```

### 3c. Corrigir layout "trio" com apenas 1 item

```js
// Em CATEGORIAS_SOLICITACAO, categoria "Audiovisual":
// DE:
{
  categoria: "Audiovisual",
  layout: "trio",
  itens: [
    { id: "producao-audiovisual", label: "Produção Audiovisual", icon: "icon-video", ativo: true },
  ]
},
// PARA (remover layout — usa o padrão de grid normal):
{
  categoria: "Audiovisual",
  itens: [
    { id: "producao-audiovisual", label: "Produção Audiovisual", icon: "icon-video", ativo: true },
  ]
},
```

### 3d. Corrigir email de upload

```js
// Verificar qual domínio é o correto: svninvest.com.br ou elevationsvn.com.br
// Atualizar para o domínio correto em AMBOS os lugares:
// 1. config.js:
let EMAIL_UPLOAD = "gabriela.franca@elevationsvn.com.br"; // ou svninvest.com.br

// 2. Nos forms (form-pagina-online.html, form-outro.html, form-brindes.html, etc)
//    onde o email está hardcoded, substituir pelo valor correto.
// ATENÇÃO: confirmar o domínio correto com o usuário antes de aplicar.
```

---

## 4. `solicitacao.html` — 2 correções

### 4a. Remover 'cartao-visita-fisico' de TIPOS_AUTOMACAO

```js
// Localizar TIPOS_AUTOMACAO em solicitacao.html:
// DE:
const TIPOS_AUTOMACAO = [
  'assinatura-email',
  'cartao-visita-fisico',  // ← REMOVER — físico tem ClickUp e rail de status
  'cartao-visita-digital',
  'cartao-boas-vindas',
  'divulgacao-nps',
  'convite-fp',
  'certificado-eventos',
  'cartao-comemorativo',
];
// PARA:
const TIPOS_AUTOMACAO = [
  'assinatura-email',
  'cartao-visita-digital',
  'cartao-boas-vindas',
  'divulgacao-nps',
  'convite-fp',
  'certificado-eventos',
  'cartao-comemorativo',
];
```

### 4b. Proteger syncStatus contra double-render

```js
// Adicionar flag de render em andamento:
let _syncing = false;

async function syncStatus(item) {
  if (_syncing) return;
  _syncing = true;
  try {
    const r = await fetch('/api/solicitacoes/' + solicitacaoId + '/status');
    if (!r.ok) return;
    const d = await r.json();
    if (d.updated && d.status !== item.status) {
      item.status = d.status;
      renderPage(item);
    }
  } catch {}
  finally {
    _syncing = false;
  }
}
```

---

## 5. `thankyou.html` — 2 correções

### 5a. Ler sessionStorage uma única vez e remover sempre

```js
// Substituir os dois blocos try separados por um único bloco unificado:

try {
  const raw = sessionStorage.getItem('svn_ultimo_resumo');
  if (!raw) throw new Error('sem resumo');
  const resumo = JSON.parse(raw);

  // 1. Verificar se é automação e ajustar título/subtítulo
  if (resumo.tipo_id && TIPOS_AUTOMACAO.includes(resumo.tipo_id)) {
    document.getElementById('title').textContent = 'Solicitação enviada com sucesso!';
    document.getElementById('subtitle').textContent =
      'Seu material será gerado automaticamente e enviado para o e-mail informado em breve.';
  }

  // 2. Montar itens do resumo
  const itens = [];
  if (resumo.tipo)        itens.push({ label: 'Tipo',          valor: resumo.tipo });
  if (resumo.titulo)      itens.push({ label: 'Identificação', valor: resumo.titulo });
  if (resumo.natureza) {
    const naturezaMap = { presencial: 'Presencial', online: 'Online', patrocinio: 'Patrocínio' };
    itens.push({ label: 'Natureza', valor: naturezaMap[resumo.natureza] || resumo.natureza });
  }
  if (resumo.solicitante) itens.push({ label: 'Solicitante', valor: resumo.solicitante });
  if (resumo.setor)       itens.push({ label: 'Setor',       valor: resumo.setor });
  if (resumo.data)        itens.push({ label: 'Enviado em',  valor: resumo.data + ' às ' + resumo.hora });
  if (resumo.materiais?.length > 0)
    itens.push({ label: 'Itens solicitados', valor: resumo.materiais.length + ' item(ns)' });

  if (itens.length > 0) {
    document.getElementById('resumoItens').innerHTML = itens.map(item => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid rgba(255,248,243,0.07);font-size:0.82rem">
        <span style="color:rgba(255,248,243,0.7);font-weight:400">${item.label}</span>
        <span style="color:var(--paper-white);font-weight:600;text-align:right;max-width:60%">${item.valor}</span>
      </div>
    `).join('');
    setTimeout(() => {
      const card = document.getElementById('resumoCard');
      card.style.transition = 'opacity 0.4s ease';
      card.style.opacity = '1';
    }, 1200);
  }

  // 3. Remover SEMPRE — independente de ter itens ou não
  sessionStorage.removeItem('svn_ultimo_resumo');

} catch {}
```

### 5b. Remover transform redundante

```js
// DE:
card.style.transition = 'all 0.5s ease';
card.style.opacity = '1';
card.style.transform = 'scale(1)';  // ← REMOVER

// PARA:
card.style.transition = 'opacity 0.5s ease';
card.style.opacity = '1';
```

---

## 6. `dashboard.html` — 4 correções

### 6a. Ler currentTab do sessionStorage no init

```js
// Localizar a declaração de currentTab:
// DE:
let currentTab = 'geral';

// PARA:
let currentTab = sessionStorage.getItem('svn_dashboard_tab') || 'geral';
```

### 6b. Padronizar cor do botão ClickUp para roxo em toda a UI

```js
// Em renderAdminHistorico(), o botão ClickUp usa verde:
// background:rgba(74,124,47,0.1)  ← verde
// Substituir por roxo (igual ao usado em solicitacao.html e request-card):
// background:rgba(137,48,253,0.08)

// DE:
'<button style="...background:rgba(74,124,47,0.1)..." ...' + CLICKUP_ICON + '</button>'
// PARA:
'<button style="...background:rgba(137,48,253,0.08);color:#7c3aed..." ' +
  'onmouseover="this.style.background=\'rgba(137,48,253,0.15)\';this.style.transform=\'scale(1.08)\'" ' +
  'onmouseout="this.style.background=\'rgba(137,48,253,0.08)\';this.style.transform=\'scale(1)\'" ...' +
  CLICKUP_ICON + '</button>'
```

### 6c. Mover funções utilitárias duplicadas para utils.js

```js
// As seguintes funções são IDÊNTICAS em dashboard.html e solicitacoes.html:
// normalizeSlug(), titleCasePtBr(), humanizeSlug(), formatarData(), humanizeValue()
// Mover para utils.js (já existe para mascaraTelefone e mascaraMoeda).
// Em ambos os arquivos, remover as definições locais e carregar utils.js:
// <script src="utils.js"></script>  (antes de config.js)

// Em utils.js, adicionar as funções:
function normalizeSlug(value) { ... }
function titleCasePtBr(text) { ... }
function humanizeSlug(value) { ... }
function formatarData(raw) { ... }
function humanizeValue(key, value) { ... }
```

### 6d. Corrigir Promise.all do gráfico para garantir ordem

```js
// Em switchTab('admin') e initAdmin(), garantir que o gráfico só
// renderiza após loadAdminStats() resolver:

// DE:
Promise.all([loadAdminStats(), loadAdminHistorico()]);

// PARA:
loadAdminStats();      // renderAdminGrafico() é chamado dentro
loadAdminHistorico();  // independente, pode rodar em paralelo
// Não usar Promise.all pois loadAdminStats controla o gráfico
```

---

## 7. `index.html` — 1 correção

### Reabilitar botões em caso de erro no goTo()

```js
// DE:
async function goTo(page) {
  document.querySelectorAll('.home-btn').forEach(b => {
    b.style.opacity = '0.5';
    b.style.pointerEvents = 'none';
  });
  await Auth.init();
  if (!Auth.isAuthenticated()) { window.location.href = '/auth/login?redirect=/' + page; return; }
  window.location.href = '/' + page;
}

// PARA:
async function goTo(page) {
  const btns = document.querySelectorAll('.home-btn');
  btns.forEach(b => { b.style.opacity = '0.5'; b.style.pointerEvents = 'none'; });
  try {
    await Auth.init();
    if (!Auth.isAuthenticated()) {
      window.location.href = '/auth/login?redirect=/' + page;
      return;
    }
    window.location.href = '/' + page;
  } catch {
    // Reabilitar botões em caso de erro
    btns.forEach(b => { b.style.opacity = ''; b.style.pointerEvents = ''; });
    const errEl = document.getElementById('errorMsg');
    if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro de conexão. Tente novamente.'; }
  }
}
```

---

## OBSERVAÇÕES

- `forms.ts` e `clickup.ts` precisam de build
- `config.js`, `solicitacao.html`, `thankyou.html`, `dashboard.html`,
  `index.html`, `utils.js` não precisam de build
- Item 3d (email de upload): confirmar o domínio correto antes de aplicar
- Item 6c (utils.js): é a mudança de maior impacto em qualidade de código —
  elimina ~80 linhas duplicadas entre dashboard.html e solicitacoes.html
- Item 4a (cartao-visita-fisico fora de TIPOS_AUTOMACAO): crítico para
  usuários que fizeram solicitação de cartão físico e não conseguem ver
  o rail de andamento
