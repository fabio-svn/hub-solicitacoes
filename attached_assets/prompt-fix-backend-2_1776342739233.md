# Correção — Backend (app.ts + auth.ts + admin.ts)

---

## 1. `app.ts`

### 1a. Restringir CORS ao domínio do hub
```ts
// Substituir:
app.use(cors());

// Por:
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'https://hub.portalsvn.com.br',
  credentials: true,
}));
```

### 1b. Adicionar Cache-Control no `/api/config`
```ts
// Substituir:
app.get("/api/config", (_req, res) => {
  res.json({

// Por:
app.get("/api/config", (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
```

### 1c. Corrigir R2_PUBLIC_URL — unificar fallback
O fallback do `app.ts` usa um bucket diferente do hardcoded no `config.js`.
Substituir o fallback pelo bucket correto:
```ts
// Substituir:
r2PublicUrl: process.env.R2_PUBLIC_URL || "https://pub-5bcbae1bfa0b4fae862dc042f8f1eaa8.r2.dev",

// Por:
r2PublicUrl: process.env.R2_PUBLIC_URL || "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev",
```

---

## 2. `auth.ts` — Eliminar segundo SELECT desnecessário

No `/callback`, substituir o bloco que faz dois SELECTs por versão otimizada:

```ts
// Substituir o bloco atual:
const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

if (existing.length === 0) {
  await db.insert(usersTable).values({ email, name, role: "colaborador" });
} else if (existing[0].name !== name) {
  await db.update(usersTable).set({ name }).where(eq(usersTable.email, email));
}

const userRow = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

req.session.user = {
  email,
  name,
  role: userRow[0]?.role || "colaborador",
};

// Por:
const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

let role = "colaborador";

if (existing.length === 0) {
  await db.insert(usersTable).values({ email, name, role: "colaborador" });
} else {
  role = existing[0].role || "colaborador";
  if (existing[0].name !== name) {
    await db.update(usersTable).set({ name }).where(eq(usersTable.email, email));
  }
}

req.session.user = { email, name, role };
```

---

## 3. `admin.ts`

### 3a. Adicionar validação de NaN no userId
```ts
// Adicionar logo após:
const userId = parseInt(String(req.params.id));

// Inserir:
if (isNaN(userId)) {
  res.status(400).json({ error: "ID inválido" });
  return;
}
```

### 3b. Corrigir mensagens de erro com acentuação
```ts
// Substituir:
res.status(400).json({ error: "Role invalida" });
// Por:
res.status(400).json({ error: "Role inválida" });

// Substituir:
res.status(404).json({ error: "Usuario nao encontrado" });
// Por:
res.status(404).json({ error: "Usuário não encontrado" });

// Substituir:
res.status(400).json({ error: "Nao e possivel alterar sua propria role" });
// Por:
res.status(400).json({ error: "Não é possível alterar sua própria role" });

// Substituir:
res.status(500).json({ error: "Erro ao listar usuarios" });
// Por:
res.status(500).json({ error: "Erro ao listar usuários" });
```

---

## OBSERVAÇÕES

- Após aplicar as mudanças, rodar build: `cd artifacts/api-server && pnpm run build`
- O ponto do logout do Azure (redirecionar para o endpoint de logout da Microsoft) é opcional — o comportamento atual com `prompt: "select_account"` já é adequado para o uso diário
- O ponto da sessão não atualizada após mudança de role é aceitável — o usuário só precisa fazer logout e login novamente para a nova role entrar em vigor
- Definir `ALLOWED_ORIGIN` como variável de ambiente no Replit com o valor `https://hub.portalsvn.com.br`
