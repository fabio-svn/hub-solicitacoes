# Revisão estrutural — SVN Eventos

Relatório consolidado da auditoria do sistema, com plano de ação em prompts prontos pro Replit aplicar.

---

## 1. Sumário executivo

**O que o sistema é, na prática:**

- Backend: Node 20 + Express 5 + EJS + PostgreSQL (Railway)
- Auth: MSAL Microsoft + JWT em cookie httpOnly + magic link emergencial via SendGrid + webhook N8N
- Frontend: 100% EJS server-rendered. A landing pública (calendário) é EJS com JS client-side fazendo filtros sem reload. O admin é EJS server-rendered tradicional (recarrega a cada ação).
- Storage: Cloudflare R2 (via `@aws-sdk/client-s3` com endpoint custom)
- Integrações externas: ClickUp (via N8N), WhatsApp (Evolution via N8N), SendGrid

**O que o sistema NÃO é, apesar do `package.json`:**

- Não tem React, não tem Vite servindo nada em produção, não usa Drizzle ORM, não usa Passport, não usa express-session, não usa connect-pg-simple, não usa memorystore. Cerca de **50 dependências** instaladas são restos do scaffold inicial do Replit que nunca foram limpos.

**Saúde geral:** o código de negócio está sólido — rotas bem organizadas, RBAC funcional, fluxo de check-in elegante, sistema de undo bem pensado. O que tem é muito **peso morto** ao redor (deps, configs, schema fake) e algumas inconsistências menores que confundem leitura.

---

## 2. Achados por criticidade

### 🔴 Críticos

#### C1. Stack React+Vite+Drizzle inteiro é código morto

`server/index.ts` confirmou: nada de React é importado, nada de Drizzle é usado. Todas as queries são `pool.query()` com `pg` cru. Mas o `package.json` carrega:

- React stack: `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `recharts`, `framer-motion`, `embla-carousel-react`, `react-hook-form`, `react-day-picker`, `react-resizable-panels`, `react-icons`, `lucide-react`, `cmdk`, `vaul`, `next-themes`, `input-otp`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css`, `@hookform/resolvers`
- Todos os 30+ pacotes `@radix-ui/*`
- Vite/build: `vite`, `@vitejs/plugin-react`, `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal`, `@tailwindcss/vite`, `@tailwindcss/typography`
- Tailwind: `tailwindcss`, `autoprefixer`, `postcss` (CSS é todo escrito à mão em `/css/*.css`)
- Drizzle: `drizzle-orm`, `drizzle-zod`, `drizzle-kit`
- Tipos React: `@types/react`, `@types/react-dom`

#### C2. `shared/schema.ts` (Drizzle) está completamente desconectado do banco real

Conteúdo atual do arquivo:

```ts
users { id: serial, username: text, password: text }
events { id: serial, name: text, slug: text, partnerLogoUrl: text }
```

Banco real (de `db/schema-init.sql`): `users` é uuid com microsoft_id/role/email; `events` tem 30+ colunas. **Esse arquivo nunca foi escrito pelo time** — é boilerplate Replit. Confirma que Drizzle nunca foi usado. `drizzle.config.ts` aponta pra ele e pro path `./migrations` (que também está errado — migrations reais estão em `db/migrations/`).

#### C3. `script/build.ts` builda um frontend morto

```ts
console.log("building client...");
await viteBuild();   // ← roda Vite no client/, gera dist/public/, NUNCA é servido

console.log("building server...");
await esbuild({...});
```

O `server/index.ts` só serve `path.join(__dirname, "..", "public")`, nunca `dist/public`. O `viteBuild()` está rodando a cada deploy gerando bundle que ninguém consome. Tempo de build perdido.

Além disso, a `allowlist` do esbuild inclui `passport`, `passport-local`, `connect-pg-simple`, `memorystore`, `xlsx`, `nanoid`, `nodemailer`, `axios`, `cors`, `stripe`, `openai`, `@google/generative-ai` — várias deps que nem existem no projeto, ou existem mas não são usadas. É um boilerplate genérico que ninguém revisou.

#### C4. Conflito Tailwind v3 vs v4

`package.json` tem `tailwindcss: ^3.4.17` (deps) e `@tailwindcss/vite: ^4.1.18` (devDeps). O `tailwind.config.ts` é v3. O Vite config carrega o plugin v4. Já que nem é usado, isso é só desperdício de instalação — mas se você tentar reativar Tailwind pra alguma coisa, vai dar bug. Resolve com C1 (remover tudo).

