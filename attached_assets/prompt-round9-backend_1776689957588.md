# Round 9 — Backend (forms.ts + clickup.ts)

---

## 1. `clickup.ts` — Salvar taskName no banco + Data de início + Prazos automáticos

### 1a. Exportar `buildTaskName` para uso no forms.ts

Em `createClickUpTask()`, antes do POST, expor o taskName:

```ts
// Já existente — apenas garantir que é retornado junto com taskId:
export async function createClickUpTask(
  solicitacao: SolicitacaoData,
  user: UserData,
  dados: FormDados,
  arquivos?: ArquivosMap
): Promise<{ taskId: string | null; taskName: string }> {
  // ...
  // No return final:
  return { taskId, taskName };
}
```

### 1b. Calcular data de início (hoje) e prazo em dias úteis

Adicionar função de cálculo de prazo:

```ts
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++; // ignora sábado e domingo
  }
  return result;
}

// Mapa de tipo de solicitação → dias úteis de prazo
const PRAZO_DIAS_UTEIS: Record<string, number> = {
  'pagina-assessores-dados':       3,  // indefinido → mínimo 3
  'pagina-assessores-atualizacao': 2,
  'apresentacao-nova':             5,
  'apresentacao-atualizar':        5,
  'artes-divulgacao':              3,
  'atualizacao-material':          3,  // indefinido → mínimo 3
  'conteudo-pdf-informativo':      4,
  'conteudo-pdf-ebook':            15,
};
```

### 1c. Adicionar data de início e prazo ao payload da task

Em `createClickUpTask()`, após montar `taskPayload`:

```ts
const hoje = new Date();
const hojeMs = hoje.setHours(12, 0, 0, 0); // meio-dia para evitar problemas de timezone
taskPayload.start_date = hojeMs;
taskPayload.start_date_time = false;

const diasUteis = PRAZO_DIAS_UTEIS[tipo] ?? 3;
const prazoDate = addBusinessDays(new Date(), diasUteis);
prazoDate.setHours(12, 0, 0, 0);
taskPayload.due_date = prazoDate.getTime();
taskPayload.due_date_time = false;

logger.info({ tipo, diasUteis, prazo: prazoDate.toISOString() }, "ClickUp: prazo calculado");
```

**Exceção para apresentações:** se `dados.qtdPaginas` existir e for > 20,
usar 15 dias úteis:

```ts
if ((tipo === 'apresentacao-nova' || tipo === 'apresentacao-atualizar')) {
  const qtd = parseInt(String(dados.qtdPaginas || '0'));
  const diasFinal = qtd > 20 ? 15 : 5;
  const prazoDate = addBusinessDays(new Date(), diasFinal);
  prazoDate.setHours(12, 0, 0, 0);
  taskPayload.due_date = prazoDate.getTime();
}
```

### 1d. Adicionar responsável automático por tipo

```ts
// IDs dos usuários ClickUp — buscar via API antes de usar:
// joao.sardeto@svninvest.com.br   → solicitações gerais
// julia.rodrigues@svninvest.com.br → eventos

// IMPORTANTE: o ClickUp usa IDs numéricos, não e-mails.
// Para obter os IDs, fazer uma chamada à API de membros da equipe:
// GET https://api.clickup.com/api/v2/team
// E mapear por e-mail.

// Adicionar constantes após obtidos os IDs:
const ASSIGNEE_GERAL   = process.env.CLICKUP_ASSIGNEE_GERAL   || "";   // ID de joao.sardeto
const ASSIGNEE_EVENTOS = process.env.CLICKUP_ASSIGNEE_EVENTOS || "";   // ID de julia.rodrigues

// No taskPayload, antes do POST:
const assigneeId = tipo === 'eventos' ? ASSIGNEE_EVENTOS : ASSIGNEE_GERAL;
if (assigneeId) {
  taskPayload.assignees = [parseInt(assigneeId)];
}
```

