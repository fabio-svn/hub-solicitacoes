# Revisão final — forms.ts (routes), clickup.ts, api.schema

---

## 1. `routes/forms.ts` — 8 correções

### 1a. CRÍTICO: `cartao-boas-vindas` ainda envia `cidade` no webhook

```ts
// Em buildWebhookFields, case "cartao-boas-vindas":
// ainda tem: cidade: s(dados.cidade),
// O campo cidade foi removido do form HTML mas ainda é enviado ao N8N.
// Remover:

case "cartao-boas-vindas":
  return {
    nome_cliente:    s(dados.nomeCliente),
    private:         dados.isPrivate === "sim" ? "Sim" : "Não",
    nome_assessor:   s(dados.nomeAssinatura),
    contrato_social: s(dados.contratoSocial),
    // cidade: s(dados.cidade),  ← REMOVER
    email:           userEmail,
  };
```

### 1b. IMPORTANTE: `busca` no GET /solicitacoes faz ILIKE no JSONB como texto

```ts
// DE:
conditions.push(sql`(${solicitacoesTable.dados}::text ILIKE ${searchTerm})`);
// Isso faz full text cast do JSONB para string — inclui chaves e aspas.
// Um usuário buscando "Maria" pode retornar resultados onde "Maria"
// aparece como valor de qualquer chave, inclusive metadados internos.
// É funcional mas pode ser lento em volume. Sem índice GIN no campo dados.
// Aceitável para MVP, mas documentar para otimização futura.
```

### 1c. `subtipo_filter` usa LIKE sem escape completo

```ts
// DE:
const subtipoFilter = String(req.query.subtipo_filter).replace(/[^a-z0-9-]/g, "");
conditions.push(sql`${solicitacoesTable.tipo_solicitacao} LIKE ${subtipoFilter + "%"}`);
// O replace já sanitiza (só letras, números, hífen) — seguro ✅.
// Mas LIKE com % apenas no final (prefix match) é correto para filtrar
// "pagina-assessores-dados" e "pagina-assessores-atualizacao" buscando "pagina-assessores".
// ✅ Correto.
```

### 1d. IMPORTANTE: `admin/stats` e `admin/historico` estão no formsRouter, não no adminRouter

```ts
// GET /admin/stats e GET /admin/historico estão definidos em forms.ts
// mas são montados em router.use(formsRouter) em routes/index.ts,
// portanto o endpoint real é /api/admin/stats e /api/admin/historico.
// O adminRouter (router.use("/admin", adminRouter)) provavelmente tem
// outros endpoints de admin (users, impersonate).
// Isso significa que a proteção de role para stats/historico está em forms.ts
// com o check manual (if user.role !== "admin" && !== "gestor").
// Consistente, mas idealmente esses endpoints deveriam estar no adminRouter
// com middleware centralizado.
```

### 1e. `/solicitacoes/:id/aprovacao` — idempotência fraca

```ts
// A deduplicação verifica se já existe comentário "Aprovado por X" no ClickUp.
// Problema: o texto do comentário inclui user.name — se o nome do usuário
// mudar entre duas aprovações, a checagem falha e aprova de novo.
// Baixo risco mas real. Adicionar verificação de status do banco também:

const [solicitacao] = await db.select()...
if (solicitacao.status === 'concluido') {
  res.json({ success: true, alreadyApproved: true });
  return;
}
```

### 1f. `/solicitacoes/:id/avaliacao` — nota pode ser float ou string

```ts
// DE:
const { nota, comentario } = req.body as { nota: number; comentario?: string };
if (!nota || nota < 1 || nota > 10) { ... }

// Se o body vier como { nota: "8" } (string), nota < 1 e nota > 10 funcionam
// por coerção, mas nota = 0 seria falsy e passaria como undefined.
// Adicionar coerção explícita:

const notaNum = Number(nota);
if (!notaNum || !Number.isInteger(notaNum) || notaNum < 1 || notaNum > 10) {
  res.status(400).json({ error: "Nota deve ser um inteiro entre 1 e 10" });
  return;
}
// Usar notaNum no insert
```

### 1g. `upload.any()` no POST /solicitacoes — aceita qualquer campo de arquivo

```ts
// multer({ dest: os.tmpdir(), limits: { fileSize: 250mb } })
// com upload.any() aceita qualquer nome de campo de arquivo.
// Um usuário mal-intencionado poderia enviar 250mb de dados por campo
// multiplicado por N campos — o limite é por arquivo, não total.
// Adicionar limite de campos:

const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 250 * 1024 * 1024,
    files: 10,   // ← máximo 10 arquivos por request
    fields: 20,  // ← máximo 20 campos não-arquivo
  }
});
```

### 1h. `dispararWebhook` não tem timeout — pode pendurar indefinidamente

```ts
// dispararWebhook usa fetch nativo sem timeout.
// Se o N8N estiver lento, a promise fica pendente mas como é fire-and-forget
// (.then/.catch sem await), não bloqueia o response. ✅
// Porém muitas promises pendentes podem acumular memória.
// Adicionar AbortController com timeout:

const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s

fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(fields),
  signal: controller.signal,
}).then(res => {
  clearTimeout(timeoutId);
  logger.info({ tipo, status: res.status }, `[Webhook] Resposta tipo=${tipo}`);
}).catch(err => {
  clearTimeout(timeoutId);
  logger.error({ err, webhookUrl, tipo }, `Webhook ${tipo} falhou`);
});
```