#### C5. Bug funcional: `req.user.role === 'colaborador'` em `routes/admin.ts:80`

```ts
let checkinEnabled = true;
if (req.user!.role === 'colaborador') {
  // ... lógica que decide se desabilita botão ...
  checkinEnabled = colaboradorEventsRes.rows.length > 0;
}
```

A role `colaborador` **não existe** no sistema. O schema (`db/schema-init.sql:81`) e a UI de criar/editar usuário (`views/admin/user-detail.ejs`) só aceitam `admin`, `manager`, `head`. Resultado: `checkinEnabled` é sempre `true`, o branch interno é dead code, e o botão "Fazer check-in" no dashboard **nunca fica disabled**.

Qual é a intenção real? Provavelmente a função `getEventosFiltro` em `eventFilter.ts` deixa pista: o comentário diz "For unknown/future roles, deny access. An owner-based filter would require an owner_id/owner_email column on events, which does not currently exist." Ou seja, o `'colaborador'` foi planejado como uma quarta role mas nunca foi implementado completo. Hoje é dead code que deveria sair.

#### C6. Três sistemas de auth coexistindo (só MSAL+JWT está ativo)

Confirmado pelo `server/index.ts` — só são montados `cookieParser`, MSAL e JWT. Mas instalados estão:
- `passport` + `passport-local`: zero imports no projeto
- `express-session`: zero imports
- `connect-pg-simple`: zero imports
- `memorystore`: zero imports
- `@types/passport`, `@types/passport-local`, `@types/express-session`, `@types/connect-pg-simple`: zero uso

Tudo herdado do scaffold. Sai com C1.

#### C7. Schema-init no boot + migrations versionadas convivendo

`server/index.ts` chama `runSchemaInit()` no boot, que executa **o `db/schema-init.sql` inteiro** (idempotente via `IF NOT EXISTS`). Existe também `db/migrations/001/002/003.sql` que **não estão sendo aplicadas em lugar nenhum** — só servem como histórico humano.

Isso é confuso e perigoso a longo prazo: se alguém adicionar uma migration nova esperando que ela rode, ela não roda. E se alguém atualizar o `schema-init.sql` pra refletir uma migration, está duplicando a fonte da verdade.

---

### 🟠 Altos

#### A1. Falta `engines` no `package.json`

Sem `"engines": { "node": ">=20.0.0" }`, o Railway pode escolher uma Node version diferente da do dev (ex: Node 22 quando você testou em Node 20), e bugs sutis aparecem só em produção.

#### A2. CSS gigante e duplicado

`admin.css` tem 2206 linhas, `landing.css` 1193, `calendario.css` 742. 4622 linhas total. Boa parte das regras provavelmente é morta ou duplicada (resíduo do scaffold + iterações). Não é bloqueante mas vale uma passada de PurgeCSS ou auditoria manual.

#### A3. Template HTML do magic link duplicado em 2 lugares

Em `routes/auth.ts`, o HTML do email do magic link aparece literalmente copiado-e-colado em `/login` (linhas 254-269) e em `/emergency-check` (linhas 87-101) — uns 30 linhas idênticas. Se você quiser mudar o template, tem que lembrar de mudar nos dois.

#### A4. Magic link via POST `/login` é caminho normal mas nem sempre funciona

`routes/auth.ts:209` aceita POST `/login` com email, gera magic link, envia por SendGrid. Mas só funciona se `user.allow_magic_link === true`. Se o time todo já entra via Microsoft SSO, esse fluxo deveria ser **só de emergência** (`/emergency-check`) — o POST `/login` é redundante e duplica a lógica do `/emergency-check`.

#### A5. Notification scheduler depende de `setInterval` JS

`server/index.ts:120` faz:
```ts
runNotificationScheduler();
setInterval(runNotificationScheduler, 60 * 1000);
```

E o scheduler usa janela de 60s pra disparar (`inWindow(target)` checa se totalSec ∈ [target, target+59]).

Problema: `setInterval` em Node não é preciso — pode atrasar (sob carga) ou drift ao longo do dia. Se o intervalo atrasar mais que 60s, **a notificação é pulada** (a janela passou). Se rodar 2x rápido, está OK porque `notification_logs` é idempotente por dia.

