# Round 10 — Guard duplo no botão de aprovação

O botão de aprovação só deve aparecer quando AMBAS as condições
forem verdadeiras simultaneamente:
1. Status da solicitação = `em-aprovacao`
2. Campo "Entrega" do ClickUp tem pelo menos um link válido

---

## `solicitacao.html` — Substituir lógica em `renderAprovacao()`

A função atualmente mostra o card quando `item.status === 'em-aprovacao'`
e só verifica os links ao abrir o sanfona. Precisa verificar os links
ANTES de mostrar o card.

### Substituir `renderAprovacao()` por versão com pré-verificação:

```js
async function renderAprovacao(item, dados) {
  const card = document.getElementById('aprovacaoCard');

  // Tipos sem fluxo de aprovação
  const tiposComAprovacao = [
    'eventos', 'artes-divulgacao', 'atualizacao-material',
    'conteudo-pdf-informativo', 'conteudo-pdf-ebook',
    'apresentacao-nova', 'apresentacao-atualizar',
  ];
  if (!tiposComAprovacao.includes(item.tipo_solicitacao)) {
    card.style.display = 'none';
    return;
  }

  // Mostrar histórico se houver rodadas salvas (independente do status atual)
  const temHistorico = getRodadas(item.id).length > 0;

  // Se status não é em-aprovacao e não tem histórico, esconder
  if (item.status !== 'em-aprovacao' && !temHistorico) {
    card.style.display = 'none';
    return;
  }

  // Se status é em-aprovacao, verificar se há links ANTES de mostrar o card
  if (item.status === 'em-aprovacao') {
    let temLinks = false;
    try {
      const res = await fetch('/api/solicitacoes/' + item.id + '/entrega');
      if (res.ok) {
        const data = await res.json();
        temLinks = data.links && data.links.length > 0;
      }
    } catch {}

    if (!temLinks) {
      // Sem links — esconder completamente (sem mensagem, sem card)
      card.style.display = 'none';
      return;
    }
  }

  // Ambas condições OK (ou tem histórico) — renderizar card normalmente
  card.style.display = 'block';

  const storageKey = 'aprovacao_visto_' + item.id;
  const jaVisto = localStorage.getItem(storageKey) === '1';
  const mostrarDestaque = item.status === 'em-aprovacao' && !jaVisto;

  // ... resto do código de renderização do card (igual ao existente)
}
```

**Observação:** a pré-verificação faz uma chamada extra ao `/entrega`
antes de mostrar o card. Para evitar delay perceptível, pode ser feita
em paralelo com outras chamadas no `loadSolicitacao()`:

```js
async function loadSolicitacao() {
  const [res] = await Promise.all([
    fetch('/api/solicitacoes/' + solicitacaoId),
  ]);
  if (!res.ok) { window.location.href = '/dashboard.html'; return; }
  const item = await res.json();
  syncStatus(item);
  renderPage(item);
}
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas `solicitacao.html`
- A pré-verificação consome uma chamada extra à API apenas quando
  `status === 'em-aprovacao'` — nos demais casos o guard é local
- Se houver histórico de rodadas anteriores (localStorage), o card
  aparece para exibir o histórico mesmo sem links atuais
