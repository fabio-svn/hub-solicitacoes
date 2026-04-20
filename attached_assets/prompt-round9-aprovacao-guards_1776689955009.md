# Round 9 — Guards do chat de aprovação

---

## `solicitacao.html` — Bloquear chat quando status OU link estão incompletos

### Substituir a condição de exibição do card em `renderAprovacao()`

O card só deve aparecer ativo quando **ambas** as condições forem verdadeiras:
1. Status da solicitação = `em-aprovacao`
2. Campo "Entrega" do ClickUp tem pelo menos um link válido

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

  // Verificar histórico local — se há rodadas salvas, mostrar card
  // mesmo que status tenha mudado (para exibir histórico)
  const temHistorico = getRodadas(item.id).length > 0;
  const statusComAprovacao = ['em-aprovacao', 'concluido', 'reprovado'];

  if (!statusComAprovacao.includes(item.status) && !temHistorico) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  // ... (resto do código de renderização do card — igual ao prompt anterior)
}
```

### Em `iniciarChat()` — verificar links antes de iniciar o fluxo

```js
async function iniciarChat(item) {
  // ...buscar links...
  const { links: linksAtuais = [] } = await fetch(...).then(r => r.json()).catch(() => ({}));

  document.getElementById('chatLoading').style.display = 'none';
  document.getElementById('chatUI').style.display = 'block';

  // GUARD: status deve ser em-aprovacao E ter links
  // Se tem histórico mas não está mais em-aprovacao, mostrar só transcript
  if (item.status !== 'em-aprovacao') {
    const rodadas = getRodadas(item.id);
    if (rodadas.length > 0) {
      const ultima = rodadas[rodadas.length - 1];
      renderHistoricoRodadas(rodadas.slice(0, -1));
      renderTranscript(ultima, nomeUsuario);
      document.getElementById('chatInputArea').style.display = 'none';
    } else {
      document.getElementById('chatWrap').innerHTML =
        `<p style="padding:16px;font-size:0.85rem;opacity:0.5;font-style:italic">
          Nenhum histórico de aprovação disponível.
        </p>`;
      document.getElementById('chatInputArea').style.display = 'none';
    }
    return;
  }

  // GUARD: status é em-aprovacao mas sem links ainda
  if (linksAtuais.length === 0) {
    document.getElementById('chatWrap').innerHTML = `
      <div class="chat-msg sistema">
        ${SVN_AVATAR_HTML}
        <div class="chat-msg-col">
          <div class="chat-bubble">
            Os arquivos desta solicitação serão entregues diretamente pelo time de marketing.
            Aguarde o contato da equipe.
          </div>
        </div>
      </div>`;
    document.getElementById('chatInputArea').style.display = 'none';
    return;
  }

  // Ambas condições OK — iniciar chat normalmente
  const { rodadas, rodadaAtual, isNova } = resolveRodadaAtual(item.id, linksAtuais);
  // ... resto do fluxo normal
}
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas `solicitacao.html`
- A mensagem para "em-aprovacao sem links" é neutra e não implica
  que os arquivos vão chegar pelo sistema — cobre o caso de entregas
  por outros canais
- O card ainda aparece (como informativo) quando está em-aprovacao
  sem links, mas sem botões de ação — o usuário não fica bloqueado
  nem confuso
