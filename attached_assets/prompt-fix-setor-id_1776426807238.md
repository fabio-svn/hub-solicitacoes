# Adição — Campo Setor em todos os forms + ID automática no ClickUp

---

## 1. `config.js` — Atualizar `SETORES` e adicionar `SETOR_CODIGOS`

### 1a. Substituir array `SETORES` por lista completa em ordem alfabética

```js
const SETORES = [
  "Selecione seu setor",
  "Administração",
  "Alocação",
  "Aracaju",
  "Câmbio",
  "Campo Grande",
  "Capital Humano",
  "Cascavel",
  "Commodities",
  "Connect",
  "Corporate",
  "Cuiabá",
  "Curitiba",
  "Curitiba Digital",
  "Digital",
  "Financeiro",
  "Foz do Iguaçu",
  "Institucional",
  "Jurídico",
  "Londrina",
  "Marketing",
  "Marketing Digital",
  "Maringá",
  "Maringá Digital",
  "Middle",
  "Performance",
  "Produto",
  "Proteção Patrimonial",
  "Renda Fixa",
  "Renda Variável",
  "Salvador",
  "São Paulo",
  "São Paulo Digital",
  "SVN Gestão",
  "SVN Global",
  "SVN Investment & Merchant Banking (M&A)",
  "Toledo",
  "Universidade SVN",
  "Vitória da Conquista",
  "Wealth Planning",
];
```

### 1b. Adicionar mapa `SETOR_CODIGOS` (para geração da ID)

```js
const SETOR_CODIGOS = {
  "Administração":                          "ADM",
  "Alocação":                               "ALO",
  "Aracaju":                                "AJU",
  "Câmbio":                                 "CAM",
  "Campo Grande":                           "CGR",
  "Capital Humano":                         "RH",
  "Cascavel":                               "CVV",
  "Commodities":                            "CMO",
  "Connect":                                "CONN",
  "Corporate":                              "COR",
  "Cuiabá":                                 "CBA",
  "Curitiba":                               "CTB",
  "Curitiba Digital":                       "CTBDGT",
  "Digital":                                "DIG",
  "Financeiro":                             "FIN",
  "Foz do Iguaçu":                          "FOZ",
  "Institucional":                          "INST",
  "Jurídico":                               "JUR",
  "Londrina":                               "LDN",
  "Marketing":                              "MKT",
  "Marketing Digital":                      "MKTDGT",
  "Maringá":                                "MGF",
  "Maringá Digital":                        "MGFDGT",
  "Middle":                                 "MID",
  "Performance":                            "PER",
  "Produto":                                "PRO",
  "Proteção Patrimonial":                   "PPA",
  "Renda Fixa":                             "RF",
  "Renda Variável":                         "RV",
  "Salvador":                               "SSA",
  "São Paulo":                              "SAO",
  "São Paulo Digital":                      "SAODGT",
  "SVN Gestão":                             "GEST",
  "SVN Global":                             "GLO",
  "SVN Investment & Merchant Banking (M&A)":"IMB",
  "Toledo":                                 "TLD",
  "Universidade SVN":                       "USVN",
  "Vitória da Conquista":                   "VDC",
  "Wealth Planning":                        "WEAL",
};
```

### 1c. Adicionar ao `DRAWER_FIELD_LABELS`

```js
setor: "Setor",
```
(já pode existir — verificar e adicionar se não tiver)

---

## 2. Adicionar campo Setor em todos os forms

O campo deve ser adicionado logo após o header de cada form,
antes do primeiro campo de conteúdo. É **obrigatório** em todos.

### Template do campo (igual em todos os forms):

```html
<div class="field">
  <label>Setor</label>
  <select id="setor" required>
    <option value="">Selecione seu setor</option>
  </select>
</div>
```

E no `init()` de cada form, popular o select:
```js
const setorSel = document.getElementById('setor');
if (setorSel) {
  SETORES.filter(s => s !== 'Selecione seu setor').forEach(s => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    setorSel.appendChild(o);
  });
}
```

### Adicionar ao objeto `dados` no `submitForm()` de cada form:

```js
setor: document.getElementById('setor')?.value || '',
```

### Adicionar ao `saveDraft`/`saveSession`/`restoreFormState` de cada form:

```js
// No save:
setor: document.getElementById('setor')?.value || '',

// No restore:
if (d.setor) { const el = document.getElementById('setor'); if (el) el.value = d.setor; }
```

### Forms a atualizar:
- `form-eventos.html`
- `form-artes-divulgacao.html`
- `form-atualizacao-material.html`
- `form-apresentacoes.html`
- `form-criacao-pdf.html`
- `form-pagina-assessores.html`

---

## 3. `clickup.ts` — Gerar ID automática e preencher campo

### 3a. Adicionar mapa de tipos de evento e função geradora de ID

Adicionar após as importações, no topo do arquivo:

```ts
const NATUREZA_CODIGO: Record<string, string> = {
  "presencial": "P",
  "online":     "L",
  "patrocinio": "PC",
};

const SETOR_CODIGO_MAP: Record<string, string> = {
  "Administração":                          "ADM",
  "Alocação":                               "ALO",
  "Aracaju":                                "AJU",
  "Câmbio":                                 "CAM",
  "Campo Grande":                           "CGR",
  "Capital Humano":                         "RH",
  "Cascavel":                               "CVV",
  "Commodities":                            "CMO",
  "Connect":                                "CONN",
  "Corporate":                              "COR",
  "Cuiabá":                                 "CBA",
  "Curitiba":                               "CTB",
  "Curitiba Digital":                       "CTBDGT",
  "Digital":                                "DIG",
  "Financeiro":                             "FIN",
  "Foz do Iguaçu":                          "FOZ",
  "Institucional":                          "INST",
  "Jurídico":                               "JUR",
  "Londrina":                               "LDN",
  "Marketing":                              "MKT",
  "Marketing Digital":                      "MKTDGT",
  "Maringá":                                "MGF",
  "Maringá Digital":                        "MGFDGT",
  "Middle":                                 "MID",
  "Performance":                            "PER",
  "Produto":                                "PRO",
  "Proteção Patrimonial":                   "PPA",
  "Renda Fixa":                             "RF",
  "Renda Variável":                         "RV",
  "Salvador":                               "SSA",
  "São Paulo":                              "SAO",
  "São Paulo Digital":                      "SAODGT",
  "SVN Gestão":                             "GEST",
  "SVN Global":                             "GLO",
  "SVN Investment & Merchant Banking (M&A)":"IMB",
  "Toledo":                                 "TLD",
  "Universidade SVN":                       "USVN",
  "Vitória da Conquista":                   "VDC",
  "Wealth Planning":                        "WEAL",
};

function gerarIdSolicitacao(dados: FormDados, tipo: string): string {
  // Tipo de evento (para eventos) ou código genérico para demais
  const naturezaRaw = str(dados.natureza as string).toLowerCase();
  const tipoCode = tipo === "eventos"
    ? (NATUREZA_CODIGO[naturezaRaw] || "E")
    : "S"; // S = Solicitação para forms gerais

  // Setor
  const setor = str(dados.setor as string);
  const setorCode = SETOR_CODIGO_MAP[setor] || "GRL";

  // Data atual
  const now = new Date();
  const ano  = now.getFullYear();
  const mes  = String(now.getMonth() + 1).padStart(2, "0");
  const dia  = String(now.getDate()).padStart(2, "0");

  // 3 números aleatórios
  const rand = String(Math.floor(Math.random() * 900) + 100);

  return `${tipoCode}-${setorCode}-${ano}-${mes}-${dia}-${rand}`;
}
```

### 3b. Gerar e preencher a ID em `createClickUpTask()`

No início de `createClickUpTask()`, após determinar `tipo` e `subtipo`,
adicionar a geração da ID:

```ts
// Gerar ID da solicitação
const idSolicitacao = gerarIdSolicitacao(dados, tipo);
logger.info({ idSolicitacao, tipo }, "ClickUp: ID da solicitação gerada");
```

### 3c. Preencher o campo ID no ClickUp após criar a task

Ao final de `createClickUpTask()`, antes do `return taskId`,
após as chamadas `setEventosCustomFields` / `setGeneralCustomFields`,
adicionar:

```ts
// Preencher campo ID da solicitação (campo compartilhado entre listas)
await setClickUpCustomField(
  taskId,
  "4a8493f1-dfc8-49b4-9372-f6df80d62816",
  idSolicitacao,
  "ID da Solicitação",
  { clickupType: "short_text", raw: idSolicitacao }
);
```

### 3d. Incluir setor na descrição dos forms gerais

Em `buildGeneralDescription()`, adicionar setor ao bloco de resumo:

```ts
// Já existe: if (setor && setor !== "Geral") addLine(resumoItems, "Setor", setor);
// Alterar para incluir sempre que houver setor:
if (setor) addLine(resumoItems, "Setor", setor);
```

---

## OBSERVAÇÕES

- Após editar `clickup.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- Os demais arquivos não precisam de build
- O campo `setor` no objeto `dados` já é lido pelo `getUserDepartment()`
  no `clickup.ts` — com o campo preenchido no form, o setor vai aparecer
  automaticamente no título das tasks gerais (`[Arte de Divulgação] MKT - Título`)
  e na descrição
- Para eventos, o setor não entra no título (que usa natureza + nome do evento)
  mas entra na descrição via `buildResumoSection()`
  — adicionar em `buildResumoSection()`:
  ```ts
  addLine(items, "Setor solicitante", str(dados.setor as string));
  ```
  logo após `addLine(items, "Natureza", natureza);`