Você já tem N8N rodando 24/7. Em vez do setInterval, exponha um endpoint protegido `/api/run-scheduler` (com API key) e deixe o N8N chamar a cada minuto via cron. Isso é mais robusto e separa responsabilidades.

#### A6. `VALID_UNIDADE_CODES` em `eventFilter.ts` tem códigos que não estão na lista oficial

Lista oficial (das 36 unidades SVN): ADM, ALO, AJU, CAM, CGR, RH, CVV, COR, CBA, CTB, CTBDGT, DIG, FIN, FOZ, INST, JUR, LDN, MGF, MGFDGT, MKT, MKTDGT, PER, MID, PRO, RF, RV, SSA, SAO, SAODGT, CONN, GEST, GLO, IMB, USVN, VDC, WEAL.

No arquivo, além desses 36, aparecem `'001', 'FUT', 'PAST'`. Provavelmente são prefixos de eventos legacy (tipo `P-001-2024-...` ou eventos genéricos `P-FUT-...`). Vale confirmar:
- Se são intencionais, documentar com comentário no código
- Se são lixo de testes antigos, remover
- Se são genéricos/curinga, isolar lógica

Como `extractUnidadeFromEventId()` extrai o segmento por posição (`split('-')[1]`), qualquer evento com `event_id` no formato `[TIPO]-[X]-...` vira "unidade X". Se um head tem `001` ou `FUT` na lista de unidades dele, ele vê esses eventos. Hoje isso é silencioso e pode dar acesso indevido.

#### A7. Helmet com CSP desabilitado

`server/index.ts:39`:
```ts
app.use(helmet({ contentSecurityPolicy: false, frameguard: false }));
```

CSP off é uma decisão razoável quando se tem JS inline em EJS (e o sistema tem MUITO JS inline). Mas vale documentar a decisão num comentário, e considerar mover scripts inline pra arquivos `.js` em `/public/js/` pra reabilitar CSP no futuro. `frameguard: false` permite o site ser embedado em iframe — provavelmente intencional pra permitir embed do calendário no `portalsvn.com.br`, mas vale confirmar.

---

### 🟡 Médios

#### M1. Lógica de fechar evento ao atingir limite duplicada

Em `routes/api.ts:203` (POST `/register`) e... parcialmente em `closePastEvents()` em `server/index.ts:23` (que só fecha por data, não por limite). Não é exatamente "duplicada", mas a lógica de transição de estado de evento está espalhada — vale centralizar num helper `updateEventStatus(event_id)` que checa data + limite + cancelamento.

#### M2. Switch gigante de undo (11 cases) em `routes/admin.ts:928-1026`

Funciona, mas não escala: cada novo `action_type` força edição do switch. Padrão melhor é um map de handlers:

```ts
const undoHandlers: Record<string, (d: any) => Promise<void>> = {
  event_update: async (d) => { /* ... */ },
  event_notifications: async (d) => { /* ... */ },
  // ...
};
```

E no handler, só `await undoHandlers[type]?.(d)`. Refator opcional, não bloqueante.

#### M3. Order matter de mounts `/admin`

```ts
app.use("/admin", uploadRoutes);
app.use("/admin", adminRoutes);
```

Funciona porque `uploadRoutes` só define `POST /upload-image` e o resto cai no `adminRoutes`. Mas isso confunde leitura. Melhor mover `/upload-image` pra dentro do `adminRoutes` com `app.post('/admin/upload-image', ...)` ou montar em `/admin/upload` como subgrupo.

#### M4. Webhook N8N URL hardcoded em vários lugares

- `routes/auth.ts`: `https://auto.portalsvn.com.br/webhook/magic-link`
- `routes/api.ts`: webhook de inscrição (`e1910944-...`) com if NODE_ENV pra escolher prod vs test
- `server/notifications.ts`: webhook de notificações (`da2f886a-...`)

URLs literais espalhadas. Centralizar num `config/webhooks.ts` melhora manutenção e evita bug do tipo "esqueci de atualizar a URL no dev".

#### M5. Endpoint `/admin/checkin-events` retorna JSON mas vive sob `/admin`

Convenção do sistema é que `/admin/*` retorna HTML EJS e `/api/*` retorna JSON. Esse endpoint quebra a convenção. Não é bug, mas vale mover pra `/api/admin/checkin-events` (com `requireAuth` em vez de `requireApiKey`) ou pelo menos documentar.

---

### 🟢 Baixos

#### B1. Três versões de `cookie-signature` no lockfile

