# Correção — Backend (clickup.ts + forms.ts)

---

## 1. `clickup.ts` — Título da task legível

### 1a. Adicionar mapa de labels legíveis

Adicionar antes da função `createClickUpTask`:

```ts
const TIPO_LABELS: Record<string, string> = {
  "eventos":                       "Evento",
  "pagina-assessores-dados":       "Página de Assessores — Dados",
  "pagina-assessores-atualizacao": "Página de Assessores — Atualização",
  "artes-divulgacao":              "Arte de Divulgação",
  "apresentacao-nova":             "Apresentação — Nova",
  "apresentacao-atualizar":        "Apresentação — Atualização",
  "conteudo-pdf-informativo":      "PDF — Informativo",
  "conteudo-pdf-ebook":            "PDF — E-book",
  "atualizacao-material":          "Atualização de Material",
};

const SUBTIPO_LABELS: Record<string, string> = {
  "presencial":    "Presencial",
  "online":        "Online",
  "nova":          "Nova",
  "atualizar":     "Atualização",
  "informativo":   "Informativo",
  "ebook":         "E-book",
  "dados":         "Dados",
  "atualizacao":   "Atualização",
};
```

### 1b. Atualizar `taskName` para usar labels legíveis

Substituir o bloco que monta `taskName`:

```ts
const tipoLabel = TIPO_LABELS[tipo] || tipo;
const subtipoLabel = subtipo ? (SUBTIPO_LABELS[subtipo] || subtipo) : null;

// Para eventos: incluir natureza (presencial/online) no título
const natureza = (dados as Record<string, unknown>).natureza as string | undefined;
const naturezaLabel = natureza ? (SUBTIPO_LABELS[natureza] || natureza) : null;

let taskName: string;
if (tipo === 'eventos' && naturezaLabel) {
  taskName = `[Evento ${naturezaLabel}] ${nome} — ${solicitante}`;
} else if (subtipoLabel && subtipoLabel !== tipoLabel) {
  taskName = `[${tipoLabel} — ${subtipoLabel}] ${nome} — ${solicitante}`;
} else {
  taskName = `[${tipoLabel}] ${nome} — ${solicitante}`;
}
```

**Resultado dos títulos:**
- `[Evento Presencial] Palestra Renda Fixa — João Paulo Sardeto`
- `[Evento Online] Webinar FIIs — João Paulo Sardeto`
- `[Arte de Divulgação] Informe de Imposto de Renda — João Paulo Sardeto`
- `[Apresentação — Nova] Apresentação de Renda Fixa — João Paulo Sardeto`
- `[PDF — Informativo] Guia de Investimentos — João Paulo Sardeto`
- `[Página de Assessores — Dados] João Paulo Sardeto`

### 1c. Atualizar `CLICKUP_STATUS_MAP` com os novos status

Substituir o mapa atual por versão completa que cobre todos os status definidos no frontend:

```ts
const CLICKUP_STATUS_MAP: Record<string, string> = {
  // Status padrão ClickUp → status hub
  "to do":                   "recebido",
  "para fazer":              "recebido",
  "solicitações":            "recebido",
  "solicitacoes":            "recebido",
  "alinhamentos":            "alinhamentos",
  "in progress":             "em-andamento",
  "em andamento":            "em-andamento",
  "em análise":              "em-analise",
  "em analise":              "em-analise",
  "em produção":             "em-producao",
  "em producao":             "em-producao",
  "cotação":                 "cotacao-aprovacao",
  "cotacao":                 "cotacao-aprovacao",
  "em cotação":              "cotacao-aprovacao",
  "aprovação":               "cotacao-aprovacao",
  "aguardando pagamento":    "aguardando-pagamento",
  "waiting for payment":     "aguardando-pagamento",
  "aguardando finalização":  "aguardando-finalizacao",
  "aguardando finalizacao":  "aguardando-finalizacao",
  "waiting":                 "aguardando",
  "aguardando":              "aguardando",
  "aguardando informação":   "aguardando",
  "waiting on rh":           "aguardando-rh",
  "aguardando rh":           "aguardando-rh",
  "em espera":               "em-espera",
  "on hold":                 "em-espera",
  "complete":                "concluido",
  "concluído":               "concluido",
  "concluido":               "concluido",
  "done":                    "concluido",
  "cancelled":               "cancelado",
  "cancelado":               "cancelado",
  "reprovado":               "reprovado",
  "rejected":                "reprovado",
};
```

