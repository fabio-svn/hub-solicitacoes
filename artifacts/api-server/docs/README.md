# Documentação Técnica — Hub de Solicitações SVN

Documentação para quem mantém e evolui o sistema. Toda afirmação está baseada no código do repositório.

## Índice

| Arquivo | Conteúdo |
|---|---|
| [visao-geral.md](visao-geral.md) | O que é o Hub, públicos, lista completa de tipos de solicitação |
| [arquitetura.md](arquitetura.md) | Stack, camadas, diagrama de fluxo, estrutura de pastas |
| [como-rodar.md](como-rodar.md) | Pré-requisitos, instalação, variáveis de ambiente, dev/build, Replit, Railway, scripts one-off |
| [frontend.md](frontend.md) | JS compartilhados, padrão das páginas de formulário, validação, submit |
| [backend.md](backend.md) | Rotas, fluxo do POST de criação, normalizeFormDados, geração de artefatos |
| [form-schemas.md](form-schemas.md) | Como o form-schemas.ts funciona, passo a passo para adicionar/editar tipo |
| [modelo-dados.md](modelo-dados.md) | Tabelas, campo `dados` (JSONB), convenção snake_case, resolução de labels |
| [integracoes.md](integracoes.md) | MSAL/Azure AD, ClickUp, Cloudflare R2, n8n/webhooks, MySQL Contatos |
| [admin-dashboard.md](admin-dashboard.md) | Painéis de acompanhamento, status, filtros, tombamentos |
| [scripts.md](scripts.md) | Scripts em src/scripts/, o que fazem, como rodar com segurança |
| [convencoes.md](convencoes.md) | Tokens de marca SVN, padrões de código, nomenclatura |

## Stack resumida

- **Runtime:** Node.js (ESM) + TypeScript, compilado com esbuild
- **Framework:** Express 5
- **Banco de dados:** PostgreSQL + Drizzle ORM
- **Sessão:** `express-session` persistida via `connect-pg-simple`
- **Autenticação:** Microsoft MSAL (Azure AD) — domínio `@svninvest.com.br`
- **Armazenamento de arquivos:** Cloudflare R2 (S3-compatible)
- **Gerenciamento de tarefas:** ClickUp (API)
- **Automações:** n8n via webhooks HTTP
- **Geração de arte:** `sharp`, `fontkit`, `pdf-lib`, `pdfkit`, `opentype.js`
- **Frontend:** HTML/CSS/JS vanilla (sem framework)
- **Logging:** `pino` + `pino-http`
