# Hub de Solicitações SVN — Rodada de correções e melhorias

8 itens nesta tarefa. Executar na ordem. Após o item #8, rodar `cd artifacts/api-server && pnpm run build` e reiniciar o servidor.

---

## #1 — Campo Telefone universal nos forms

Hoje só alguns forms têm campo de telefone. Padronizar em **todos**.

### Especificação
- Adicionar campo `Telefone / WhatsApp *` em todos os forms do hub
- **Obrigatório** em todos
- **Pré-preencher do cadastro do usuário** (reutilizar a lógica que já existe nos forms que têm o campo — provavelmente um helper tipo `prefillFromUser()` ou similar)
- Hint abaixo do campo, quando preenchido automaticamente: `✓ Pré-preenchido do seu cadastro — pode editar se quiser` (idêntico ao existente)
- Mesma máscara e validação dos forms atuais

### Integração com ClickUp
Nos forms que disparam task no ClickUp, **incluir o telefone na descrição da task**, logo abaixo do nome do solicitante:

```
Solicitante: João Sardeto
Telefone: (44) 99826-4597
[restante da descrição existente]
```

Procurar no código onde a descrição da task é montada (provavelmente no helper que envia o webhook pra N8N ou na função que constrói o payload) e adicionar a linha do telefone.

---

## #2 — Simplificar label do campo E-mail

Em todos os forms que têm campo de e-mail:

**Hoje:** label = `E-mail de Assessor (Assessores) ou E-mail corporativo (Time de Gestão) *`

**Novo:**
- Label vira apenas: `E-mail *`
- A explicação migra pro hint abaixo do campo: `Use o e-mail de assessor ou corporativo (time de Gestão)`
- Mesmo estilo visual do hint do telefone (texto secundário em cinza)

---

## #3 — Logo errado para SVN Investimentos + auditoria

Há duas URLs candidatas no servidor pra marca `svn-investimentos`:
- `assinaturas_assinatura_logo_svn.png` — monograma SVN sozinho (que está sendo usado erroneamente hoje)
- `assinaturas_assinatura_svn.png` — versão completa "SVN Investimentos | XP" (correto)

### Ação
1. **Trocar o mapping** em `LOGO_URLS` no service `assinatura-generator.ts`:
   - `'svn-investimentos': \`${ASSETS_BASE}/assinaturas_assinatura_svn.png\``
2. **Auditar todas as outras marcas** — gerar uma assinatura de teste pra cada (Capital, Connect, Gestão, Global, IMB, Agro/Câmbio/Commodities, Proteção Patrimonial, Wealth Planning) e conferir visualmente que o logo correto está sendo aplicado. Se alguma estiver invertida, corrigir o mapping.

---

## #4 — Adicionar cargo à arte da assinatura

### Quais marcas têm cargo
Marcas **com** campo de cargo no form:
- SVN Gestão
- SVN Global
- SVN IMB
- SVN Agro/Câmbio/Commodities
- SVN Proteção Patrimonial
- SVN Wealth Planning

Marcas **sem** cargo (mantém form e geração atual):
- SVN Investimentos
- SVN Capital
- SVN Connect

### Form
Adicionar campo `Cargo *` (obrigatório) nos forms das marcas listadas acima. Renderização condicional baseada na marca selecionada — quando o usuário seleciona uma das marcas com cargo, o campo aparece.

### Geração da assinatura (`assinatura-generator.ts`)

1. **Receber `cargo` no input:**
```ts
export interface AssinaturaInput {
  nome: string;
  cargo?: string; // novo
  telefone: string;
  email: string;
  temCFP?: boolean;
  marca?: string;
}
```

2. **Adicionar coordenadas e fonte:**

Cargo usa **Roobert PRO Light a 64px** (idêntico a telefone e email). Posição: nova linha entre nome e telefone.

3. **Layout dual** — quando `cargo` está presente, todos os elementos abaixo do nome descem pra acomodar:

```ts
const LAYOUT_BASE = {
  // existente — usado quando NÃO há cargo
  nome:  { x: 2007, y_top: 240 },
  tel:   { x: 2005, y_top: 447 },
  email: { x: 2005, y_top: 562 },
  cfp:   { x: 2007, y: 676 },
};

const LAYOUT_COM_CARGO = {
  // novo — usado quando há cargo
  nome:  { x: 2007, y_top: 240 },
  cargo: { x: 2007, y_top: 415 },
  tel:   { x: 2005, y_top: 520 },
  email: { x: 2005, y_top: 625 },
  cfp:   { x: 2007, y: 740 },
};

// Logo, linha e selos mantêm posição em ambos
```

Esses valores são ponto de partida — validar visualmente que as 4 linhas (nome, cargo, tel, email) têm respiração adequada e a CFP não corta no rodapé da arte (canvas é 988px). Se ficar apertado, micro-ajustes nos `y_top`.

4. **Renderização condicional:**

```ts
const layout = input.cargo ? LAYOUT_COM_CARGO : LAYOUT_BASE;
// ... e usar layout.nome.y_top, layout.tel.y_top, etc

// quando há cargo, renderiza e compõe o elemento adicional
if (input.cargo) {
  const cargoBuf = await renderText(fontBody, input.cargo, 64);
  composites.push({
    input: cargoBuf,
    top: topForText(fontBody, 64, layout.cargo.y_top),
    left: layout.cargo.x,
  });
}
```

O cargo herda o mesmo `auto-fit` que já tem pra nome e email — se for muito longo, reduz proporcionalmente até caber na safe area.

---

## #5 — Botão "Ver solicitação" da Thank You Page

Hoje redireciona pro dashboard genérico (`/dashboard` ou `/solicitacoes`). Mudar pra redirecionar pra **página da solicitação específica** que acabou de ser criada.

O endpoint que cria a solicitação já retorna o ID na resposta. Usar esse ID pra construir a URL:

```js
// na Thank You Page, após sucesso do POST
const { id } = response.data;
const verSolicitacaoUrl = `/solicitacoes/${id}`; // ou o padrão de URL usado no resumo
// ... botão "Ver solicitação" → verSolicitacaoUrl
```

---

## #6 — Auditoria de humanização de dados

Há vários pontos da UI mostrando **slugs raw** em vez de labels humanizados. Auditoria geral.

### Onde investigar
- **Dashboard**: prefixo do título das solicitações está vindo como `[arte-divulgacao]` em vez de `[Arte de Divulgação]`
- **Resumo da solicitação**: alguns campos com inicial minúscula ou sem acentos
- **Qualquer outro lugar** onde dados de categoria, marca, tipo, status ou role apareçam pra usuário final

### Regra
Sempre que um valor de slug/key for renderizado na UI, usar o `label` correspondente da config. Nunca mostrar o slug direto.

Padrão: cada categoria/marca/status no `config.js` tem `{ id, label }`. UI usa `label`. Se algum item não tiver `label` definido, adicionar.

Conferir explicitamente:
- `CATEGORIAS_SOLICITACAO` — todas com label correto, acentuado
- `MARCAS` (ou similar) — labels com acentuação correta (`SVN Gestão`, `SVN Proteção Patrimonial`, `SVN Agro/Câmbio/Commodities`, etc.)
- `STATUS` — `Em análise`, `Concluído`, `Pendente` etc.
- `ROLES` — `Administrador`, `Colaborador`

---

## #7 — Remover campo "Setor" do form de Página de Assessores

Remoção **completa** do campo `Setor`:
1. HTML do form (input + label)
2. Schema de validação (zod ou similar)
3. Payload enviado pro backend
4. Coluna do DB (se existir migration, criar uma `DROP COLUMN`; se for campo livre, ignorar)
5. Descrição da task do ClickUp — se o setor estava sendo incluído na descrição, remover

---

## #8 — Aba "Usuários" no dashboard (admin only)

### 8.1 Schema do banco

```sql
-- Novas colunas em users
ALTER TABLE users ADD COLUMN clickup_user_id VARCHAR(100);
ALTER TABLE users ADD COLUMN is_default_assignee BOOLEAN NOT NULL DEFAULT false;

-- Permitir usuários "stub" (assignees que ainda não logaram no hub)
-- Aplicar APENAS se as colunas hoje têm NOT NULL
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN nome DROP NOT NULL;
-- (conferir o nome real da coluna de nome no schema atual — pode ser 'name', 'nome', 'full_name' etc.)

-- Nova tabela de atribuições
CREATE TABLE user_tipo_assignments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(100) NOT NULL,
  PRIMARY KEY (user_id, tipo)
);

CREATE INDEX idx_user_tipo_assignments_tipo ON user_tipo_assignments(tipo);
```