`1.0.6` (de `cookie-parser`), `1.0.7` (de `express-session`), `1.2.2` (de `express` 5). Não é bloqueante. Resolve sozinho quando você remover `express-session` (C6).

#### B2. Comentário de "owner-based filter" em `eventFilter.ts:50`

```ts
// For unknown/future roles, deny access. An owner-based filter would require
// an owner_id/owner_email column on events, which does not currently exist.
```

Sugere que houve plano de adicionar uma 4ª role (`colaborador`?) com filtro por owner. Decidir: ou implementa de verdade, ou remove o comentário e o branch dead code (C5).

#### B3. `console.log(\`[dev] Magic link para ${user.email}: ${magicLink}\`)`

Em dev, o magic link aparece no log do servidor. OK pra dev, mas se essa string vazar em algum sistema de log centralizado de produção, é um leak de credencial. `routes/auth.ts:122` e `:292`. Garantir que `process.env.NODE_ENV === 'production'` realmente cobre todos os ambientes onde logs são persistidos.

---

## 3. Plano de ação — Prompts pro Replit

Os prompts estão agrupados em **4 fases** em ordem recomendada de execução. Cada fase é independente (você pode parar entre fases). Dentro de uma fase, os prompts devem ser aplicados na ordem dada.

### Fase 1 — Limpeza estrutural

Sem mudança funcional. Reduz dramaticamente o `node_modules` e remove confusão de leitura.

#### PROMPT 1.1 — Remover stack React/Vite/Drizzle/Passport/Sessions

```
Contexto: este projeto SVN Eventos é um app Node.js/Express 5 + EJS server-rendered + PostgreSQL puro. NÃO USA React, Vite, Tailwind, Drizzle ORM, Passport ou express-session. Essas dependências são herança do scaffold inicial do Replit que nunca foram limpas.

Tarefas:

1. Editar package.json — remover das "dependencies" (manter o resto):
   - @hookform/resolvers
   - Todos os pacotes @radix-ui/* (são ~30)
   - @tanstack/react-query
   - class-variance-authority
   - clsx
   - cmdk
   - connect-pg-simple
   - drizzle-orm
   - drizzle-zod
   - embla-carousel-react
   - express-session
   - framer-motion
   - input-otp
   - lucide-react
   - memorystore
   - next-themes
   - passport
   - passport-local
   - react
   - react-day-picker
   - react-dom
   - react-hook-form
   - react-icons
   - react-resizable-panels
   - recharts
   - tailwind-merge
   - tailwindcss-animate
   - tw-animate-css
   - vaul
   - wouter

2. Editar package.json — remover das "devDependencies":
   - @replit/vite-plugin-cartographer
   - @replit/vite-plugin-dev-banner
   - @replit/vite-plugin-runtime-error-modal
   - @tailwindcss/typography
   - @tailwindcss/vite
   - @types/connect-pg-simple
   - @types/passport
   - @types/passport-local
   - @types/express-session
   - @types/react
   - @types/react-dom
   - @vitejs/plugin-react
   - autoprefixer
   - drizzle-kit
   - postcss
   - tailwindcss
   - vite

3. Editar package.json — remover do bloco "scripts": "db:push" (era o Drizzle).

4. Remover do projeto (deletar arquivos):
   - shared/ (pasta inteira — schema.ts era boilerplate fake desconectado do banco real)
   - drizzle.config.ts
   - vite.config.ts
   - tailwind.config.ts
   - postcss.config.js (se existir)
   - client/ (pasta inteira, se existir — eram restos do scaffold React)
   - attached_assets/ (pasta, se existir e estiver vazia ou com lixo do scaffold)

5. Editar script/build.ts:
   - Remover o import "import { build as viteBuild } from 'vite';" e a chamada "await viteBuild();"
   - Remover o console.log("building client...")
   - Reescrever a allowlist do esbuild para conter APENAS as deps que sobrevivem à limpeza acima. A nova allowlist deve ser exatamente:
     ["@aws-sdk/client-s3", "@aws-sdk/lib-storage", "@azure/msal-node", "@types/cookie-parser", "@types/jsonwebtoken", "@types/multer", "@types/qrcode", "cookie-parser", "date-fns", "dotenv", "ejs", "express", "express-rate-limit", "helmet", "jsonwebtoken", "multer", "pg", "qrcode", "ws", "zod", "zod-validation-error"]

6. Rodar `rm -rf node_modules package-lock.json && npm install` no Shell.

7. Garantir que `npm run dev` ainda inicia o servidor sem erros.

8. NÃO MUDAR nenhuma rota, view, CSS, lógica de negócio ou schema do banco. Esta é uma limpeza puramente de dependências e scaffold.

Critério de teste: após a limpeza, o sistema deve subir, login Microsoft funcionar, calendário público abrir, dashboard admin abrir, e nenhum erro novo no console.
```

