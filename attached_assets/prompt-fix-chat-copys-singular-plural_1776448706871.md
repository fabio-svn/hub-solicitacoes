# Adendo — Singular/plural em todas as mensagens do chat que referenciam arquivos

Este prompt complementa o `prompt-fix-chat-copys.md`.
Aplicar após ou junto com ele.

---

## `solicitacao.html`

### 1. Passar `quantidadeLinks` para todas as funções que precisam

Em `iniciarChat()`, garantir que `linksAtuais.length` está disponível
antes de todas as chamadas de mensagem:

```js
const plural = linksAtuais.length > 1;
```

---

### 2. Apresentação de arquivos — singular/plural

```js
// DE:
const apresentacaoLinks = pick([
  'Aqui estão os arquivos disponíveis:',
  'Esses são os arquivos para sua análise:',
  'Acesse os materiais pelo link abaixo:',
]);

// PARA:
const apresentacaoLinks = plural ? pick([
  'Aqui estão os arquivos disponíveis:',
  'Esses são os materiais para sua análise:',
  'Confira os arquivos abaixo:',
]) : pick([
  'Aqui está o arquivo disponível:',
  'Esse é o material para sua análise:',
  'Confira o arquivo abaixo:',
]);
```

---

### 3. Chamada para decisão — singular/plural

```js
// DE:
const chamadaDecisao = pick([
  'Por favor, analise os materiais e selecione uma das opções:',
  'Após revisar, selecione uma das opções abaixo:',
  'O que você acha? Selecione uma opção:',
]);

// PARA:
const chamadaDecisao = plural ? pick([
  'Por favor, analise os materiais e selecione uma das opções:',
  'Após revisar os arquivos, selecione uma das opções abaixo:',
  'O que você acha dos materiais? Selecione uma opção:',
]) : pick([
  'Por favor, analise o material e selecione uma das opções:',
  'Após revisar o arquivo, selecione uma das opções abaixo:',
  'O que você acha do material? Selecione uma opção:',
]);
```

---

### 4. Após aprovar — singular/plural

```js
// PARA:
const aposAprovar = plural ? pick([
  'Ótimo! Sua aprovação foi registrada. O time de marketing será notificado. 🎉',
  'Aprovação registrada! O time de marketing já foi notificado. 🎉',
  'Perfeito! Obrigado pela aprovação dos materiais. O time de marketing foi notificado. 🎉',
]) : pick([
  'Ótimo! Sua aprovação foi registrada. O time de marketing será notificado. 🎉',
  'Aprovação registrada! O time de marketing já foi notificado. 🎉',
  'Perfeito! Obrigado pela aprovação do material. O time de marketing foi notificado. 🎉',
]);
```

### 5. Passar `plural` para `acaoAprovar()` e `acaoSolicitarAlteracao()`

Como essas funções são chamadas por onclick dos botões — fora do escopo
de `iniciarChat()` — guardar o valor em `window._chatState`:

```js
// Em iniciarChat(), após definir plural, adicionar ao _chatState:
window._chatState = {
  solId: item.id,
  rodadaAtual,
  rodadas,
  nomeUsuario,
  fase: 'apresentacao',
  mensagensAlteracao: [],
  plural, // ← adicionar aqui
};
```

Então em `acaoAprovar()` e `acaoSolicitarAlteracao()`:

```js
const plural = window._chatState?.plural ?? false;
```

---

### 6. Ao solicitar alteração — singular/plural

```js
// PARA:
const inicioAlteracao = plural ? pick([
  'Claro! Descreva o que precisa ser alterado nos materiais. Pode enviar em várias mensagens — quando terminar, é só me dizer.',
  'Entendido! O que você gostaria de alterar nos arquivos? Pode detalhar à vontade — quando terminar, é só confirmar.',
  'Tudo bem! Descreva os ajustes necessários. Pode enviar em partes — quando quiser, finalizamos juntos.',
]) : pick([
  'Claro! Descreva o que precisa ser alterado. Pode enviar em várias mensagens — quando terminar, é só me dizer.',
  'Entendido! O que você gostaria de alterar? Pode detalhar à vontade — quando terminar, é só confirmar.',
  'Tudo bem! Descreva o ajuste necessário. Pode enviar em partes — quando quiser, finalizamos juntos.',
]);
```

---

### 7. Transcript — mensagem de aprovação — singular/plural

Em `renderTranscript()`, substituir a mensagem fixa por versão dinâmica:

```js
// DE:
`<div class="chat-msg sistema">
  <div class="chat-bubble" style="background:#d1fae5;border-color:#a7f3d0;color:#065f46">
    Aprovação registrada com sucesso! ✓
  </div>
</div>`

// PARA:
const pluralTranscript = (rodada.links?.length || 0) > 1;
const msgAprovacaoTranscript = pluralTranscript
  ? 'Aprovação dos materiais registrada com sucesso! ✓'
  : 'Aprovação do material registrada com sucesso! ✓';

`<div class="chat-msg sistema">
  ${SVN_AVATAR_HTML}
  <div class="chat-msg-col">
    <div class="chat-bubble" style="background:#d1fae5;border-color:#a7f3d0;color:#065f46">
      ${msgAprovacaoTranscript}
    </div>
  </div>
</div>`
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas `solicitacao.html`
- As mensagens "anotado", "enviando alteração", "alteração enviada" e
  "erro" não referenciam arquivos diretamente — não precisam de
  versão singular/plural
- O `plural` é calculado uma vez em `iniciarChat()` e propagado via
  `window._chatState.plural` para as funções de ação que rodam
  fora do escopo da função principal