Atualizar o Drizzle schema correspondente, tornando `email` e `nome` opcionais nos tipos.

### 8.2 Endpoints

Todos com middleware que valida `req.user.role === 'admin'`.

- **`GET /api/admin/users`** — retorna lista com:
  - `id`, `nome`, `email`, `role`, `clickup_user_id`, `is_default_assignee`
  - `qtd_solicitacoes` (agregação via JOIN com solicitacoes)
  - `tipos_atribuidos` (array de tipos, JOIN com user_tipo_assignments)
  - `is_stub`: derivado (true se `email IS NULL OR nome IS NULL`)

- **`POST /api/admin/users`** — body: `{ nome, email, role, clickup_user_id, is_default_assignee }`. Cria um novo usuário (não-stub, com nome e email preenchidos). Validação: email único.

- **`PATCH /api/admin/users/:id`** — body parcial com qualquer combinação de `{ nome, email, role, clickup_user_id, is_default_assignee }`. Usado tanto pra completar stubs (preencher nome/email) quanto pra edição inline normal.

- **`PATCH /api/admin/users/:id/default-flag`** — body: `{ is_default_assignee: boolean }`. **Validação**: se for `false` e for o último usuário com `is_default_assignee=true`, rejeitar (400) com mensagem "Pelo menos um usuário precisa estar marcado como Default Assignee".

- **`PATCH /api/admin/users/:id/assignments`** — body: `{ tipos: string[] }`. Substitui (não merge) as atribuições daquele usuário pelos tipos no array.

### 8.3 Frontend — Aba Usuários

Adicionar tab no dashboard. Visível **apenas se** `currentUser.role === 'admin'`.

#### Botão "Adicionar usuário"

Acima da tabela. Abre modal com campos: Nome, E-mail, Role, ID ClickUp, Default Assignee. POST `/api/admin/users` → adiciona linha na tabela.

Esse botão atende dois casos:
- Cadastrar antecipadamente alguém que ainda não logou no hub mas precisa receber atribuições no ClickUp
- Adicionar usuários administrativos que não vêm pelo fluxo de login

#### Tabela com colunas:

| Coluna | Tipo | Editável |
|---|---|---|
| Nome | texto | inline |
| E-mail | texto | inline |
| Qtd Solicitações | número | não |
| Role | dropdown (`Administrador` / `Colaborador`) | inline |
| ID ClickUp | text input | inline (debounced) |
| Default Assignee | checkbox | inline |
| Tipos Atribuídos | tags + botão "Editar" | modal |

#### Comportamentos:

- **Todas as colunas sortáveis** (click no header alterna asc/desc). Default: ordenação alfabética por nome.
- **Edição inline** com debounce de ~500ms (não dispara PATCH a cada keystroke).
- **Mudança de role própria**: se admin tentar mudar a própria role pra `colaborador`, abrir modal de confirmação: "Você vai perder o acesso de admin. Tem certeza?". Após confirmar, persistir e fazer logout + redirect pra login.
- **Default Assignee**: clicar no checkbox dispara PATCH. Se for o último a desmarcar, mostrar erro do backend.
- **Tipos Atribuídos**: tags mostram os tipos como labels humanizados (não slugs). Botão "Editar" abre modal com checkboxes de todos os tipos disponíveis. Salvar → PATCH `/assignments`.

#### Tratamento visual de stubs

Usuários com `is_stub === true` (criados pela migração, sem nome/email ainda):
- Linha destacada com background levemente diferente (ex.: `var(--paper-white)` ou um tom amarelado sutil)
- Badge "Aguardando preenchimento" ao lado do nome (que está vazio) ou na coluna E-mail
- Campos nome e email aparecem com placeholder `(stub — preencher)` em itálico
- Admin clica e edita normalmente. Quando ambos (nome + email) ficam preenchidos, o `is_stub` deriva pra false automaticamente e o destaque some
- Ordenação: stubs podem aparecer no topo por padrão pra chamar atenção (alternativamente, ordenar normal por nome — mas como nome é null, ficariam agrupados em algum extremo de qualquer forma)

