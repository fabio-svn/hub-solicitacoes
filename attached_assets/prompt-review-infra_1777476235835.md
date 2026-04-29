# Revisão infra — app.ts, build.mjs, package.json, tsconfig.json

---

## 1. `app.ts` — 6 correções

### 1a. `/api/config` expõe dados sem autenticação e com cache público

```ts
// O endpoint /api/config está FORA do middleware de auth (app.use("/api", router))
// e tem Cache-Control: public, max-age=300 — qualquer pessoa sem autenticação
// pode acessar as URLs internas, email de upload, etc.
// Não são dados críticos, mas URLs de R2 e email corporativo ficam expostos.
// Mover para dentro do router autenticado OU manter público mas remover
// o Cache-Control público:

app.get("/api/config", (_req, res) => {
  res.set('Cache-Control', 'private, max-age=300'); // ← 'private' em vez de 'public'
  res.json({ ... });
});
```

### 1b. CORS com origem única — não suporta múltiplas origens (dev + prod)

```ts
// DE:
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://hub.portalsvn.com.br',
  credentials: true,
}));

// Em desenvolvimento, o frontend roda em localhost:XXXX mas ALLOWED_ORIGIN
// está vazio, então o CORS bloqueia as requisições. O dev script em package.json
// não define ALLOWED_ORIGIN.
// Suporte a múltiplas origens:

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || 'https://hub.portalsvn.com.br')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permitir requests sem origin (Postman, curl, server-to-server)
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (process.env.NODE_ENV !== 'production') return cb(null, true); // dev: permissivo
    cb(new Error('CORS: origem não permitida: ' + origin));
  },
  credentials: true,
}));
```

### 1c. Sessão com `maxAge: 24h` — sem renovação automática (rolling)

```ts
// Se o usuário ficar logado por mais de 24h sem recarregar a página,
// a sessão expira silenciosamente e a próxima requisição retorna 401.
// O interceptor de fetch em auth.js redireciona para login — correto.
// Mas se o usuário estiver em um formulário longo (eventos, 7 etapas),
// pode perder o rascunho. O saveFormState() do interceptor tenta salvar,
// mas é chamado após o 401, que pode ser em um fetch de submit.
// Adicionar rolling session para renovar a cada request:

app.use(
  session({
    // ...
    rolling: true,        // ← renovar sessão a cada request
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      // ...
    },
  }),
);
```

### 1d. `createTableIfMissing: false` pode causar crash se tabela `session` não existir

```ts
// Se o banco for migrado sem criar a tabela session, o servidor crasha
// na primeira requisição que tente usar a sessão.
// Em produção com Railway, o banco pode ser recriado/migrado.
// Mudar para true OU garantir que a migration cria a tabela:

new PgStore({
  pool,
  tableName: "session",
  createTableIfMissing: true,  // ← mais seguro
}),
```

### 1e. Catch-all `/{*catchAll}` pode conflitar com Express 5

```ts
// Express 5 mudou o parsing de path parameters.
// O padrão `/{*catchAll}` é específico do Express 5 — correto ✅.
// Mas o guard `req.path.startsWith("/api")` é desnecessário porque
// as rotas /api e /auth já foram registradas antes do static e do catch-all
// — o Express não chegaria ao catch-all para rotas já matchadas.
// Simplificar:

app.get("/{*catchAll}", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});
// (remover o if/next desnecessário)
```

### 1f. `express.json({ limit: "50mb" })` é excessivo para a maioria dos endpoints

```ts
// 50mb de JSON (não multipart) é muito grande. Arquivos são enviados via
// multipart/form-data (multer), não JSON. Nenhum endpoint deve receber
// 50mb de JSON puro.
// Reduzir para um valor razoável e deixar o multer cuidar dos arquivos:

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
// Multer tem seus próprios limites configurados nas rotas
```

---

## 2. `build.mjs` — 3 observações

### 2a. `@aws-sdk/*` está em `external` mas é usado em `r2.ts`