#### PROMPT 1.2 — Adicionar `engines` no package.json

```
Contexto: o projeto não declara versão de Node. Em produção no Railway, isso pode causar bugs sutis se o Railway escolher uma Node version diferente da do dev.

Tarefa: adicionar ao package.json o bloco:

  "engines": {
    "node": ">=20.0.0"
  }

Coloque-o logo após a linha "type": "module" e antes de "license".

Não mudar mais nada.
```

#### PROMPT 1.3 — Centralizar template HTML do email do magic link

```
Contexto: em routes/auth.ts, o template HTML do email do magic link está copiado-e-colado em dois handlers (POST /login e POST /emergency-check), com cerca de 30 linhas idênticas em cada. Isso obriga manter os dois sincronizados manualmente.

Tarefa:

1. No topo de routes/auth.ts (depois dos imports), criar uma função helper:

   function buildMagicLinkEmailHtml(userName: string, magicLink: string): string {
     return `
       <div style="font-family: 'Nunito Sans', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #221B19;">
         ... (mesmo conteúdo HTML que está hoje duplicado) ...
       </div>
     `;
   }

2. Substituir o HTML inline em ambos os handlers (POST /login e POST /emergency-check) pela chamada:
   value: buildMagicLinkEmailHtml(user.name, magicLink)

3. NÃO mudar texto, estilo, estrutura visual ou lógica de envio. Só extrair pra função compartilhada.

Critério de teste: enviar um magic link via /login e via /emergency-check; o email recebido deve estar idêntico ao que era antes.
```

---

### Fase 2 — Correção de bugs

Sem mudança visual; ajusta inconsistências internas.

#### PROMPT 2.1 — Remover dead code do role `colaborador`

```
Contexto: em routes/admin.ts, na rota GET /admin (dashboard, linha ~80), tem este trecho:

  let checkinEnabled = true;
  if (req.user!.role === 'colaborador') {
    const colaboradorEventsRes = await pool.query(...);
    checkinEnabled = colaboradorEventsRes.rows.length > 0;
  }

A role 'colaborador' não existe no sistema — as roles válidas são apenas 'admin', 'manager' e 'head' (ver db/schema-init.sql e views/admin/user-detail.ejs). Esse branch nunca executa.

Tarefa:

1. Substituir o bloco acima por:

   // checkinEnabled fica true para todas as roles atuais (admin/manager/head).
   // Se no futuro for criada uma role 'colaborador' com filtro por owner_id em events,
   // esta lógica deve ser revisitada.
   const checkinEnabled = true;

2. NÃO mexer na rota GET /admin/checkin-events (ela já trata corretamente os 3 papéis e o else genérico).

3. Em server/helpers/eventFilter.ts, remover o comentário "// For unknown/future roles, deny access. An owner-based filter would require an owner_id/owner_email column on events, which does not currently exist." e substituir por:

   // Roles válidas: admin (vê tudo), head (filtro por unidade), manager (filtro por user_event_access).
   // Qualquer outra role retorna AND 1=0 (deny by default).

Critério de teste: o botão "Fazer check-in" no dashboard deve continuar visível e habilitado para admin/manager/head. Nenhum comportamento muda na prática.
```

#### PROMPT 2.2 — Documentar e auditar códigos especiais em `VALID_UNIDADE_CODES`

