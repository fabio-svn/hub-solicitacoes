# Frontend

O frontend é construído em HTML/CSS/JS vanilla, sem framework. Cada tela é um arquivo `.html` independente em `public/`. Arquivos JS compartilhados são carregados via `<script>` em ordem específica.

## Arquivos JS compartilhados

### `auth.js`

Gerencia a sessão do usuário no lado cliente.

- **`Auth.init()`** — busca `/auth/me` e popula `Auth.user` (nome, email, role). Usa cache de sessionStorage de 5 minutos para evitar requisições repetidas.
- **`Auth.isAuthenticated()`** — retorna `true` se há usuário na sessão.
- **`Auth.getRole()`** / **`Auth.getUserName()`** — acessores do perfil.
- **`Auth.getProfile()`** — retorna dados estendidos (telefone, unidade, cargo, cd_ancord), vindos do MySQL Contatos via `/auth/me-profile`.
- **`Auth.aplicarPerfilNoCampo(fieldId, valor)`** — preenche automaticamente um campo do formulário com dados do cadastro e exibe hint "Pré-preenchido do seu cadastro".
- **`Auth.marcarComoLido(id)`** / **`Auth.isPendente(id)`** — controla o badge de notificação de aprovações pendentes não lidas (localStorage).
- **`Auth.temPendencias()`** / **`Auth.getPendentesCount()`** — usados pelo `Shell` para renderizar o badge numérico no ícone de sino.

### `config.js`

Constantes de UI e configuração carregadas do servidor na inicialização.

- Define `CATEGORIAS_SOLICITACAO` (categorias e itens do menu de seleção de formulário).
- Define `TIPO_SOLICITACAO_LABELS` (mapa `tipo → label` para exibição).
- Define `STATUS_SOLICITACAO` (lista de status com `id`, `label`, `bg`, `text`) e `getStatus(id)`.
- Na inicialização, faz `fetch('/api/config')` e `fetch('/api/form-schemas')` para sobrescrever os fallbacks locais com dados do servidor (marcas, contratos, cargos, setores, labels).
- Expõe `window._svnFormSchemas` e `window._svnFieldLabels` para formulários que precisam de options dinâmicas.

### `form-core.js`

Motor de formulários. Todas as páginas de formulário dependem deste arquivo.

| Função | Descrição |
|---|---|
| `FormCore.initForm({ tipo, onReady, draft, ... })` | Inicializa o formulário: verifica autenticação, restaura rascunho do localStorage, injeta dados do perfil, chama `onReady`. |
| `FormCore.validateRequired(extraValidate?, scopeEl?)` | Valida campos obrigatórios no escopo (ou em todo o form). Suporta grupos radio/checkbox e visibilidade condicional. Retorna `true` se ok. |
| `FormCore.submit({ tipo, dados, files, ... })` | Monta `FormData`, faz `POST /api/solicitacoes` e redireciona para `thankyou.html`. |
| `FormCore.renderStepper(el, steps, current)` | Renderiza o indicador de progresso de etapas no elemento `el`. |
| `FormCore.saveDraft(tipo, dados)` | Salva rascunho no localStorage com chave `svn_draft_<tipo>`. |
| `FormCore.clearDraft(tipo)` | Remove rascunho após submit bem-sucedido. |

### `filters.js`

Engine de painéis de filtro para listagens (admin, dashboard).

| Função | Descrição |
|---|---|
| `FilterPanel.register(id, { state, onChange })` | Vincula um DOM ID a um objeto de estado e callback de mudança. |
| `FilterPanel.set(id, btn, key)` | Ativa um filtro e chama `onChange`. |
| `FilterPanel.clear(id)` | Reseta todos os filtros do painel. |
| `FilterPanel.toggle(id)` | Abre/fecha o dropdown de filtros. |

### `shell.js`

Layout global (header + sidebar).

| Função | Descrição |
|---|---|
| `Shell.render({ activeRoute, contentEl })` | Injeta header e sidebar no DOM com a rota ativa destacada. |
| `Shell.toggleSidebar()` | Controla o estado aberto/fechado da sidebar no mobile. |

A sidebar exibe itens diferentes conforme a role do usuário (ex.: "Capital Humano" só aparece para `capital_humano` e `admin`; "Admin" só para `admin` e `gestor`).

### `utils.js`

Funções utilitárias globais.

