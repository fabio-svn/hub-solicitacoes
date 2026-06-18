# Convenções

## Tokens de marca SVN

Definidos como variáveis CSS globais no CSS compartilhado das páginas. Os valores abaixo refletem o uso no código.

### Cores principais

| Token CSS | Valor | Uso |
|---|---|---|
| `--carbon-black` | `#221b19` | Texto principal |
| `--ruby-red` | `#AC3631` | Cor de destaque/brand (botões primários, bordas de aprovação) |
| `--gold` | `#C98A00` (aprox.) | Status em andamento/análise; botões dourados |
| `--icon-bg` | `rgba(34,27,25,0.06)` | Fundo de ícones e badges neutros |

### Status e cores de badge

Os status têm suas cores definidas em `STATUS_SOLICITACAO` no `config.js`. A convenção é sempre usar `bg` (background) e `text` (cor do texto) do objeto de status, nunca cores hardcoded por slug.

```js
const s = getStatus('em-aprovacao');
// s.bg  = "#2563C0"
// s.text = "#FFFFFF"
badge.style.background = s.bg;
badge.style.color = s.text;
```

### Tipografia

- **Fonte de texto:** `RoobertPRO-Regular` (usada nos artefatos gerados; não carregada no frontend web)
- **Fonte de títulos em artes:** `IvyJournal-Light` (usada nos artefatos gerados)
- No frontend web: `system-ui` / stack de fontes do navegador

### Classes CSS utilitárias recorrentes

| Classe | Uso |
|---|---|
| `.page-container` | Wrapper central das páginas |
| `.page-container--narrow` | Versão estreita para formulários |
| `.form-card` | Card com sombra para seções do formulário |
| `.field` | Wrapper de campo (label + input + error) |
| `.field-error` | Mensagem de erro de validação |
| `.required-star` | Asterisco vermelho em campos obrigatórios |
| `.btn` | Base de botão |
| `.btn-submit-gold` | Botão primário dourado |
| `.btn-download-page` | Botão de download em página de detalhe |
| `.svn-stepper` | Indicador de progresso multi-step |
| `.form-step` | Container de uma etapa do formulário |
| `.search-bar` | Input de busca padronizado |

---

## Padrões de código

### TypeScript / Node.js

- **Módulos:** ESM (`"type": "module"` no package.json). Use `import`/`export`, nunca `require`.
- **Build:** esbuild via `build.mjs`. O output vai para `dist/index.mjs`. Não é necessário `tsc` para rodar — apenas para type-check.
- **Type-check:** `pnpm typecheck` (não faz emit). Rode antes de commitar em mudanças de tipos.
- **Async:** use `async/await`. Evite callbacks encadeados.
- **Erros:** lance `ApiError` (de `src/utils/api-error.ts`) para erros esperados. O handler central em `app.ts` os serializa corretamente.
- **Logging:** use `req.log` (pino injetado pelo `pino-http`) dentro de rotas. Nunca use `console.log` em produção.

### Rotas Express

- Todas as rotas definem o tipo de retorno explicitamente: `async (req, res): Promise<void>`.
- O middleware de autenticação (`requireAuth` / `requireRole`) vem sempre antes da lógica de negócio.
- Resposta de erro segue o padrão: `res.status(NNN).json({ error: "Mensagem legível" })`.

### JavaScript frontend

- Vanilla JS (sem framework). Módulos não são usados — os scripts são carregados via `<script>` em ordem.
- Escaping HTML: sempre use `window.esc(str)` ao injetar conteúdo dinâmico no DOM (evita XSS).
- Não use `innerHTML` com dados do usuário sem `esc()`.

### Nomenclatura

| Contexto | Convenção |
|---|---|
| Tipos de solicitação (`tipo_solicitacao`) | kebab-case (`assinatura-email`, `cartao-visita-digital`) |
| Campos de formulário no banco (`dados` JSONB) | snake_case (`nome_assinatura`, `contrato_social`) |
| Variáveis JS no frontend | camelCase |
| Variáveis TypeScript | camelCase (objetos) / UPPER_SNAKE_CASE (constantes de módulo) |
| IDs de elementos HTML | kebab-case |
| Classes CSS | kebab-case |
| Variáveis de ambiente | UPPER_SNAKE_CASE |

### Banco de dados

- Todas as tabelas têm `id serial PRIMARY KEY` e `created_at timestamp`.
- Dados de formulário vão no campo `dados jsonb` — não crie colunas por campo.
- Novos campos que precisem de indexação devem ser colunas explícitas (ex.: `status`, `tipo_solicitacao`).
- Migrações: atualmente feitas com `CREATE TABLE IF NOT EXISTS` na inicialização. Para alterações destrutivas ou adição de índices, crie um script em `src/scripts/`.

### Variáveis de ambiente

- Nunca acesse `process.env` diretamente no código de rota — centralize a leitura em `src/config/` ou no topo do arquivo de inicialização.
- Variáveis sem valor padrão razoável são `[obrigatório]` — o servidor não deve subir silenciosamente sem elas.
- Documente toda nova variável no `.env.example` com comentário explicativo.

---

## Estrutura de uma nova integração

Se precisar adicionar uma nova integração externa:

1. Crie o cliente em `src/lib/<servico>.ts`
2. Exponha funções nomeadas (não o cliente bruto) para os consumers
3. Trate ausência de credenciais graciosamente (retorne `null` ou logue aviso, não lance exceção no boot)
4. Documente as variáveis de ambiente necessárias no `.env.example`
5. Adicione a integração em [integracoes.md](integracoes.md)
