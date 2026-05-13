# Entrega direta para tipos de automação — sem aprovação, download imediato

## Contexto
Tipos de automação (assinatura-email, cartao-visita-digital, etc.) não passam
por aprovação. Ao concluir a geração, o status vai direto para `concluido`
e um card de download aparece na página da solicitação.

---

## 1. `artifacts/api-server/src/routes/gerador-assinatura.ts`

Mudar status de `em-aprovacao` para `concluido`:

```ts
// DE:
status: "em-aprovacao",

// PARA:
status: "concluido",
```

---

## 2. `artifacts/api-server/src/routes/forms.ts`

No endpoint POST /solicitacoes/:id/entrega, quando a solicitação for de um
tipo de automação, usar status `concluido` em vez de `em-aprovacao`:

```ts
const TIPOS_AUTOMACAO = [
  "assinatura-email",
  "cartao-visita-digital",
  "cartao-boas-vindas",
  "divulgacao-nps",
  "convite-fp",
  "certificado-eventos",
  "cartao-comemorativo",
];

// No handler do POST /entrega, ao fazer o update:
const novoStatus = TIPOS_AUTOMACAO.includes(solicitacao.tipo_solicitacao)
  ? "concluido"
  : "em-aprovacao";

await db.update(solicitacoesTable)
  .set({ entrega_links: links, status: novoStatus, updated_at: new Date() })
  .where(eq(solicitacoesTable.id, id));
```

---

## 3. `public/solicitacao.html`

### 3a. Adicionar função `renderEntregaAutomacao()`

Adicionar após a função `renderAprovacao()`:

```js
async function renderEntregaAutomacao(item) {
  const card = document.getElementById('aprovacaoCard');

  if (!TIPOS_AUTOMACAO.includes(item.tipo_solicitacao)) return;

  // Buscar links de entrega
  let links = [];
  try {
    const res = await fetch('/api/solicitacoes/' + item.id + '/entrega');
    if (res.ok) {
      const data = await res.json();
      links = data.links || [];
    }
  } catch {}

  if (links.length === 0) {
    // Ainda processando — mostrar estado de aguardo
    card.style.display = 'block';
    card.innerHTML = `
      <div class="form-card" style="padding:20px 24px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:rgba(34,27,25,0.07);display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div>
            <div style="font-weight:700;font-size:0.92rem">Processando...</div>
            <div style="font-size:0.78rem;opacity:0.42;margin-top:2px">
              Seu material está sendo gerado. Atualize a página em alguns instantes.
            </div>
          </div>
        </div>
      </div>`;
    return;
  }

  // Links disponíveis — mostrar card de download
  card.style.display = 'block';
  const botoesHtml = links.map(l => `
    <a href="${esc(l.url)}" target="_blank" rel="noopener"
       download
       style="
         display:inline-flex;align-items:center;gap:8px;
         padding:10px 20px;
         background:var(--carbon-black);color:var(--paper-white);
         border-radius:10px;text-decoration:none;
         font-weight:700;font-size:0.875rem;
         transition:opacity 0.15s;
         box-shadow:0 2px 8px rgba(34,27,25,0.2);
       "
       onmouseover="this.style.opacity='0.85'"
       onmouseout="this.style.opacity='1'">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      ${esc(l.label)}
    </a>
  `).join('');

  card.innerHTML = `
    <div class="form-card" style="padding:20px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(10,144,96,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#0A9060" stroke-width="2.2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div>
          <div style="font-weight:700;font-size:0.92rem">
            Material pronto para download
          </div>
          <div style="font-size:0.78rem;opacity:0.42;margin-top:2px">
            Clique no botão abaixo para baixar
          </div>
        </div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${botoesHtml}
      </div>
    </div>`;
}
```

### 3b. Chamar `renderEntregaAutomacao()` dentro de `renderPage()`

Localizar o trecho em `renderPage()` onde `renderAprovacao()` é chamado:

```js
// DE:
renderFluxo(item);
renderAprovacao(item, dados);
renderDados(dados, item);

// PARA:
renderFluxo(item);
if (TIPOS_AUTOMACAO.includes(item.tipo_solicitacao)) {
  renderEntregaAutomacao(item);  // ← card de download para automações
} else {
  renderAprovacao(item, dados);  // ← chat de aprovação para demais tipos
}
renderDados(dados, item);
```

### 3c. Remover guard que escondia o card para automações em `renderAprovacao()`

```js
// Localizar no início de renderAprovacao() e remover essas linhas
// (não são mais necessárias pois renderAprovacao nunca é chamado para automações):

// REMOVER:
if (TIPOS_AUTOMACAO.includes(item.tipo_solicitacao)) { card.style.display = 'none'; return; }
```

---

## 4. Build

```bash
cd artifacts/api-server && pnpm run build
```

Reiniciar o servidor após o build.

---

## Resultado esperado

1. Assessor envia formulário de assinatura de e-mail
2. Backend gera o PNG e salva no R2 (segundos)
3. Status muda direto para `concluido`
4. Na página da solicitação aparece card verde com botão de download
5. Assessor clica e baixa o PNG diretamente — sem aprovação, sem e-mail

## Estados do card para automações

- **Sem links + status recebido**: card "Processando..." com ícone de relógio
- **Com links + status concluido**: card verde com botão(ões) de download
- **Sem links + qualquer status**: card "Processando..." (geração ainda em curso)
