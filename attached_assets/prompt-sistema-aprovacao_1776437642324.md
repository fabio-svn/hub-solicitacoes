# Sistema de Aprovação — ClickUp + Mini-chat

---

## 1. Backend — Novos endpoints

### 1a. `forms.ts` — Endpoint para buscar links de entrega do ClickUp

Adicionar nova rota GET após o endpoint de status:

```ts
router.get("/solicitacoes/:id/entrega", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const conditions = [eq(solicitacoesTable.id, id)];
    if (user.role !== "admin" && user.role !== "gestor") {
      conditions.push(eq(solicitacoesTable.user_email, user.email));
    }

    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }
    if (!solicitacao.clickup_task_id) { res.json({ links: [], status: solicitacao.status }); return; }

    // Buscar campo "Entrega" da task no ClickUp
    const response = await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}`, {
      headers: { "Authorization": process.env.CLICKUP_API_TOKEN || "" },
    });
    if (!response.ok) { res.json({ links: [], status: solicitacao.status }); return; }

    const data = await response.json() as {
      custom_fields?: Array<{ id: string; value?: string }>;
      status?: { status: string };
    };

    // Campo Entrega: 4485ee1d-253f-4599-a66a-aa674deddf41
    const entregaField = data.custom_fields?.find(f => f.id === "4485ee1d-253f-4599-a66a-aa674deddf41");
    const entregaRaw = entregaField?.value || "";

    // Parsear links do campo — formato esperado: "Label: URL" por linha
    // Ex: "E-Book: https://... \n LP: https://..."
    const links: Array<{ label: string; url: string }> = [];
    if (entregaRaw) {
      entregaRaw.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const colonIdx = trimmed.indexOf(":");
        if (colonIdx > 0) {
          const label = trimmed.substring(0, colonIdx).trim();
          const url = trimmed.substring(colonIdx + 1).trim();
          if (url.startsWith("http")) links.push({ label, url });
        } else if (trimmed.startsWith("http")) {
          links.push({ label: "Arquivo", url: trimmed });
        }
      });
    }

    res.json({ links, status: solicitacao.status, taskId: solicitacao.clickup_task_id });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar entrega");
    res.status(500).json({ error: "Erro ao buscar links de entrega" });
  }
});
```

### 1b. `forms.ts` — Endpoint para enviar comentário de alteração ao ClickUp

```ts
router.post("/solicitacoes/:id/alteracao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { mensagem } = req.body as { mensagem: string };
    if (!mensagem || !mensagem.trim()) {
      res.status(400).json({ error: "Mensagem obrigatória" });
      return;
    }

    const conditions = [eq(solicitacoesTable.id, id), eq(solicitacoesTable.user_email, user.email)];
    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }
    if (!solicitacao.clickup_task_id) { res.status(400).json({ error: "Task não encontrada no ClickUp" }); return; }

    const token = process.env.CLICKUP_API_TOKEN || "";

    // Buscar responsável da task para mencionar
    let mentionText = "";
    try {
      const taskRes = await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}`, {
        headers: { "Authorization": token },
      });
      if (taskRes.ok) {
        const taskData = await taskRes.json() as { assignees?: Array<{ id: number; username: string }> };
        const firstAssignee = taskData.assignees?.[0];
        if (firstAssignee) {
          mentionText = `@${firstAssignee.username} `;
        }
      }
    } catch {}

    // Montar comentário
    const comentario = `${mentionText}✏️ Alteração solicitada por ${user.name}:\n\n${mensagem.trim()}`;

    const commentRes = await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: comentario }),
    });

    if (!commentRes.ok) {
      const errText = await commentRes.text();
      logger.error({ status: commentRes.status, body: errText }, "Erro ao comentar no ClickUp");
      res.status(500).json({ error: "Erro ao enviar alteração" });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao enviar alteração");
    res.status(500).json({ error: "Erro ao processar alteração" });
  }
});
```

### 1c. `forms.ts` — Endpoint para registrar aprovação