**AÇÃO NECESSÁRIA:** Obter os IDs numéricos dos usuários no ClickUp.
Fazer a seguinte chamada e anotar os IDs:
```
GET https://api.clickup.com/api/v2/team
Authorization: <CLICKUP_API_TOKEN>
```
Depois adicionar nos Secrets do Replit:
```
CLICKUP_ASSIGNEE_GERAL=<id numérico de joao.sardeto>
CLICKUP_ASSIGNEE_EVENTOS=<id numérico de julia.rodrigues>
```

---

## 2. `forms.ts` — Salvar taskName no banco

### 2a. Adicionar coluna `titulo` na tabela (migration)

```sql
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS clickup_url TEXT;
```

### 2b. Atualizar schema Drizzle

```ts
// Em schema.ts, na tabela solicitacoes:
titulo:          text("titulo"),
clickup_url:     text("clickup_url"),
```

### 2c. Salvar taskName e URL após criar task

```ts
// Em forms.ts, após createClickUpTask():
const { taskId, taskName } = await createClickUpTask(...);

if (taskId) {
  await db.update(solicitacoesTable)
    .set({
      clickup_task_id: taskId,
      titulo: taskName,
      clickup_url: `https://app.clickup.com/t/${taskId}`,
    })
    .where(eq(solicitacoesTable.id, solicitacaoId));
}
```

### 2d. Expor `titulo` e `clickup_url` no GET `/solicitacoes`

Verificar que o SELECT já inclui todos os campos da tabela — se usar
`select()` sem especificar colunas, já virá automaticamente.
Se usar `select({ ... })` explícito, adicionar:
```ts
titulo:      solicitacoesTable.titulo,
clickup_url: solicitacoesTable.clickup_url,
```

---

## 3. `solicitacao.html` — Exibir título do ClickUp

### 3a. Usar `item.titulo` como título principal

```js
// Em renderPage():
// DE:
const titulo = dados.nomeEvento || dados.tituloEvento || dados.titulo || dados.nomeCompleto || item.tipo_solicitacao;

