# Feature — Responsável pela solicitação na página de resumo

---

## VISÃO GERAL

Salvar o nome do responsável no banco no momento da criação da task,
e exibir na página da solicitação como metadado discreto junto aos badges.

---

## 1. `schema.ts` — Adicionar coluna `responsavel`

```ts
// Na tabela solicitacoesTable, adicionar:
responsavel: text("responsavel"),
```

Migration SQL:
```sql
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS responsavel TEXT;
```

---

## 2. `clickup.ts` — Exportar nome do responsável

### 2a. Adicionar mapa de ID → nome

```ts
const ASSIGNEE_NOMES: Record<string, string> = {
  "55140303":  "João Sardeto",    // joao.sardeto — solicitações gerais
  "112032406": "Julia Rodrigues", // julia.rodrigues — eventos
};
```

### 2b. Retornar responsável junto com taskId e taskName

```ts
// Atualizar a assinatura de retorno:
export async function createClickUpTask(
  solicitacao: SolicitacaoData,
  user: UserData,
  dados: FormDados,
  arquivos?: ArquivosMap
): Promise<{ taskId: string | null; taskName: string; responsavel: string }> {

  // ... código existente ...

  // Antes do return final, determinar o nome do responsável:
  const assigneeId = tipo === "eventos" ? ASSIGNEE_EVENTOS : ASSIGNEE_GERAL;
  const responsavel = ASSIGNEE_NOMES[assigneeId] || "";

  return { taskId, taskName, responsavel };
}
```

---

## 3. `forms.ts` — Salvar responsável no banco

```ts
// Já existente — adicionar responsavel ao .set():
const { taskId, taskName, responsavel } = await createClickUpTask(...);

if (clickupTaskId) {
  await db.update(solicitacoesTable)
    .set({
      clickup_task_id: clickupTaskId,
      titulo: taskName || null,
      clickup_url: `https://app.clickup.com/t/${clickupTaskId}`,
      responsavel: responsavel || null, // ← adicionar
    })
    .where(eq(solicitacoesTable.id, solicitacao.id));
}
```

---

## 4. `solicitacao.html` — Exibir responsável nos metadados

### 4a. No `renderPage()`, adicionar responsável na linha de badges

Localizar o bloco `<div id="solBadges">` e adicionar após os badges
existentes (tipo, natureza, setor):

```js
// No innerHTML do solBadges, adicionar:
${item.responsavel ? `
  <span class="badge" style="background:var(--icon-bg);color:var(--carbon-black);display:inline-flex;align-items:center;gap:5px">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.5;flex-shrink:0">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
    ${esc(item.responsavel)}
  </span>
` : ''}
```

---

## OBSERVAÇÕES

- Após editar `clickup.ts`, `forms.ts` e `schema.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- Rodar a migration SQL no banco antes do build
- `solicitacao.html` não precisa de build
- Solicitações já criadas antes desta mudança terão `responsavel = null`
  e o badge simplesmente não aparece — sem quebrar nada
- Para atualizar solicitações antigas, seria necessário uma migration
  manual buscando o assignee de cada task no ClickUp — não obrigatório
- Se os IDs dos assignees mudarem no futuro, atualizar `ASSIGNEE_NOMES`
  em `clickup.ts` e os Secrets do Replit
