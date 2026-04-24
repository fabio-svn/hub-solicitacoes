# Hub de Solicitacoes SVN

## Overview
Internal request management web application for SVN Investimentos. Built as a pnpm workspace monorepo with vanilla HTML/CSS/JS frontend served by Express backend.

## Stack
- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Microsoft MSAL (Azure AD, @svninvest.com.br domain only)
- **Integrations**: ClickUp (task creation), Cloudflare R2 (file uploads)
- **Frontend**: Vanilla HTML/CSS/JS served statically from `artifacts/api-server/public/`
- **Build**: esbuild (CJS bundle)

## Architecture
- **Backend**: `artifacts/api-server/src/` - Express app with routes mounted directly in `app.ts`
  - `routes/auth.ts` - MSAL login/callback/logout/me
  - `routes/forms.ts` - Form submission, listing, stats, detail, status sync
  - `routes/admin.ts` - User management (admin only)
  - `routes/clickup.ts` - ClickUp task creation helper
  - `routes/r2.ts` - Cloudflare R2 file upload helper
  - `middleware/auth.middleware.ts` - Session-based auth middleware
- **Frontend**: `artifacts/api-server/public/` - Static HTML pages
  - `index.html` - Home page with video hero (dark theme)
  - `solicitacoes.html` - Category selection grid
  - `form-eventos.html` - Events form (7 steps, 6 combinations: Presencial/Online x 3 maturity levels)
  - `form-pagina-assessores.html` - Assessor page form with live preview modal
  - `form-assinatura-email.html` - Email signature form (N8N, svn_webhook_assinatura)
  - `form-cartao-visita.html` - Business card form (2-step: físico→ClickUp next Wed / digital→N8N svn_webhook_cartao_digital)
  - `form-cartao-boas-vindas.html` - Welcome card form (N8N, svn_webhook_boas_vindas)
  - `form-divulgacao-nps.html` - Arte NPS form (N8N, svn_webhook_nps)
  - `form-convite-fp.html` - Financial Planning invite form (N8N, svn_webhook_convite_fp)
  - `form-certificado-eventos.html` - Event certificate form (N8N, svn_webhook_certificado)
  - `form-pagina-online.html` - Online page form (ClickUp, 5 business days)
  - `form-outro.html` - Free-form request (ClickUp, 7 business days)
  - `form-apresentacoes.html` - Presentations form (subtipo: nova/atualizar)
  - `form-artes-divulgacao.html` - Art/design request form
  - `form-atualizacao-material.html` - Material update form
  - `form-criacao-pdf.html` - PDF creation form (subtipo: informativo/ebook)
  - `dashboard.html` - User dashboard with tabs, filters, pagination, drawer
  - `admin.html` - Admin panel with metrics, table view, user management
  - `thankyou.html` - Animated success page (dark theme)
  - `config.js` - All constants (categories, form routes, arrays, URLs)
  - `auth.js` - Auth helper with header rendering
  - `style.css` - Complete SVN visual identity

## Design System
- Fonts: Nunito Sans (UI) + Taviraj (headings/numbers)
- Colors: --ruby-red (#9f3f37), --carbon-black (#221B19), --paper-white (#fef8f4), --sage-green (#6f877b), --leather-brown (#381811)
- Logo: URL_LOGO_BRANCA (dark bg), URL_LOGO_PRETA (light bg) from config.js

## Database Schema
- `users` - id, email, name, role (colaborador/gestor/admin), created_at, updated_at
- `solicitacoes` - id, user_id, tipo_solicitacao, subtipo, maturidade, status, dados (jsonb), clickup_task_id, created_at, updated_at
- `arquivos` - id, solicitacao_id, campo, nome, url, created_at

## Key Commands
- `pnpm run typecheck` - full typecheck
- `pnpm --filter @workspace/db run push` - push DB schema changes
- `pnpm --filter @workspace/api-server run dev` - run API server

## Environment Variables Required
- MSAL_CLIENT_ID, MSAL_CLIENT_SECRET, MSAL_TENANT_ID, MSAL_REDIRECT_URI
- SESSION_SECRET
- DATABASE_URL
- CLICKUP_API_TOKEN
- R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
