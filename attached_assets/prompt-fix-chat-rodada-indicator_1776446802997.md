# Adendo — Indicador de rodada atual no chat de aprovação

---

## `solicitacao.html` — Adicionar badge de rodada no chat ativo

### Localizar o início da função `iniciarChat()`, após renderizar o histórico de rodadas anteriores e antes de adicionar a primeira mensagem do sistema:

```js
// Adicionar após: renderHistoricoRodadas(rodadas.slice(0, -1));

// Badge da rodada atual
const chatWrap = document.getElementById('chatWrap');
if (chatWrap && rodadas.length > 0) {
  const badgeRodada = document.createElement('div');
  badgeRodada.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  `;
  badgeRodada.innerHTML = `
    <span style="
      background: var(--icon-bg);
      border: 1px solid rgba(34,27,25,0.1);
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: rgba(34,27,25,0.45);
      padding: 3px 12px;
      text-transform: uppercase;
    ">Rodada ${rodadaAtual.numero}</span>`;
  chatWrap.appendChild(badgeRodada);
}
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas `solicitacao.html`
- O badge aparece centralizado acima da primeira mensagem do chat ativo,
  separando visualmente o histórico das rodadas anteriores do chat atual
- Quando há apenas uma rodada (primeira vez), o badge mostra "Rodada 1"
  — discreto mas útil para o usuário entender o contexto desde o início
