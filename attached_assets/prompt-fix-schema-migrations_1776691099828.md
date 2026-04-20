# Correção — Schema Drizzle + Migration SQL

---

## 1. `schema.ts` — Adicionar colunas novas na tabela `solicitacoes`

Localizar a definição da tabela `solicitacoesTable` e adicionar as colunas:

```ts
import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const solicitacoesTable = pgTable("solicitacoes", {
  // ... colunas existentes ...

  // ADICIONAR estas colunas se não existirem:
  titulo:          text("titulo"),
  clickup_url:     text("clickup_url"),
  avaliacao:       jsonb("avaliacao"),
});
```

Verificar se `clickup_task_id` já existe — se não, adicionar também:
```ts
clickup_task_id: text("clickup_task_id"),
```

---

## 2. Migration SQL — Rodar diretamente no banco PostgreSQL

Conectar ao banco PostgreSQL do projeto e executar:

```sql
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS clickup_url TEXT;
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS avaliacao JSONB;
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS clickup_task_id TEXT;
```

No Railway: Settings → PostgreSQL → Connect → rodar as queries acima.

---

## OBSERVAÇÕES

- Após editar `schema.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- A migration SQL deve ser rodada ANTES ou JUNTO com o build
- Sem a migration, o `forms.ts` falha silenciosamente ao tentar
  salvar `titulo`, `clickup_url` e `avaliacao` — o insert da
  solicitação funciona mas esses campos ficam null
- Verificar nos logs do Railway se há erros de "column does not exist"
  após o próximo envio de formulário