```
Contexto: em server/helpers/eventFilter.ts, a constante VALID_UNIDADE_CODES contém os 36 códigos de unidade oficiais SVN, mas também contém '001', 'FUT' e 'PAST'. Esses 3 não fazem parte da lista oficial e provavelmente são prefixos de eventos legacy ou de testes antigos.

Tarefa:

1. Reorganizar a constante separando claramente os blocos:

   // Códigos oficiais das 36 unidades SVN
   const UNIDADES_OFICIAIS: readonly string[] = [
     'ADM', 'ALO', 'AJU', 'CAM', 'CGR', 'RH',  'CVV', 'COR', 'CBA', 'CTB',
     'CTBDGT', 'DIG', 'FIN', 'FOZ', 'INST', 'JUR', 'LDN', 'MGF', 'MGFDGT',
     'MKT', 'MKTDGT', 'PER', 'MID', 'PRO', 'RF', 'RV', 'SSA', 'SAO', 'SAODGT',
     'CONN', 'GEST', 'GLO', 'IMB', 'USVN', 'VDC', 'WEAL',
   ];

   // Códigos legacy/especiais que aparecem em event_ids antigos.
   // TODO: investigar se ainda existem eventos com esses prefixos no banco
   //       (rodar `SELECT DISTINCT split_part(event_id, '-', 2) FROM events`).
   //       Se não houver, remover daqui.
   const UNIDADES_LEGACY: readonly string[] = ['001', 'FUT', 'PAST'];

   export const VALID_UNIDADE_CODES: readonly string[] = [
     ...UNIDADES_OFICIAIS,
     ...UNIDADES_LEGACY,
   ];

2. Em getAvailableUnidades(), retornar APENAS UNIDADES_OFICIAIS ordenadas (não exibir os legacy na UI de atribuir unidades a heads):

   export function getAvailableUnidades(): string[] {
     return [...UNIDADES_OFICIAIS].sort();
   }

   Validação (validateUnidadeCodes) continua aceitando todos (oficiais + legacy) — porque heads existentes podem já ter esses códigos atribuídos historicamente, e queremos manter compatibilidade até a auditoria do TODO acima.

Critério de teste: na página de editar usuário (perfil head), os checkboxes de unidades devem mostrar apenas os 36 códigos oficiais — sem 001/FUT/PAST. Heads que já tinham esses códigos atribuídos continuam funcionando.
```

#### PROMPT 2.3 — Simplificar fluxo de magic link (manter só emergency)

```
Contexto: em routes/auth.ts, o handler POST /login é um caminho de "login normal" via magic link. Mas o sistema tem MSAL Microsoft como auth principal — o magic link só faz sentido como acesso emergencial (quando MSAL está fora do ar ou o user não tem conta Microsoft). O caminho POST /login duplica a lógica do /emergency-check.

Tarefa:

1. REMOVER por completo o handler POST /login (linhas que começam com `router.post('/login', loginLimiter, ...)`).

2. Em GET /login, manter o render da página de login mas garantir que o botão "Entrar com Microsoft" seja o único caminho normal. O link "Acesso emergencial" continua existindo e leva pra /auth/emergency-check (que já faz tudo que o POST /login fazia).

3. Em views/auth/login.ejs, remover qualquer formulário <form method="POST" action="/auth/login"> se ainda existir. O botão de Microsoft (link pra /auth/microsoft) e o link pra /auth/emergency-check são suficientes.

Critério de teste:
- Tentar fazer login com Microsoft → funciona normalmente
- Acessar /auth/login → vê só botão Microsoft + link "Acesso emergencial"
- Acessar /auth/emergency-check, digitar email autorizado → recebe magic link como antes
```

---

### Fase 3 — Robustez e arquitetura (opcional)

Mudanças que melhoram operação a longo prazo. Não bloqueiam nada hoje.

#### PROMPT 3.1 — Mover scheduler de notificações pra cron N8N

```
Contexto: hoje, server/index.ts roda runNotificationScheduler() a cada 60 segundos via setInterval JavaScript. setInterval em Node não é preciso (drift, atraso sob carga), e o scheduler tem janela de detecção de 60s — se o intervalo atrasar, a notificação é pulada.

A SVN já tem N8N rodando 24/7 com cron confiável. Vamos delegar o agendamento.

Tarefa:

1. Em server/index.ts, REMOVER as linhas:
   - runNotificationScheduler();
   - setInterval(runNotificationScheduler, 60 * 1000);
   - O import de runNotificationScheduler de "./notifications.js" pode ser removido se não for mais usado (mas o sendCancelationWebhook continua sendo importado em routes/admin.ts, então notifications.ts continua existindo).

2. Em routes/api.ts, ADICIONAR uma nova rota:

   router.post('/run-scheduler', requireApiKey, async (req: Request, res: Response) => {
     try {
       await runNotificationScheduler();
       res.json({ success: true, ran_at: new Date().toISOString() });
     } catch (err) {
       console.error('Scheduler error:', err);
       res.status(500).json({ error: 'Erro ao executar scheduler' });
     }
   });

   E adicionar o import: import { runNotificationScheduler } from '../server/notifications.js';

3. NÃO mudar a lógica interna de runNotificationScheduler em server/notifications.ts. Ela continua igual.

4. closePastEvents continua rodando dentro do servidor a cada hora (server/index.ts, setInterval de 60*60*1000) — ou também pode ser movido pra N8N como bonus, mas não é obrigatório agora.

Critério de teste:
- POST https://eventos-url/api/run-scheduler com header x-api-key: <chave>  → deve responder { success: true, ran_at: ... }
- Configurar workflow N8N com cron "every minute" chamando esse endpoint
- Verificar que notificações continuam saindo nos horários certos
```

