# Schema de Formulários

## O que é `form-schemas.ts`

`src/config/form-schemas.ts` é a **fonte única de verdade** para metadados de formulários. Ele define:

- Quais tipos de formulário existem
- Quais campos cada tipo tem (nome, label, tipo de input, required, options)
- Quais opções aparecem em selects/radios (marcas, contratos, cargos, setores)
- Os `REQUIRED_FIELDS` validados no backend
- Os `field_options` usados para resolver labels de valores no detalhe da solicitação

O endpoint `GET /api/form-schemas` expõe esses dados ao frontend. O `config.js` faz fetch desse endpoint na inicialização e popula `window._svnFormSchemas` e `window._svnFieldLabels`.

> **Não edite os fallbacks em `config.js`** — eles existem apenas para evitar tela em branco se o endpoint falhar. A fonte real é `form-schemas.ts`.

---

## Estrutura de um schema de tipo

```ts
// Exemplo simplificado
const FORM_SCHEMAS: Record<string, FormSchema> = {
  "assinatura-email": {
    tipo: "assinatura-email",
    label: "Assinatura de E-mail",
    fields: [
      {
        name: "nome_assinatura",
        label: "Nome para assinatura",
        type: "text",         // text | email | tel | select | radio | textarea | file
        required: true,
        options: null,
      },
      {
        name: "cargo",
        label: "Cargo",
        type: "select",
        required: true,
        options: CARGOS_OPTS,   // array de { value, label }
      },
      {
        name: "marca",
        label: "Marca",
        type: "radio",
        required: true,
        options: MARCAS_OPTS,
      },
    ],
    field_options: {
      // Mapa valor → label usado no detalhe da solicitação
      // Chave = nome do campo, valor = { [opcao]: label_legível }
      marca: {
        "svn-investimentos": "SVN Investimentos",
        "svn-gestao": "SVN Gestão",
        // ...
      }
    }
  }
};
```

---

## `REQUIRED_FIELDS`

```ts
const REQUIRED_FIELDS: Record<string, string[]> = {
  "assinatura-email": ["nome_assinatura", "cargo", "marca", "contrato_social"],
  "cartao-visita-digital": ["nome_cartao", "cargo", "whatsapp", "email_corporativo", "marca"],
  // ...
};
```

A função `validateFormDados(tipo, dados)` em `forms.ts` itera sobre `REQUIRED_FIELDS[tipo]` e retorna erro 400 se algum campo estiver ausente ou vazio no payload.

> Os campos em `REQUIRED_FIELDS` são os validados **no servidor**. O atributo `required: true` nos schemas é informativo para o frontend (asterisco visual, validação client-side via `FormCore.validateRequired`).

---

## Listas compartilhadas

| Constante | Conteúdo | Usado em |
|---|---|---|
| `CONTRATOS_OPTS` | Contratos sociais SVN (Investimentos, Capital, Connect…) | Cartão de Visita, Assinatura, Arte NPS… |
| `MARCAS_OPTS` | Marcas SVN (Investimentos, Gestão, Global, Corporate…) | Maioria dos formulários de identidade |
| `CARGOS_OPTS` | Cargos de assessores | Cartão de Visita, Assinatura |
| `SETORES_LIST` | Lista de strings de setores | Formulários internos |
| `SETOR_CODIGO_MAP` | `{ setor: código }` para montar IDs no ClickUp | `createClickUpTask` |

---

## Endpoint `/api/form-schemas`

Resposta:

```json
{
  "marcas":    [{ "value": "svn-investimentos", "label": "SVN Investimentos" }, ...],
  "contratos": [{ "value": "svn-investimentos", "label": "SVN Investimentos" }, ...],
  "cargos":    [{ "value": "assessor", "label": "Assessor de Investimentos" }, ...],
  "setores":   ["Administração", "Alocação", ...],
  "tipos":     [{ "tipo": "assinatura-email", "label": "Assinatura de E-mail", "fields": [...], "field_options": {...} }, ...],
  "labels":    { "assinatura-email": "Assinatura de E-mail", ... }
}
```

---

## Passo a passo para adicionar um novo tipo de formulário

### 1. Definir o schema em `form-schemas.ts`

```ts
// Adicione a chave no objeto FORM_SCHEMAS
"novo-tipo": {
  tipo: "novo-tipo",
  label: "Meu Novo Tipo",
  fields: [
    { name: "titulo", label: "Título", type: "text", required: true },
    { name: "descricao", label: "Descrição", type: "textarea", required: true },
  ],
  field_options: {},
},
```

### 2. Definir campos obrigatórios em `REQUIRED_FIELDS`

```ts
"novo-tipo": ["titulo", "descricao"],
```

### 3. Adicionar label em `TIPO_SOLICITACAO_LABELS` no `config.js`

```js
"novo-tipo": "Meu Novo Tipo",
```

> Isso é fallback do frontend. O backend também envia via `/api/form-schemas`.

### 4. Adicionar à categoria em `CATEGORIAS_SOLICITACAO` no `config.js`

```js
{
  categoria: "Marketing e conteúdo",
  itens: [
    // ... itens existentes ...
    { id: "novo-tipo", label: "Meu Novo Tipo", icon: "icon-file-text", ativo: true },
  ]
}
```

### 5. Criar a página HTML do formulário

Crie `public/form-novo-tipo.html` seguindo o padrão das páginas existentes (veja [frontend.md](frontend.md)). O `FORM_ROUTES` em `solicitacoes.html` (ou equivalente) precisa mapear `"novo-tipo"` para a URL `"/form-novo-tipo.html"`.

### 6. Configurar rota ClickUp (opcional)

Se o tipo deve ir para uma lista ClickUp dedicada, adicione via painel admin em `/admin-clickup-lists.html` ou configure as variáveis `CLICKUP_LIST_*` no `.env`.

### 7. Configurar geração automática (se aplicável)

Se o tipo gera material automaticamente, adicione-o à lista `TIPOS_AUTOMACAO` em `forms.ts` e configure a URL do webhook n8n correspondente (`WEBHOOK_NOVO_TIPO` no `.env`).

---

## Editar um tipo existente

- Para **adicionar campo**: adicione em `fields` e em `REQUIRED_FIELDS` se obrigatório. Dados antigos não terão o campo — `humanizeValue` trata ausências graciosamente.
- Para **remover campo**: remova de `fields` e `REQUIRED_FIELDS`. Dados antigos que tiverem o campo continuam exibidos via fallback em `humanizeValue`.
- Para **alterar opções de select/radio**: atualize `options` e `field_options`. Dados antigos com valores removidos aparecem como o próprio slug (fallback em `humanizeValue`).