// PARA:
const titulo = item.titulo || dados.nomeEvento || dados.tituloEvento || dados.titulo || dados.nomeCompleto || item.tipo_solicitacao;
```

### 3b. Exibir link ClickUp apenas para admins

```js
// Em renderPage(), no rodapé ou no header, adicionar:
${Auth.isAdmin() && item.clickup_url ? `
  <a href="${esc(item.clickup_url)}" target="_blank" rel="noopener"
     style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;font-weight:600;color:var(--ruby-red);text-decoration:none;opacity:0.8"
     onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    Abrir no ClickUp
  </a>
` : ''}
```

---

## 4. `solicitacao.html` + `forms.ts` — Bloquear chat de aprovação para Página de Assessores

### 4a. Em `renderAprovacao()` no frontend

```js
// Adicionar verificação de tipo no início da função:
const tiposComAprovacao = [
  'eventos', 'artes-divulgacao', 'atualizacao-material',
  'conteudo-pdf-informativo', 'conteudo-pdf-ebook',
  'apresentacao-nova', 'apresentacao-atualizar',
];
if (!tiposComAprovacao.includes(item.tipo_solicitacao)) {
  card.style.display = 'none';
  return;
}
```

### 4b. Em `forms.ts` — Bloquear endpoint `/entrega` para Página de Assessores

```ts
// No GET /solicitacoes/:id/entrega, após buscar a solicitação:
const tiposSemAprovacao = ['pagina-assessores-dados', 'pagina-assessores-atualizacao'];
if (tiposSemAprovacao.includes(solicitacao.tipo_solicitacao)) {
  res.status(403).json({ error: "Aprovação não disponível para este tipo de solicitação" });
  return;
}
```

---

## 5. `forms.ts` — Endpoint de pesquisa de satisfação

### 5a. Adicionar coluna `avaliacao` na tabela

```sql
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS avaliacao JSONB;
```

Schema Drizzle:
```ts
avaliacao: jsonb("avaliacao"),
```

### 5b. Endpoint POST `/solicitacoes/:id/avaliacao`

```ts
router.post("/solicitacoes/:id/avaliacao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { nota, comentario } = req.body as { nota: number; comentario?: string };
    if (!nota || nota < 1 || nota > 10) {
      res.status(400).json({ error: "Nota deve ser entre 1 e 10" });
      return;
    }

    // Apenas o próprio solicitante pode avaliar
    const [solicitacao] = await db.select()
      .from(solicitacoesTable)
      .where(and(
        eq(solicitacoesTable.id, id),
        eq(solicitacoesTable.user_email, user.email)
      ));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    await db.update(solicitacoesTable)
      .set({ avaliacao: { nota, comentario: comentario?.trim() || null, data: new Date().toISOString() } })
      .where(eq(solicitacoesTable.id, id));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar avaliação");
    res.status(500).json({ error: "Erro ao salvar avaliação" });
  }
});
```

### 5c. Endpoint GET `/solicitacoes/:id/avaliacao` (apenas admins)

```ts
router.get("/solicitacoes/:id/avaliacao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== 'admin' && user.role !== 'gestor') {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const id = parseInt(String(req.params.id));
    const [sol] = await db.select({ avaliacao: solicitacoesTable.avaliacao })
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.id, id));
    if (!sol) { res.status(404).json({ error: "Não encontrado" }); return; }
    res.json({ avaliacao: sol.avaliacao });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar avaliação" });
  }
});
```

---

## 6. `solicitacao.html` — UI de pesquisa de satisfação

### 6a. Exibir formulário de avaliação após aprovação

No final de `acaoAprovar()`, após a mensagem de sucesso, aguardar 1.5s
e exibir card de avaliação:

```js
await delay(1500);
renderPesquisaSatisfacao(item.id);
```

### 6b. Função `renderPesquisaSatisfacao()`

```js
function renderPesquisaSatisfacao(solId) {
  const wrap = document.getElementById('chatWrap');
  if (!wrap) return;

  const div = document.createElement('div');
  div.className = 'chat-msg sistema';
  div.style.maxWidth = '100%';
  div.innerHTML = `
    ${SVN_AVATAR_HTML}
    <div class="chat-msg-col" style="flex:1">
      <div class="chat-bubble" id="avaliacaoCard" style="width:100%;box-sizing:border-box">
        <p style="font-weight:700;margin-bottom:4px;font-size:0.9rem">Como foi sua experiência? 😊</p>
        <p style="font-size:0.82rem;opacity:0.6;margin-bottom:16px">Sua avaliação nos ajuda a melhorar o serviço.</p>

        <p style="font-size:0.82rem;font-weight:600;margin-bottom:8px">Nota (1–10)</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px" id="notaBtns">
          ${[1,2,3,4,5,6,7,8,9,10].map(n =>
            `<button onclick="selecionarNota(${n})" data-nota="${n}"
               style="width:34px;height:34px;border-radius:8px;border:1.5px solid rgba(34,27,25,0.15);background:transparent;font-family:'Nunito Sans',sans-serif;font-weight:700;font-size:0.85rem;cursor:pointer;transition:all 0.15s">
               ${n}
             </button>`
          ).join('')}
        </div>

        <p style="font-size:0.82rem;font-weight:600;margin-bottom:6px">Comentário <span style="font-weight:400;opacity:0.45">(opcional)</span></p>
        <textarea id="avaliacaoComentario" placeholder="Alguma sugestão ou feedback?"
          style="width:100%;border:1px solid rgba(34,27,25,0.15);border-radius:8px;padding:10px;font-family:'Nunito Sans',sans-serif;font-size:0.82rem;resize:vertical;min-height:70px;box-sizing:border-box;margin-bottom:12px"></textarea>

        <button onclick="enviarAvaliacao(${solId})"
          style="width:100%;padding:10px;background:var(--carbon-black);color:var(--paper-white);border:none;border-radius:8px;font-family:'Nunito Sans',sans-serif;font-weight:700;font-size:0.875rem;cursor:pointer;transition:opacity 0.2s"
          onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
          Enviar avaliação
        </button>
      </div>
    </div>`;
  wrap.appendChild(div);
  scrollChatBottom();
}

let notaSelecionada = null;