#### PROMPT 3.2 — Consolidar schema-init.sql vs migrations

```
Contexto: hoje o projeto tem dois sistemas de schema convivendo:

a) db/schema-init.sql — roda no boot, idempotente (tem IF NOT EXISTS / ALTER TABLE IF NOT EXISTS), define tudo
b) db/migrations/001/002/003.sql — versionadas, mas NÃO são executadas em lugar nenhum (são só histórico)

Isso causa drift: se alguém adicionar uma migration nova, ela não roda. Se atualizar schema-init.sql pra refletir uma migration, está duplicando a verdade.

Decisão recomendada: manter SÓ schema-init.sql (idempotente, simples), arquivar as migrations como histórico em outra pasta.

Tarefa:

1. Mover db/migrations/ para uma pasta de histórico:
   mv db/migrations docs/historico-migrations

2. Adicionar um README no novo lugar (docs/historico-migrations/README.md):

   # Histórico de migrations

   Estes arquivos representam mudanças aplicadas ao schema antes da consolidação
   no `db/schema-init.sql`. NÃO são executados em produção. Servem apenas como
   histórico de evolução do banco.

   Para mudanças futuras de schema:
   1. Editar `db/schema-init.sql` adicionando o ALTER TABLE / CREATE com IF NOT EXISTS
   2. Testar localmente com banco vazio rodando `psql < db/schema-init.sql` duas vezes
   3. Deploy no Railway — runSchemaInit() roda automaticamente no boot

3. Em db/init.ts, adicionar comentário explicativo:

   // schema-init.sql é a fonte única da verdade do schema.
   // Roda no boot do servidor em modo idempotente (IF NOT EXISTS em todas as DDLs).
   // Para histórico de mudanças anteriores, ver docs/historico-migrations/.

Critério de teste: deploy no Railway deve subir normalmente. Banco existente não muda.
```

---

### Fase 4 — Qualidade de código (opcional, sem urgência)

#### PROMPT 4.1 — Centralizar URLs de webhook N8N

```
Contexto: URLs de webhook do N8N estão espalhadas em 3 arquivos diferentes:
- routes/auth.ts: webhook de magic link
- routes/api.ts: webhook de inscrição (com if NODE_ENV pra escolher prod vs test)
- server/notifications.ts: webhook de notificações

Tarefa:

1. Criar arquivo server/config/webhooks.ts:

   const N8N_BASE = 'https://auto.portalsvn.com.br';
   const isProduction = process.env.NODE_ENV === 'production';
   const webhookSegment = isProduction ? 'webhook' : 'webhook-test';

   export const WEBHOOKS = {
     magicLink:    `${N8N_BASE}/${webhookSegment}/magic-link`,
     registration: `${N8N_BASE}/${webhookSegment}/e1910944-94fc-4596-abba-888452042cce`,
     notifications: `${N8N_BASE}/${webhookSegment}/da2f886a-4952-4290-ae59-9d849eed6e46`,
   } as const;

   Atenção: o webhook de magic link em routes/auth.ts usa /webhook/magic-link em prod e em dev hoje (sem distinção webhook-test). Manter esse comportamento — ou seja, hardcoded como `${N8N_BASE}/webhook/magic-link` se não houver versão test.

2. Em routes/auth.ts, importar WEBHOOKS e substituir 'https://auto.portalsvn.com.br/webhook/magic-link' por WEBHOOKS.magicLink.

3. Em routes/api.ts, substituir o trecho `const webhookUrl = process.env.NODE_ENV === 'production' ? '...' : '...';` por const webhookUrl = WEBHOOKS.registration.

4. Em server/notifications.ts, substituir a função webhookUrl() pelo uso direto de WEBHOOKS.notifications.

Critério de teste: inscrição num evento, magic link e notificação automática continuam disparando os webhooks corretos.
```