```js
// O build externaliza @aws-sdk/* mas o package.json inclui
// "@aws-sdk/client-s3" como dependência de runtime.
// Isso significa que o módulo NÃO é bundlado — precisa estar instalado
// no ambiente de produção (node_modules presente no deploy).
// No Railway com Nixpacks isso funciona se as deps forem instaladas,
// mas se o deploy copiar apenas o dist/, o @aws-sdk não estará disponível.
// Verificar se o deploy inclui node_modules ou instala deps no runtime.
// Alternativa: remover @aws-sdk/* dos externals e deixar bundlar.
// (O motivo de externalizar geralmente é tamanho do bundle ou módulos nativos —
// @aws-sdk não tem módulos nativos, pode ser bundlado sem problema.)
```

### 2b. `nodemailer` e `handlebars` estão em `external` mas não são dependências

```js
// package.json não tem nodemailer nem handlebars.
// Eles estão no external por precaução mas não fazem diferença.
// Sem impacto real — comentar para deixar o external list mais limpo.
```

### 2c. `sourcemap: "linked"` — os source maps ficam no dist/ em produção

```js
// sourcemaps linked significa que o .mjs referencia um .mjs.map no mesmo dir.
// Em produção no Railway, se dist/ for o artefato deployado, os source maps
// ficam acessíveis publicamente via o servidor de arquivos estáticos
// (express.static(publicDir)) — mas publicDir aponta para public/, não dist/.
// Os source maps em dist/ não ficam expostos ao público. ✅ Correto.
// Porém o --enable-source-maps no start script vai usá-los para stack traces.
// Comportamento correto e seguro.
```

---

## 3. `package.json` — 3 observações

### 3a. Script `dev` faz build completo antes de iniciar — sem hot reload

```json
// "dev": "export NODE_ENV=development && pnpm run build && pnpm run start"
// Toda alteração no código requer rebuild manual + restart.
// Para desenvolvimento local, usar tsx ou ts-node com watch:
// "dev": "NODE_ENV=development tsx watch src/index.ts"
// (tsx já está disponível nos tooling packages do monorepo geralmente)
// Ou adicionar tsx como devDependency.
```

### 3b. `express: "^5"` e `@types/express: "^5"` — Express 5 ainda em RC

```json
// Express 5 foi lançado como estável em setembro 2024.
// @types/express ^5 cobre a API corretamente.
// O uso de /{*catchAll} em app.ts confirma que é Express 5 intencionalmente. ✅
```

### 3c. `multer: "^2.1.1"` — verificar compatibilidade com Express 5

```json
// Multer 2.x foi atualizado para Express 5. ✅
// uuid: "^13.0.0" — versão mais recente, usa exports ESM. ✅
// Sem problemas de dependências.
```

---

## 4. `tsconfig.json` — 1 observação

### 4a. Herda de `tsconfig.base.json` — verificar se inclui `strict: true`

```json
// O tsconfig.base.json não foi enviado para análise.
// Se não tiver strict: true, erros como valores null/undefined não checados,
// any implícito, etc. passam silenciosamente.
// Adicionar ao compilerOptions se não estiver na base:
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,  // útil para arrays/objetos indexados
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  }
}
```

---

## RESUMO DE PRIORIDADES — INFRA

**Importantes:**
- 1a. app.ts: /api/config com Cache-Control public expõe dados sem auth
- 1b. app.ts: CORS não suporta múltiplas origens (dev vai bloquear sem ALLOWED_ORIGIN)
- 1c. app.ts: sem rolling session — formulários longos podem perder rascunho
- 1d. app.ts: createTableIfMissing:false pode crashar se tabela session não existir
- 2a. build.mjs: @aws-sdk externalizado mas precisa estar em node_modules no deploy
- 1f. app.ts: limite de 50mb para JSON puro é excessivo

**Baixa prioridade:**
- 1e. app.ts: guard desnecessário no catch-all
- 2b. build.mjs: dependências fantasma no external
- 3a. package.json: dev sem hot reload
- 4a. tsconfig.json: verificar se strict está na base
