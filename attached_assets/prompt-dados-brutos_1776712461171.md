# Correção de dados brutos e labels mal formatados

---

## 1. `config.js` — Adicionar entradas faltando em DRAWER_FIELD_LABELS

```js
// Adicionar as seguintes entradas ao objeto DRAWER_FIELD_LABELS:

const DRAWER_FIELD_LABELS = {
  // ... entradas existentes ...

  // ← ADICIONAR:
  email:        "E-mail",
  unidadeSVN:   "Unidade SVN",
  tipoAprox:    "Tipo aproximado",
  cidadeEstado: "Cidade / Estado",
};
```

---

## 2. `solicitacao.html` — Corrigir humanizeValue() para estado IBGE e selos

### 2a. Adicionar mapa de estados IBGE ao humanizeValue()

```js
// Em humanizeValue(), adicionar ANTES do bloco de maps existente:

function humanizeValue(key, value) {
  // ── Estado IBGE → nome legível ──────────────────────
  if (key === 'estado') {
    const IBGE_ESTADOS = {
      "12":"Acre","27":"Alagoas","16":"Amapá","13":"Amazonas",
      "29":"Bahia","23":"Ceará","53":"Distrito Federal","32":"Espírito Santo",
      "52":"Goiás","21":"Maranhão","51":"Mato Grosso","50":"Mato Grosso do Sul",
      "31":"Minas Gerais","15":"Pará","25":"Paraíba","41":"Paraná",
      "26":"Pernambuco","22":"Piauí","33":"Rio de Janeiro","24":"Rio Grande do Norte",
      "43":"Rio Grande do Sul","11":"Rondônia","14":"Roraima","42":"Santa Catarina",
      "35":"São Paulo","28":"Sergipe","17":"Tocantins",
    };
    // Também aceita siglas (ex: "SP", "PR") — retornar como está
    if (IBGE_ESTADOS[String(value)]) return IBGE_ESTADOS[String(value)];
    return String(value); // sigla ou texto já legível
  }

  // ... resto do humanizeValue() existente ...
}
```

### 2b. Garantir fallback robusto para selos

```js
// Em humanizeValue(), substituir o bloco de selos por versão com fallback explícito:

// DE:
if (key === 'selos' && Array.isArray(value) && typeof SELOS_ASSESSOR !== 'undefined') {
  const sm = {};
  SELOS_ASSESSOR.forEach(s => { sm[normalizeSlug(s.id)] = s.label; });
  return value.map(v => sm[normalizeSlug(v)] || humanizeSlug(v)).join(' · ');
}

// PARA:
if (key === 'selos' && Array.isArray(value)) {
  // Mapa de fallback inline — independente do config.js
  const SELOS_FALLBACK = {
    'ancord':          'Ancord',
    'cea':             'CEA',
    'cfp':             'CFP',
    'cga':             'CGA',
    'cnpi':            'CNPI',
    'cpa10':           'CPA-10',
    'cpa20':           'CPA-20',
    'xp-private':      'XP Private',
    'palestrante-svn': 'Palestrante SVN',
  };
  let sm = { ...SELOS_FALLBACK };
  // Se config.js carregado, usar labels atualizados (sobrescreve o fallback)
  if (typeof SELOS_ASSESSOR !== 'undefined') {
    SELOS_ASSESSOR.forEach(s => { sm[normalizeSlug(s.id)] = s.label; });
  }
  return value.map(v => sm[normalizeSlug(v)] || String(v).toUpperCase()).join(' · ');
}
```

### 2c. Adicionar 'estado' e 'unidadeSVN' ao SKIP_KEYS de renderDados()

```js
// Decisão de design para 'estado':
// O campo 'cidade' já exibe a cidade legível (ex: "Maringá").
// Mostrar "estado" como "Paraná" duplica a informação se já houver cidade.
// OPÇÃO A: adicionar 'estado' ao SKIP_KEYS (remover do resumo — cidade já basta)
// OPÇÃO B: criar campo combinado cidade+estado

// Recomendação: OPÇÃO A — mais limpo, cidade já identifica o evento.
// Se quiser manter, a humanizeValue com IBGE_ESTADOS (item 2a) resolve.

// No renderDados(), substituir SKIP_KEYS:
const SKIP_KEYS = new Set([
  'idSolicitacao', 'natureza', 'setor', 'nome',
  'materiaisDetalhes',
  // 'estado', // ← descomentar se preferir omitir estado (cidade já aparece)
]);
```

---

## 3. `config.js` + `solicitacao.html` — Adicionar campos ausentes ao DRAWER_FIELD_LABELS

### Campos confirmados como ausentes que podem aparecer nos dados:

```js
// Em config.js, adicionar ao DRAWER_FIELD_LABELS:
const DRAWER_FIELD_LABELS = {
  // ... existentes ...

  // ← ADICIONAR os ausentes:
  email:             "E-mail",
  unidadeSVN:        "Unidade SVN",
  tipoAprox:         "Tipo aproximado",
  naturezaEvento:    "Natureza do evento",  // se usado como campo direto
  localEvento:       "Local do evento",
  maturidade:        "Nível de maturidade",
  horario:           "Horário",             // já existe? confirmar
};

// ATENÇÃO: 'horario' e 'maturidade' podem já existir — verificar antes de adicionar.
// Campos que JÁ EXISTEM e estão corretos (não adicionar duplicatas):
// horario ✅, maturidade ✅, localEvento ✅, nomeEvento ✅, etc.
```

---

## 4. `solicitacao.html` — Adicionar 'estado' ao humanizeValue (se não skipado)

Se optar por mostrar o estado (não skipar), adicionar o mapa IBGE
conforme item 2a acima. Resultado: "35" → "São Paulo", "41" → "Paraná".

Se optar por skipar, adicionar `'estado'` ao `SKIP_KEYS` em `renderDados()`.

---

## RESUMO DAS MUDANÇAS

| Arquivo | Mudança | Impacto |
|---------|---------|---------|
| `config.js` | Adicionar `email`, `unidadeSVN`, `tipoAprox` ao DRAWER_FIELD_LABELS | Labels legíveis nos resumos |
| `solicitacao.html` | humanizeValue: selos com fallback inline | Selos corretos mesmo sem config.js |
| `solicitacao.html` | humanizeValue: estado IBGE → nome do estado | "35" vira "São Paulo" |
| `solicitacao.html` | SKIP_KEYS: adicionar `materiaisDetalhes` e opcionalmente `estado` | Remove dados técnicos do resumo |

Nenhum build necessário — ambos são arquivos browser-side.