#### PROMPT 4.2 — Refatorar switch de undo com handlers

```
Contexto: em routes/admin.ts, a rota POST /admin/action-logs/:id/undo tem um switch com 11 cases (~100 linhas). A cada novo action_type adicionado no sistema, é necessário lembrar de adicionar um case aqui — fácil esquecer.

Tarefa:

1. Antes da definição da rota, criar um map de handlers:

   type UndoHandler = (details: any) => Promise<{ ok: boolean; error?: string }>;

   const undoHandlers: Record<string, UndoHandler> = {
     event_update: async (d) => {
       const before = d.before || {};
       const fields = Object.keys(before);
       if (!fields.length || !d.event_id) return { ok: false, error: 'Sem dados anteriores' };
       const setClauses = fields.map((f, i) => `${f} = $${i + 1}`);
       const values = fields.map(f => before[f]);
       values.push(d.event_id);
       await pool.query(`UPDATE events SET ${setClauses.join(', ')}, updated_at = NOW() WHERE event_id = $${fields.length + 1}`, values);
       return { ok: true };
     },
     event_notifications: async (d) => { /* ... */ },
     access_grant: async (d) => { /* ... */ },
     access_revoke: async (d) => { /* ... */ },
     checkin: async (d) => { /* ... */ },
     checkin_undo: async (d) => { /* ... */ },
     registration_delete: async (d) => { /* ... */ },
     user_edit: async (d) => { /* ... */ },
     inviter_add: async (d) => { /* ... */ },
     inviter_delete: async (d) => { /* ... */ },
     profile_update: async (d) => { /* ... */ },
   };

   const NON_UNDOABLE = new Set(['user_create', 'user_delete', 'undo']);

2. Reescrever a rota para usar o map:

   router.post('/action-logs/:id/undo', requireAuth(['admin']), async (req, res) => {
     try {
       const logResult = await pool.query('SELECT * FROM action_logs WHERE id = $1', [req.params.id]);
       if (!logResult.rows.length) return res.status(404).json({ error: 'Log não encontrado' });

       const log = logResult.rows[0];
       const type = log.action_type;
       const d = log.details;

       if (!type || NON_UNDOABLE.has(type)) {
         return res.status(400).json({ error: 'Esta ação não pode ser desfeita' });
       }
       if (!d) return res.status(400).json({ error: 'Sem dados para desfazer esta ação' });

       const handler = undoHandlers[type];
       if (!handler) return res.status(400).json({ error: 'Tipo de ação não reconhecido' });

       const result = await handler(d);
       if (!result.ok) return res.status(400).json({ error: result.error || 'Erro ao desfazer' });

       await pool.query(
         'INSERT INTO action_logs (action, user_name, action_type, details) VALUES ($1, $2, $3, $4)',
         [`Desfez ação: ${log.action}`, req.user!.name, 'undo', JSON.stringify({ original_log_id: log.id, original_action_type: type })]
       );

       res.json({ success: true });
     } catch (err) {
       console.error('Undo error:', err);
       res.status(500).json({ error: 'Erro ao desfazer ação' });
     }
   });

3. Mover a lógica de cada case do switch original pra dentro do handler correspondente. Não mudar comportamento.

Critério de teste: testar desfazer cada tipo de ação (editar evento, conceder acesso, check-in, deletar inscrição, etc.) pelo modal de detalhes em /admin/users. Comportamento deve ser idêntico ao atual.
```

---

## 4. Resumo executivo final

**Aplicando só a Fase 1**, você ganha:
- `node_modules` cai de ~600 MB pra ~150 MB
- Build mais rápido (sem `viteBuild` desnecessário)
- `package.json` legível, com a stack real visível
- Zero risco — não muda funcionalidade

**Aplicando Fase 1 + Fase 2**, você ganha:
- Tudo de Fase 1
- Roles consistentes em todo o código (sem dead code de `colaborador`)
- Validação de unidades alinhada com a realidade SVN
- Fluxo de auth limpo (Microsoft normal, magic link só emergência)

**Fases 3 e 4 são opcionais** e podem ser feitas quando você tiver tempo, sem urgência.

**Recomendação prática:** aplicar Fase 1 hoje. Validar que tudo continua funcionando em prod por 1 semana. Depois aplicar Fase 2. Fases 3/4 quando precisar mexer naquela parte do código por qualquer outro motivo.
