# Scripts & Manutenção

Scripts one-off em `src/scripts/`. Todos são executados diretamente com `tsx` sem necessidade de build prévio.

---

## `migrate-assignments.ts`

**O que faz:** Migra os assignees de solicitações das variáveis de ambiente (`CLICKUP_ASSIGNEE_*`) para a tabela `user_tipo_assignments` no banco de dados. Cria usuários "stub" para IDs do ClickUp que ainda não existam em `usersTable`.

**Tabelas afetadas:** `usersTable`, `userTipoAssignmentsTable`

**Dry-run:** Não possui modo dry-run. Usa `onConflictDoNothing`, portanto é **seguro re-rodar** — não duplica dados.

**Pré-requisitos:** Variáveis `CLICKUP_ASSIGNEE_GERAL`, `CLICKUP_ASSIGNEE_EVENTOS`, `CLICKUP_ASSIGNEE_BRINDES`, `CLICKUP_ASSIGNEE_PATROCINIO` devem estar definidas no ambiente.

**Como rodar:**

```bash
pnpm --filter @workspace/api-server run migrate-assignments
# ou diretamente:
pnpm tsx artifacts/api-server/src/scripts/migrate-assignments.ts
```

**Quando usar:** Uma única vez após configurar os assignees iniciais, ou quando adicionar novos tipos com assignees via variáveis de ambiente.

---

## `import-cartoes.ts`

**O que faz:** Importa um histórico de pedidos de cartão de visita físico a partir de um arquivo CSV para as tabelas `solicitacoes` e `cartao_aprovacoes`. Útil para migrar dados de sistemas legados.

**Tabelas afetadas:** `solicitacoesTable` (INSERT), `cartaoAprovacoesTable` (INSERT), `usersTable` (SELECT para vincular e-mails)

**Dry-run:** **Sim — modo padrão é dry-run.** Sem `--apply`, apenas imprime o que seria importado e os erros de validação. Isso permite verificar o CSV antes de qualquer escrita.

**Parâmetros:**

| Flag | Descrição |
|---|---|
| `--csv <caminho>` | Caminho para o arquivo CSV de entrada |
| `--apply` | Executa a importação de verdade (sem essa flag, só faz dry-run) |

**Como rodar com segurança:**

```bash
# 1. Primeiro: inspecione sem modificar nada
pnpm tsx artifacts/api-server/src/scripts/import-cartoes.ts --csv /caminho/para/arquivo.csv

# 2. Verifique os erros e o preview no output

# 3. Quando tudo estiver ok, aplique:
pnpm tsx artifacts/api-server/src/scripts/import-cartoes.ts --csv /caminho/para/arquivo.csv --apply
```

**Quando usar:** Migração única de dados históricos. Não é um script de uso rotineiro.

---

## `seed-art-templates.ts`

**O que faz:** Semeia templates padrão de arte na tabela `art_templates` — especificamente para os tipos `cartao-boas-vindas` e `assinatura-email`, com variantes por marca.

**Tabelas afetadas:** `artTemplatesTable` (INSERT)

**Dry-run:** Não possui flag, mas é **idempotente** — verifica se já existe um template para o `tipo` antes de inserir. Re-rodar não duplica dados.

**Como rodar:**

```bash
pnpm --filter @workspace/api-server run seed-art-templates
# ou diretamente:
pnpm tsx artifacts/api-server/src/scripts/seed-art-templates.ts
```

**Quando usar:** Após limpar a tabela `art_templates` em ambiente de desenvolvimento, ou ao configurar um ambiente novo do zero.

---

## Checklist de manutenção rotineira

### Adicionar um novo usuário admin

1. Acesse `/admin-usuarios.html`
2. Clique em **Novo usuário**
3. Preencha e-mail, nome e selecione role **Admin**
4. Na primeira vez que o usuário logar via Microsoft, a sessão usará a role cadastrada

### Adicionar nova lista ClickUp

1. Acesse `/admin-clickup-lists.html`
2. Cole o ID da lista ClickUp (visível na URL da lista no ClickUp)
3. Vincule o tipo de solicitação desejado

### Verificar erros de geração automática

1. Acesse `/admin-log.html` e filtre por nível **error**
2. Ou consulte diretamente:
   ```sql
   SELECT id, tipo_solicitacao, titulo, erro_geracao, created_at
   FROM solicitacoes
   WHERE erro_geracao IS NOT NULL
   ORDER BY created_at DESC;
   ```

### Reprocessar uma arte com erro

> TODO: verificar se existe endpoint de reprocessamento manual ou se é necessário atualizar `status` direto no banco e re-disparar o webhook n8n.

### Limpar sessões expiradas

O `connect-pg-simple` cria a tabela `session` e faz limpeza automática de sessões expiradas. Não requer manutenção manual.

### Backup do banco

Configure backup automático no Railway (Settings → Backups) ou use `pg_dump` manualmente:

```bash
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```