```ts
router.post("/solicitacoes/:id/aprovacao", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const conditions = [eq(solicitacoesTable.id, id), eq(solicitacoesTable.user_email, user.email)];
    const [solicitacao] = await db.select().from(solicitacoesTable).where(and(...conditions));
    if (!solicitacao) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }
    if (!solicitacao.clickup_task_id) { res.status(400).json({ error: "Task não encontrada no ClickUp" }); return; }

    const token = process.env.CLICKUP_API_TOKEN || "";

    // Comentar aprovação no ClickUp
    const comentario = `✅ Aprovado por ${user.name} em ${new Date().toLocaleDateString('pt-BR')}`;
    await fetch(`https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`, {
      method: "POST",
      headers: { "Authorization": token, "Content-Type": "application/json" },
      body: JSON.stringify({ comment_text: comentario }),
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao registrar aprovação");
    res.status(500).json({ error: "Erro ao registrar aprovação" });
  }
});
```

---

## 2. `solicitacao.html` — Implementar `renderAprovacao()`

Substituir a função `renderAprovacao()` vazia por:

```js
async function renderAprovacao(item, dados) {
  const card = document.getElementById('aprovacaoCard');

  // Só exibe se status for "em-aprovacao" ou posterior com histórico
  const statusComAprovacao = ['em-aprovacao', 'concluido', 'reprovado'];
  if (!statusComAprovacao.includes(item.status)) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  card.innerHTML = `
    <div class="form-card" style="padding:24px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(219,234,254,0.5);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <div>
          <div style="font-weight:700;font-size:0.95rem">Materiais para aprovação</div>
          <div style="font-size:0.8rem;opacity:0.5">Os arquivos da sua solicitação estão prontos</div>
        </div>
      </div>
      <div id="chatArea" style="background:var(--icon-bg);border-radius:12px;padding:20px;min-height:120px">
        <div id="chatLoading" style="text-align:center;padding:20px;opacity:0.4;font-size:0.85rem">Carregando arquivos...</div>
        <div id="chatContent" style="display:none"></div>
      </div>
    </div>`;

  // Buscar links de entrega
  try {
    const res = await fetch('/api/solicitacoes/' + item.id + '/entrega');
    const data = await res.json();

    document.getElementById('chatLoading').style.display = 'none';
    const chatContent = document.getElementById('chatContent');
    chatContent.style.display = 'block';

    const nomeUsuario = (await Auth.getUserName()) || 'você';

    if (!data.links || data.links.length === 0) {
      chatContent.innerHTML = `
        <p style="font-size:0.9rem;opacity:0.6;font-style:italic">
          Os arquivos ainda estão sendo preparados. Volte em breve.
        </p>`;
      return;
    }

    const linksHtml = data.links.map(link =>
      `<a href="${esc(link.url)}" target="_blank" rel="noopener"
         style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:var(--carbon-black);color:var(--paper-white);border-radius:8px;font-size:0.85rem;font-weight:600;text-decoration:none;transition:0.2s"
         onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        ${esc(link.label)}
      </a>`
    ).join('');

    // Estado inicial ou já aprovado
    const jaAprovado = item.status === 'concluido';

    chatContent.innerHTML = `
      <div style="margin-bottom:16px">
        <p style="font-size:0.9rem;line-height:1.6;margin-bottom:12px">
          Olá <strong>${esc(nomeUsuario)}</strong>,<br>
          Os materiais solicitados estão disponíveis!
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">
          ${linksHtml}
        </div>
      </div>

      ${jaAprovado ? `
        <div style="background:#d1fae5;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:0.85rem;font-weight:600;color:#065f46">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Solicitação aprovada
        </div>
      ` : `
        <div id="acaoAprovacao">
          <p style="font-size:0.85rem;opacity:0.6;margin-bottom:12px">Por favor, selecione uma das opções:</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button onclick="confirmarAprovacao(${item.id})"
              style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#16a34a;color:white;border:none;border-radius:8px;font-family:'Nunito Sans',sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;transition:0.2s"
              onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='#16a34a'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Aprovado
            </button>
            <button onclick="mostrarCampoAlteracao()"
              style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;background:#dc2626;color:white;border:none;border-radius:8px;font-family:'Nunito Sans',sans-serif;font-weight:700;font-size:0.9rem;cursor:pointer;transition:0.2s"
              onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Solicitar alterações
            </button>
          </div>
        </div>

        <div id="campoAlteracao" style="display:none;margin-top:16px">
          <p style="font-size:0.875rem;font-weight:600;margin-bottom:8px">O que gostaria que fosse alterado?</p>
          <textarea id="textoAlteracao" placeholder="Descreva as alterações necessárias..."
            style="width:100%;border:1px solid rgba(34,27,25,0.2);border-radius:8px;padding:12px;font-family:'Nunito Sans',sans-serif;font-size:0.875rem;min-height:100px;resize:vertical;box-sizing:border-box"></textarea>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button onclick="cancelarAlteracao()"
              style="padding:8px 16px;background:transparent;border:1px solid rgba(34,27,25,0.2);border-radius:8px;font-family:'Nunito Sans',sans-serif;font-size:0.85rem;cursor:pointer">
              Cancelar
            </button>
            <button onclick="confirmarAlteracao(${item.id})"
              style="padding:8px 20px;background:var(--ruby-red);color:white;border:none;border-radius:8px;font-family:'Nunito Sans',sans-serif;font-weight:700;font-size:0.85rem;cursor:pointer">
              Enviar
            </button>
          </div>
        </div>
      `}`;

  } catch (e) {
    document.getElementById('chatLoading').style.display = 'none';
    document.getElementById('chatContent').style.display = 'block';
    document.getElementById('chatContent').innerHTML =
      '<p style="font-size:0.85rem;color:var(--ruby-red)">Erro ao carregar arquivos. Tente recarregar a página.</p>';
  }
}

function mostrarCampoAlteracao() {
  document.getElementById('acaoAprovacao').style.display = 'none';
  document.getElementById('campoAlteracao').style.display = 'block';
  document.getElementById('textoAlteracao').focus();
}

function cancelarAlteracao() {
  document.getElementById('campoAlteracao').style.display = 'none';
  document.getElementById('acaoAprovacao').style.display = 'block';
  document.getElementById('textoAlteracao').value = '';
}

async function confirmarAprovacao(solicitacaoId) {
  const btnAprovado = document.querySelector('#acaoAprovacao button:first-child');
  if (!confirm('Confirmar aprovação dos materiais?')) return;

  btnAprovado.disabled = true;
  btnAprovado.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/solicitacoes/' + solicitacaoId + '/aprovacao', { method: 'POST' });
    if (res.ok) {
      document.getElementById('acaoAprovacao').innerHTML = `
        <div style="background:#d1fae5;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:8px;font-size:0.85rem;font-weight:600;color:#065f46">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Aprovação enviada com sucesso!
        </div>`;
    } else {
      btnAprovado.disabled = false;
      btnAprovado.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Aprovado';
      alert('Erro ao enviar aprovação. Tente novamente.');
    }
  } catch (e) {
    btnAprovado.disabled = false;
    alert('Erro de conexão.');
  }
}

async function confirmarAlteracao(solicitacaoId) {
  const mensagem = document.getElementById('textoAlteracao').value.trim();
  if (!mensagem) {
    document.getElementById('textoAlteracao').style.borderColor = 'var(--ruby-red)';
    return;
  }

  if (!confirm('Enviar solicitação de alteração?\n\n"' + mensagem + '"')) return;

  const btnEnviar = document.querySelector('#campoAlteracao button:last-child');
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  try {
    const res = await fetch('/api/solicitacoes/' + solicitacaoId + '/alteracao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem }),
    });
    if (res.ok) {
      document.getElementById('campoAlteracao').innerHTML = `
        <div style="background:#fef3c7;border-radius:8px;padding:12px 16px;font-size:0.85rem;color:#92660a">
          <strong>Alteração enviada!</strong> O time de marketing foi notificado e entrará em contato em breve.
        </div>`;
    } else {
      btnEnviar.disabled = false;
      btnEnviar.textContent = 'Enviar';
      alert('Erro ao enviar. Tente novamente.');
    }
  } catch (e) {
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar';
    alert('Erro de conexão.');
  }
}
```

---

## 3. `config.js` — Adicionar "em-aprovacao" ao `FLUXOS_ETAPAS._default`

Verificar que `em-aprovacao` já está no fluxo `_default` ✅
(foi adicionado em round anterior)

---

## OBSERVAÇÕES

- Após editar `forms.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- `solicitacao.html` não precisa de build
- O campo "Entrega" no ClickUp (ID: `4485ee1d-253f-4599-a66a-aa674deddf41`)
  deve ser preenchido no formato `Label: URL` por linha, ex:
  ```
  E-Book: https://drive.google.com/...
  Landing Page: https://sites.google.com/...
  ```
- A confirmação antes de enviar (botão Aprovar → confirm() e campo de
  alteração → confirm()) cobre o requisito de confirmação antes de enviar
- O sistema de notificação (como o solicitante será avisado) ainda será
  definido — o endpoint `/entrega` pode ser chamado periodicamente via
  polling ou no carregamento da página, que já é o comportamento atual