---

## 2. `clickup.ts` — 5 correções

### 2a. `ASSIGNEE_NOMES` agora tem os nomes corretos — ✅ confirmado

```ts
// "55127950": "Camilla Fernandes"
// "99968866": "Taynara Rodrigues"
// Esses são os nomes reais para Patrocínio e Brindes. ✅
```

### 2b. `gerarIdSolicitacao` usa Math.random() — colisões possíveis

```ts
// Math.random() gera apenas 3 dígitos (100-999) — 900 combinações.
// Com múltiplas solicitações no mesmo dia/setor, colisões são possíveis.
// O ID é usado apenas como referência visual (não como chave primária),
// então duplicatas são aceitáveis mas confusas.
// Para maior unicidade, usar timestamp em ms ou crypto.randomInt:

import { randomInt } from "crypto";
const rand = String(randomInt(1000, 9999)); // 4 dígitos, criptograficamente seguro
```

### 2c. `setEventosCustomFields` — batchSize de 10 em paralelo pode atingir rate limit do ClickUp

```ts
// O ClickUp tem rate limit de 100 requests/min por token.
// Com 44 campos custom + 3 fixos = ~47 requests por task de evento.
// Em lotes de 10 com await, são ~5 batches — dentro do limite.
// Porém se múltiplas tasks forem criadas ao mesmo tempo (improvável),
// pode atingir o limite. Monitorar com os logs existentes. ✅
```

### 2d. `buildGeneralDescription` — campos de patrocínio não têm builder específico no switch

```ts
// createClickUpTask() tem case "patrocinio" chamando buildPatrocinioDescription ✅.
// O buildGeneralTaskName() também tem case "patrocinio" ✅.
// Sem problema — o switch está completo.
```

### 2e. `proximaQuarta()` — se hoje for quarta-feira, retorna a próxima semana

```ts
// const diasAte = (3 - dow + 7) % 7 || 7;
// Se dow === 3 (quarta), (3 - 3 + 7) % 7 = 0, e 0 || 7 = 7.
// Isso empurra o prazo para a quarta seguinte em vez de hoje.
// Para cartão físico, isso é intencional (prazo mínimo de produção)
// ou deveria ser "hoje se for quarta, senão próxima quarta"?
// Verificar com o time se a intenção é sempre a próxima quarta.
// Se for "hoje ou próxima quarta":
const diasAte = (3 - dow + 7) % 7; // sem || 7 — retorna 0 se hoje é quarta
d.setDate(d.getDate() + diasAte);
```

---

## 3. `api.schema.js` (gerado por orval) — 1 observação

### 3a. Schema gerado por orval — não editar manualmente

```
O arquivo é gerado automaticamente (orval v8.5.3).
Contém apenas HealthStatus { status: string } — API schema mínimo.
Nenhum tipo de Solicitacao, User, Arquivo está no schema.
Isso significa que o frontend não tem contratos TypeScript com a API —
as respostas são tratadas como `any` implícito nos forms e dashboard.
Não é um bug mas é uma oportunidade: gerar tipos a partir das rotas
do Express/Drizzle daria type safety entre frontend e backend.
Sem ação necessária no MVP.
```

---

## 4. Visão geral de segurança — conclusão

```
Após revisar todos os arquivos, o sistema tem uma postura de segurança
razoável para MVP interno. Resumo dos pontos restantes:

✅ Correto:
- requireAuth em todas as rotas de dados
- Verificação de ownership (user_email = user.email) em GET/POST/:id
- Verificação de role em DELETE e endpoints admin
- Rate limiting por email (10/hora)
- Validação de VALID_TIPOS antes de inserir
- Sanitização de subtipo_filter com regex
- CSRF protection via nonce no OAuth
- Session httpOnly + secure em produção

⚠️ Pendente (já documentado nos prompts anteriores):
- webhook.ts: sem verificação de assinatura
- auth.ts: domínio hardcoded, sessão não salva após callback
- app.ts: CORS origem única, sem rolling session
- r2.ts: placeholder de URL inválida quando R2 não configurado
```

---

## RESUMO DE PRIORIDADES — FINAL

**Críticos:**
- 1a. forms.ts: cidade ainda enviada no webhook de boas-vindas
- 1g. forms.ts: upload.any() sem limite de número de arquivos

**Importantes:**
- 1f. forms.ts: nota da avaliação sem coerção/validação de tipo
- 1h. forms.ts: webhook sem timeout pode acumular promises
- 1e. forms.ts: aprovação pode duplicar em edge case de nome mudado
- 2b. clickup.ts: gerarIdSolicitacao com apenas 900 combinações/dia
- 2e. clickup.ts: proximaQuarta pula a quarta atual — verificar intenção

**Baixa prioridade:**
- 1d. forms.ts: admin/stats e admin/historico em formsRouter em vez de adminRouter
- 1b. forms.ts: busca em JSONB::text sem índice (documentar para otimização)
- 2c. clickup.ts: rate limit em volume alto (improvável para uso atual)
- 3a. api.schema: sem tipos para Solicitacao/User no contrato OpenAPI