### 8.4 Integração com ClickUp (criação de task)

No fluxo que dispara o webhook pra criar task no ClickUp:

```ts
async function getAssigneesForTipo(tipo: string): Promise<string[]> {
  // Buscar users atribuídos a esse tipo
  const assigned = await db
    .select({ clickup_user_id: users.clickup_user_id })
    .from(userTipoAssignments)
    .innerJoin(users, eq(users.id, userTipoAssignments.user_id))
    .where(
      and(
        eq(userTipoAssignments.tipo, tipo),
        isNotNull(users.clickup_user_id)
      )
    );

  if (assigned.length > 0) {
    return assigned.map(u => u.clickup_user_id!);
  }

  // Fallback: default assignees
  const defaults = await db
    .select({ clickup_user_id: users.clickup_user_id })
    .from(users)
    .where(
      and(
        eq(users.is_default_assignee, true),
        isNotNull(users.clickup_user_id)
      )
    );

  return defaults.map(u => u.clickup_user_id!);
}

// no momento de montar o payload do webhook:
const assignees = await getAssigneesForTipo(solicitacao.tipo);
webhookPayload.assignees = assignees; // N8N usa esse campo na criação da task
```

**Atualização no N8N (fora do escopo deste prompt, mas vale alertar o admin):** o workflow do N8N que cria task no ClickUp precisa passar o campo `assignees` recebido do webhook pro endpoint da task. Se já não fizer isso, ajustar lá.

### 8.5 Migração das atribuições existentes (env vars → DB)

Hoje as atribuições vivem em **secrets do Replit e do Railway** (env vars). Migrar pra DB de forma idempotente, e depois remover as env vars.

#### Passo 1 — Mapear env vars existentes

No código atual do hub, localizar onde os secrets de atribuição são lidos. Padrão típico: `process.env.CLICKUP_ASSIGNEE_<TIPO>` ou similar. Buscar com grep por `CLICKUP_ASSIGN`, `process.env` próximo a strings de tipo, ou no helper que monta o payload pro N8N.

Listar todos os mapeamentos `tipo → clickup_user_id` encontrados.

#### Passo 2 — Script de migração

Criar `src/scripts/migrate-assignments.ts`:

```ts
import 'dotenv/config';
import { db } from '../db';
import { users, userTipoAssignments } from '../db/schema';
import { eq } from 'drizzle-orm';

// Preencher com os env vars encontrados no Passo 1
const MAPPINGS: Record<string, string | undefined> = {
  'artes-divulgacao':  process.env.CLICKUP_ASSIGNEE_ARTES_DIVULGACAO,
  'cartao-visita':     process.env.CLICKUP_ASSIGNEE_CARTAO_VISITA,
  'brindes':           process.env.CLICKUP_ASSIGNEE_BRINDES,
  // ... etc. Usar todos os tipos/env vars que existirem hoje.
};

async function migrate() {
  let created = 0, reused = 0, assigned = 0;

  for (const [tipo, clickupId] of Object.entries(MAPPINGS)) {
    if (!clickupId) continue;

    // 1. Find ou cria stub user para esse clickup_user_id
    let user = await db.query.users.findFirst({
      where: eq(users.clickup_user_id, clickupId),
    });

    if (!user) {
      const [stub] = await db.insert(users).values({
        clickup_user_id: clickupId,
        email: null,
        nome: null,
        role: 'colaborador',
        is_default_assignee: false,
      }).returning();
      user = stub;
      created++;
    } else {
      reused++;
    }

    // 2. Insere atribuição (idempotente)
    await db.insert(userTipoAssignments)
      .values({ user_id: user.id, tipo })
      .onConflictDoNothing();

    assigned++;
  }

  console.log(`✓ Migração concluída: ${created} stubs criados, ${reused} users reutilizados, ${assigned} atribuições aplicadas`);
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error('Erro na migração:', err);
  process.exit(1);
});
```

