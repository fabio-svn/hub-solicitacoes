# Novos assignees — Patrocínio e Brindes

## 1. Replit Secrets — adicionar

```
CLICKUP_ASSIGNEE_PATROCINIO=55127950
CLICKUP_ASSIGNEE_BRINDES=99968866
```

## 2. `clickup.ts` — atualizar assignees por tipo

### 2a. Adicionar constantes no topo (junto com ASSIGNEE_GERAL e ASSIGNEE_EVENTOS):

```ts
const ASSIGNEE_PATROCINIO = process.env.CLICKUP_ASSIGNEE_PATROCINIO || "";
const ASSIGNEE_BRINDES    = process.env.CLICKUP_ASSIGNEE_BRINDES    || "";
```

### 2b. Atualizar ASSIGNEE_NOMES:

```ts
const ASSIGNEE_NOMES: Record<string, string> = {
  "55140303":  "João Sardeto",
  "112032406": "Julia Rodrigues",
  "55127950":  "Responsável Patrocínio",   // ← substituir pelo nome real
  "99968866":  "Responsável Brindes",      // ← substituir pelo nome real
};
```

### 2c. Atualizar bloco de assignee em createClickUpTask():

```ts
// DE:
const assigneeId = tipo === "eventos" ? ASSIGNEE_EVENTOS : ASSIGNEE_GERAL;

// PARA:
const assigneeId =
  tipo === "eventos"    ? ASSIGNEE_EVENTOS    :
  tipo === "patrocinio" ? ASSIGNEE_PATROCINIO :
  tipo === "brindes"    ? ASSIGNEE_BRINDES    :
  ASSIGNEE_GERAL;
```

---

## OBSERVAÇÕES

- `clickup.ts` precisa de build após edições
- Adicionar os 2 Secrets no Replit antes do build
- Substituir "Responsável Patrocínio" e "Responsável Brindes" pelos
  nomes reais dos usuários — o nome aparece no badge de responsável
  na página de resumo da solicitação