function selecionarNota(n) {
  notaSelecionada = n;
  document.querySelectorAll('#notaBtns button').forEach(btn => {
    const isSelected = parseInt(btn.dataset.nota) === n;
    btn.style.background = isSelected ? 'var(--carbon-black)' : 'transparent';
    btn.style.color = isSelected ? 'var(--paper-white)' : 'var(--carbon-black)';
    btn.style.borderColor = isSelected ? 'var(--carbon-black)' : 'rgba(34,27,25,0.15)';
  });
}

async function enviarAvaliacao(solId) {
  if (!notaSelecionada) {
    document.querySelectorAll('#notaBtns button').forEach(b => b.style.borderColor = 'var(--ruby-red)');
    return;
  }
  const comentario = document.getElementById('avaliacaoComentario')?.value?.trim();
  const btn = document.querySelector('#avaliacaoCard button:last-child');
  btn.disabled = true;
  btn.textContent = 'Enviando...';
  try {
    const res = await fetch('/api/solicitacoes/' + solId + '/avaliacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nota: notaSelecionada, comentario }),
    });
    if (res.ok) {
      document.getElementById('avaliacaoCard').innerHTML = `
        <div style="text-align:center;padding:8px 0">
          <div style="font-size:1.4rem;margin-bottom:6px">🙏</div>
          <p style="font-weight:700;font-size:0.9rem">Obrigado pelo feedback!</p>
          <p style="font-size:0.8rem;opacity:0.5">Sua avaliação foi registrada.</p>
        </div>`;
    } else {
      btn.disabled = false;
      btn.textContent = 'Enviar avaliação';
    }
  } catch {
    btn.disabled = false;
    btn.textContent = 'Enviar avaliação';
  }
}
```

### 6c. Botão de ver avaliação para admins em `renderPage()`

```js
// No rodapé da página, após o link do ClickUp:
${Auth.isAdmin() ? `
  <button onclick="verAvaliacao(${item.id})" id="btnVerAvaliacao"
    style="font-size:0.78rem;font-weight:600;color:var(--carbon-black);background:none;border:none;cursor:pointer;opacity:0.5;padding:0"
    onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'">
    Ver avaliação
  </button>
` : ''}
```

```js
async function verAvaliacao(solId) {
  const btn = document.getElementById('btnVerAvaliacao');
  if (btn) { btn.textContent = 'Carregando...'; btn.disabled = true; }
  try {
    const res = await fetch('/api/solicitacoes/' + solId + '/avaliacao');
    const data = await res.json();
    if (!data.avaliacao) {
      alert('Nenhuma avaliação registrada para esta solicitação.');
      if (btn) { btn.textContent = 'Ver avaliação'; btn.disabled = false; }
      return;
    }
    const { nota, comentario, data: dataAvaliacao } = data.avaliacao;
    const dataFmt = dataAvaliacao
      ? new Date(dataAvaliacao).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
      : '';
    alert(`Avaliação recebida${dataFmt ? ' em ' + dataFmt : ''}:\n\nNota: ${nota}/10\n${comentario ? 'Comentário: ' + comentario : 'Sem comentário.'}`);
    if (btn) { btn.textContent = 'Ver avaliação'; btn.disabled = false; }
  } catch {
    if (btn) { btn.textContent = 'Ver avaliação'; btn.disabled = false; }
  }
}
```

---

## OBSERVAÇÕES

- Após editar `forms.ts`, `clickup.ts` e `schema.ts`, rodar:
  ```
  cd artifacts/api-server && pnpm run build
  ```
- Executar as migrations SQL no banco PostgreSQL antes de subir o build
- O `clickup_url` tem formato `https://app.clickup.com/t/{taskId}`
  — verificar se o formato está correto para o workspace específico
- Para obter os IDs dos assignees, fazer a chamada à API do ClickUp
  antes de configurar as variáveis de ambiente:
  ```
  curl -H "Authorization: SEU_TOKEN" https://api.clickup.com/api/v2/team
  ```
- O dashboard de admin (ponto 6 do round) será tratado em prompt separado
  por ser uma feature grande e independente