Adicionar script no `package.json`:
```json
{
  "scripts": {
    "migrate-assignments": "tsx src/scripts/migrate-assignments.ts"
  }
}
```

#### Passo 3 — Rodar a migração

```bash
pnpm run migrate-assignments
```

Conferir no console que stubs foram criados (output do script) e abrir a aba Usuários — deve aparecer N linhas marcadas como "Aguardando preenchimento", uma pra cada `clickup_user_id` único encontrado nas env vars.

#### Passo 4 — Remover leitura dos env vars do código

A função `getAssigneesForTipo` (seção 8.4) substitui completamente a lógica antiga. Localizar e remover qualquer trecho que ainda leia `process.env.CLICKUP_ASSIGNEE_*` ou similar.

#### Passo 5 — Limpeza (depois do deploy estável)

**Importante: só executar este passo depois de confirmar que o sistema novo está funcionando em produção por alguns dias.**

- Remover os secrets `CLICKUP_ASSIGNEE_*` do Replit
- Remover os secrets `CLICKUP_ASSIGNEE_*` do Railway

Esses passos são **manuais** pelos painéis do Replit/Railway, não fazem parte do código.

### 8.6 Auth flow — find-or-create por email

Verificar o fluxo de autenticação MSAL. Quando um usuário loga com email X, o handler deve:

```ts
let user = await db.query.users.findFirst({
  where: eq(users.email, msalProfile.email),
});

if (!user) {
  // criar novo usuário a partir do perfil MSAL
  user = await createFromMSAL(msalProfile);
}
// usar `user` na sessão
```

Esse padrão **find-by-email-or-create** é crucial pro mecanismo de stubs funcionar:

- Admin cadastra antecipadamente um colaborador com email `joao@svninvestimentos.com.br` na aba Usuários
- Quando João logar via MSAL, o auth encontra o registro existente (pelo email) e **reutiliza**, em vez de criar duplicata
- João herda o `clickup_user_id` e atribuições já configuradas

Se o fluxo atual não faz find-by-email (faz insert direto ou usa outro identificador como chave), **ajustar pra esse padrão**. Isso é pré-requisito pro stub mechanism funcionar corretamente.

---

## Build e validação

```bash
cd artifacts/api-server && pnpm run build
# Restart server
```

### Smoke tests

1. **Forms**: abrir qualquer form, conferir que o campo telefone está presente, pré-preenchido (se cadastro tem telefone), obrigatório. Label de e-mail simplificado com hint abaixo.
2. **Geração de assinatura**: gerar uma assinatura pra cada marca disponível. Conferir logo correto, e quando marca tem cargo, o campo aparece no form e renderiza na arte.
3. **Thank You Page**: após submit, botão "Ver solicitação" leva pra página da solicitação criada (não dashboard).
4. **Aba Usuários**: login como admin → tab visível. Login como colaborador → tab invisível. Editar role/clickup-id/atribuições funciona. Tentar desmarcar último default → erro.
5. **Migração de atribuições**: após rodar `pnpm run migrate-assignments`, abrir aba Usuários e conferir que linhas-stub aparecem pra cada `clickup_user_id` que estava em env var. Linhas têm badge "Aguardando preenchimento".
6. **Preenchimento de stub**: editar nome + email de um stub na UI. Após salvar, badge some, linha volta ao visual normal.
7. **Auth flow com stub**: criar um stub manualmente com email de teste (`teste@svninvestimentos.com.br`) → ID ClickUp preenchido → atribuir um tipo. Logar via MSAL com esse mesmo email → conferir que **não cria duplicata**, e o usuário herda ID ClickUp + atribuições.
8. **Atribuição funcionando**: criar uma solicitação de tipo X, conferir no ClickUp que a task nasce com os assignees corretos. Repetir pra tipo sem ninguém atribuído → deve nascer com os defaults.

### Audit checklist (#6)
Conferir telas:
- [ ] Dashboard: prefixo do título usa label humanizado
- [ ] Resumo: todos os campos com label correto e acentuação
- [ ] Aba Usuários: roles e tipos como labels, não slugs
- [ ] Lista de solicitações no admin: status, tipo, marca todos humanizados