---

## 2. `forms.ts` — Corrigir bugs identificados

### 2a. Atualizar `VALID_STATUSES` com todos os status

```ts
const VALID_STATUSES = [
  "recebido",
  "alinhamentos",
  "em-analise",
  "em-andamento",
  "em-producao",
  "cotacao-aprovacao",
  "aguardando",
  "aguardando-rh",
  "aguardando-pagamento",
  "aguardando-finalizacao",
  "concluido",
  "reprovado",
  "cancelado",
  "em-espera",
];
```

### 2b. Implementar filtros `natureza` e `subtipo_filter` no GET /solicitacoes

No bloco de condições do GET, adicionar após o bloco de `req.query.status`:

```ts
// Filtro por natureza (campo dentro do JSONB dados)
if (req.query.natureza) {
  const natureza = String(req.query.natureza);
  if (natureza === 'presencial' || natureza === 'online') {
    conditions.push(sql`${solicitacoesTable.dados}->>'natureza' = ${natureza}`);
  }
}

// Filtro por subtipo (para aba Solicitações gerais)
if (req.query.subtipo_filter) {
  const subtipoFilter = String(req.query.subtipo_filter);
  if (VALID_TIPOS.some(t => t.startsWith(subtipoFilter) || t === subtipoFilter)) {
    // Busca por prefixo do tipo (ex: 'pagina-assessores' cobre -dados e -atualizacao)
    conditions.push(sql`${solicitacoesTable.tipo_solicitacao} LIKE ${subtipoFilter + '%'}`);
  }
}
```

### 2c. Corrigir mensagens de erro para incluir acentuação

```ts
// Substituir todas as mensagens de erro:
res.status(400).json({ error: "tipo_solicitacao é obrigatório" });
res.status(400).json({ error: "tipo_solicitacao inválido" });
res.status(400).json({ error: "maturidade deve ser 1, 2 ou 3" });
res.status(400).json({ error: `Campo obrigatório ausente: ${field}` });
res.status(400).json({ error: "ID inválido" });
res.status(404).json({ error: "Solicitação não encontrada" });
res.status(500).json({ error: "Erro ao processar solicitação" });
res.status(500).json({ error: "Erro ao listar solicitações" });
res.status(500).json({ error: "Erro ao buscar solicitação" });
res.status(500).json({ error: "Erro ao verificar status" });
res.status(500).json({ error: "Erro ao obter estatísticas" });
```

### 2d. Adicionar rate limiting simples no POST /solicitacoes

Adicionar antes do `router.post`:

```ts
// Rate limit simples: máximo 10 submissões por usuário por hora
const submissionCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = submissionCounts.get(email);
  if (!entry || now > entry.resetAt) {
    submissionCounts.set(email, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}
```

E no início do handler do POST, antes das validações:

```ts
if (!checkRateLimit(user.email)) {
  res.status(429).json({ error: "Muitas solicitações. Tente novamente em 1 hora." });
  return;
}
```

---

## OBSERVAÇÕES

- Aplicar `clickup.ts` antes de `forms.ts` pois o mapa de status novo do clickup.ts é referenciado pelo forms.ts no sync de status
- O `CLICKUP_STATUS_MAP` usa `.toLowerCase()` antes do lookup — garantir que os novos status no mapa estão todos em minúsculas
- Os IDs das listas do ClickUp (`CLICKUP_LISTS`) não precisam de alteração — apenas o título e os status mudam
- O `taskStatus` inicial ao criar a task pode continuar como está (`"Solicitações"` para eventos, `"Para fazer"` para demais) — isso define o status inicial no ClickUp no momento da criação
