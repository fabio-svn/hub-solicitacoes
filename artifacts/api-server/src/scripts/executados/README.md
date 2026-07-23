# Scripts ja executados

Migracoes e diagnosticos de uso unico que ja rodaram em producao. Ficam aqui
para consulta (o que foi feito, e como) sem parecer parte do fluxo normal.

Os scripts vivos continuam em `src/scripts/` e tem entrada no `package.json`:
`migrate-assignments` e `seed-art-templates`.

| Script | O que faz |
|---|---|
| `add-plataforma-convite.ts` | Adiciona o campo de plataforma nos convites |
| `diag-art-templates.ts` | Diagnostico dos templates de arte |
| `import-cartoes.ts` | Importacao inicial dos cartoes |
| `normalizar-assessores.ts` | Normaliza codigo e nome dos assessores |
| `set-chapeu.ts` | Define o chapeu (categoria) das solicitacoes |

Para rodar um deles de novo: `pnpm --filter @workspace/api-server exec tsx src/scripts/executados/<arquivo>`