| Função | Descrição |
|---|---|
| `window.esc(str)` | Escapa HTML para evitar XSS. |
| `humanizeValue(key, value)` | Converte valores de banco (slugs, booleans, IDs) em texto legível em português. Usa `_svnFieldLabels` como primeira fonte, com fallbacks para strings comuns. |
| `mascaraTelefone(el)` | Aplica máscara `(XX) XXXXX-XXXX` ao input. |
| `mascaraMoeda(el)` | Aplica máscara monetária `R$ X.XXX,XX`. |
| `Modal.open(id)` / `Modal.close(id)` | Controla modais por ID de elemento. |
| `autoResizeTextarea(el)` | Expande textareas conforme o conteúdo. |

### `upload-feedback.js`

Feedback visual para inputs de arquivo.

- **`FileUpload.bind(inputId, nameElId, options)`** — ao selecionar arquivo: exibe nome, tamanho, ícone de sucesso/erro. Valida extensões permitidas e tamanho máximo (em MB). Não faz upload — isso é responsabilidade do `FormCore.submit`.

### `toast.js`

Notificações e confirmações.

| Função | Descrição |
|---|---|
| `showToast(message, type)` | Exibe notificação não-bloqueante no canto da tela (`success`, `error`, `info`). |
| `showConfirm(message, options)` | Abre modal de confirmação com callbacks `onConfirm`/`onCancel`. |

### `ibge-loader.js`

Carrega estados e cidades do Brasil via API do IBGE, com cache no localStorage (TTL de 24h). Usado em formulários com seleção geográfica.

---

## Padrão das páginas de formulário

Toda página de formulário segue a mesma estrutura:

### Ordem de carregamento dos scripts

```html
<script src="/utils.js"></script>
<script src="/upload-feedback.js"></script>
<script src="/config.js"></script>
<script src="/auth.js"></script>
<script src="/shell.js"></script>
<script src="/form-core.js"></script>
```

### Estrutura HTML

```html
<div class="page-container page-container--narrow">
  <!-- Indicador de etapas (multi-step) -->
  <div class="svn-stepper" id="stepper"></div>

  <!-- Etapa 1 -->
  <div class="form-step" id="step1">
    <div class="field">
      <label for="nome">Nome <span class="required-star">*</span></label>
      <input type="text" id="nome" required>
      <div class="field-error" id="nome-error"></div>
    </div>
    <!-- ... mais campos ... -->
    <button class="btn btn-submit-gold" onclick="irParaStep2()">Próximo</button>
  </div>

  <!-- Etapa 2 -->
  <div class="form-step" id="step2" style="display:none">
    <!-- ... campos ... -->
    <button class="btn btn-submit-gold" onclick="submitForm()">Enviar solicitação</button>
  </div>
</div>
```

### Inicialização

```js
FormCore.initForm({
  tipo: 'apresentacao-nova',    // tipo_solicitacao
  draft: true,                  // habilita salvamento de rascunho
  onReady: (user, profile) => {
    // pré-preencher campos com dados do perfil
    Auth.aplicarPerfilNoCampo('telefone', profile?.telefone);
    // vincular upload
    FileUpload.bind('arquivo', 'arquivo-nome', { accept: ['.pdf', '.pptx'], maxMb: 20 });
    // renderizar stepper
    FormCore.renderStepper(document.getElementById('stepper'), ['Dados', 'Detalhes', 'Revisão'], 0);
    // inicializar Shell
    Shell.render({ activeRoute: 'solicitacoes', contentEl: document.getElementById('pageContent') });
  }
});
```

### Validação por etapa

```js
function irParaStep2() {
  if (!FormCore.validateRequired(null, document.getElementById('step1'))) return;
  document.getElementById('step1').style.display = 'none';
  document.getElementById('step2').style.display = 'block';
  FormCore.renderStepper(document.getElementById('stepper'), ['Dados', 'Detalhes'], 1);
}
```

### Submit

```js
function submitForm() {
  if (!FormCore.validateRequired(null, document.getElementById('step2'))) return;

  const dados = {
    nome:       document.getElementById('nome').value,
    telefone:   document.getElementById('telefone').value,
    // ... demais campos
  };

  FormCore.submit({
    tipo: 'apresentacao-nova',
    dados,
    files: ['arquivo'],   // IDs dos inputs de arquivo a incluir no FormData
  });
}
```

O `FormCore.submit` monta o `FormData`, faz `POST /api/solicitacoes`, limpa o rascunho e redireciona para `thankyou.html?id=<id>`.

---

## Campos pré-preenchidos do cadastro

Campos com dados vindos do MySQL Contatos (via `Auth.getProfile()`) exibem o hint:

> ✓ Pré-preenchido do seu cadastro — pode editar se quiser

Isso é feito por `Auth.aplicarPerfilNoCampo(fieldId, valor)`, que também suporta `<select>` criando a opção dinamicamente se não existir.
