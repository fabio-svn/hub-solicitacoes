# Melhoria visual — Chat de aprovação

---

## `solicitacao.html` — Atualizar estilos e estrutura do chat

### 1. Substituir estilos do chat no bloco `<style>`

```css
/* ── Chat de aprovação — visual atualizado ───── */

/* Fundo do chat */
.chat-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 16px;
  max-height: 420px;
  overflow-y: auto;
  scroll-behavior: smooth;
  background: #ede8e3;
  border-radius: 0 0 0 0; /* sem radius aqui, o card pai já tem */
}

/* Mensagem (linha com avatar + bolha) */
.chat-msg {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  max-width: 88%;
}

.chat-msg.sistema { align-self: flex-start; }
.chat-msg.usuario {
  align-self: flex-end;
  flex-direction: row-reverse;
}

/* Avatar SVN */
.chat-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--carbon-black);
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(34,27,25,0.18);
}

.chat-avatar img {
  width: 16px;
  height: 16px;
  object-fit: contain;
  filter: invert(1); /* logo escura sobre fundo preto */
}

/* Coluna de bolha + hora */
.chat-msg-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.chat-msg.usuario .chat-msg-col { align-items: flex-end; }

/* Bolha */
.chat-bubble {
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 0.875rem;
  line-height: 1.55;
  word-break: break-word;
}

.chat-msg.sistema .chat-bubble {
  background: #ffffff;
  border-bottom-left-radius: 4px;
  color: var(--carbon-black);
  box-shadow: 0 1px 3px rgba(34,27,25,0.08), 0 2px 8px rgba(34,27,25,0.06);
}

.chat-msg.usuario .chat-bubble {
  background: var(--carbon-black);
  color: var(--paper-white);
  border-bottom-right-radius: 4px;
  box-shadow: 0 1px 3px rgba(34,27,25,0.15), 0 2px 8px rgba(34,27,25,0.1);
}

.chat-msg .chat-time {
  font-size: 0.68rem;
  opacity: 0.35;
  padding: 0 4px;
}

/* Indicador digitando */
.chat-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  background: #ffffff;
  border-radius: 18px;
  border-bottom-left-radius: 4px;
  width: fit-content;
  box-shadow: 0 1px 3px rgba(34,27,25,0.08), 0 2px 8px rgba(34,27,25,0.06);
}

.chat-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(34,27,25,0.3);
  animation: typing-dot 1.2s infinite;
}
.chat-typing span:nth-child(2) { animation-delay: 0.2s; }
.chat-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
  30%            { transform: translateY(-5px); opacity: 1; }
}

/* Input area */
.chat-input-area {
  border-top: 1px solid rgba(34,27,25,0.08);
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
  background: #ede8e3;
}

.chat-input-area textarea {
  flex: 1;
  border: none;
  border-radius: 20px;
  padding: 10px 16px;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 0.875rem;
  resize: none;
  min-height: 40px;
  max-height: 120px;
  line-height: 1.4;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(34,27,25,0.08);
  transition: box-shadow 0.2s;
  box-sizing: border-box;
}

.chat-input-area textarea:focus {
  outline: none;
  box-shadow: 0 1px 3px rgba(34,27,25,0.08), 0 0 0 2px rgba(34,27,25,0.15);
}

.chat-input-area textarea:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-send-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: var(--carbon-black);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.2s, transform 0.15s;
  box-shadow: 0 2px 6px rgba(34,27,25,0.2);
}

.chat-send-btn:hover:not(:disabled) { transform: scale(1.06); }
.chat-send-btn:disabled { opacity: 0.25; cursor: not-allowed; }

/* Links de arquivo */
.chat-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--carbon-black);
  color: var(--paper-white);
  border-radius: 10px;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.2s;
  margin: 2px 4px 2px 0;
  box-shadow: 0 1px 4px rgba(34,27,25,0.2);
}
.chat-link-btn:hover { opacity: 0.8; }

/* Botões de ação */
.chat-action-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.btn-aprovar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: #16a34a;
  color: white;
  border: none;
  border-radius: 10px;
  font-family: 'Nunito Sans', sans-serif;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 6px rgba(22,163,74,0.3);
}
.btn-aprovar:hover { background: #15803d; }

.btn-alterar {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 10px;
  font-family: 'Nunito Sans', sans-serif;
  font-weight: 700;
  font-size: 0.875rem;
  cursor: pointer;
  transition: background 0.2s;
  box-shadow: 0 2px 6px rgba(220,38,38,0.3);
}
.btn-alterar:hover { background: #b91c1c; }

/* Badge de rodada */
.chat-rodada-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.chat-rodada-badge span {
  background: rgba(34,27,25,0.07);
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: rgba(34,27,25,0.4);
  padding: 3px 12px;
  text-transform: uppercase;
}

/* Histórico de rodadas */
.rodada-historico {
  border: 1px solid rgba(34,27,25,0.08);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}

.rodada-historico-header {
  padding: 10px 16px;
  background: rgba(34,27,25,0.04);
  font-size: 0.8rem;
  font-weight: 600;
  opacity: 0.6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}

.rodada-historico-body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
```

---

### 2. Atualizar `adicionarMensagemUsuario()` — sem avatar, bolha à direita

Substituir:
```js
function adicionarMensagemUsuario(texto) {
  const wrap = document.getElementById('chatWrap');
  if (!wrap) return;
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'chat-msg usuario';
  div.innerHTML = `<div class="chat-bubble">${esc(texto)}</div><span class="chat-time">${hora}</span>`;
  wrap.appendChild(div);
  scrollChatBottom();
}
```

Por:
```js
function adicionarMensagemUsuario(texto) {
  const wrap = document.getElementById('chatWrap');
  if (!wrap) return;
  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'chat-msg usuario';
  div.innerHTML = `
    <div class="chat-msg-col">
      <div class="chat-bubble">${esc(texto)}</div>
      <span class="chat-time">${hora}</span>
    </div>`;
  wrap.appendChild(div);
  scrollChatBottom();
}
```

---

### 3. Atualizar `mensagemSistema()` — adicionar avatar SVN

Substituir:
```js
async function mensagemSistema(html, isError = false, extraHtml = '') {
  const wrap = document.getElementById('chatWrap');
  if (!wrap) return;

  // Indicador "digitando..."
  const typing = document.createElement('div');
  typing.className = 'chat-msg sistema';
  typing.innerHTML = `<div class="chat-typing"><span></span><span></span><span></span></div>`;
  wrap.appendChild(typing);
  scrollChatBottom();

  await delay(1200);
  wrap.removeChild(typing);

  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'chat-msg sistema';
  div.innerHTML = `
    <div class="chat-bubble" style="${isError ? 'border-color:var(--ruby-red);color:var(--ruby-red)' : ''}">${html}</div>
    ${extraHtml ? `<div style="padding:0 4px;margin-top:4px">${extraHtml}</div>` : ''}
    <span class="chat-time">${hora}</span>`;
  wrap.appendChild(div);
  scrollChatBottom();
}
```

Por:
```js
const SVN_AVATAR_HTML = `
  <div class="chat-avatar">
    <img src="https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-1.svg" alt="SVN" />
  </div>`;

async function mensagemSistema(html, isError = false, extraHtml = '') {
  const wrap = document.getElementById('chatWrap');
  if (!wrap) return;

  // Typing: avatar + pontinhos
  const typing = document.createElement('div');
  typing.className = 'chat-msg sistema';
  typing.innerHTML = `
    ${SVN_AVATAR_HTML}
    <div class="chat-typing"><span></span><span></span><span></span></div>`;
  wrap.appendChild(typing);
  scrollChatBottom();

  await delay(1200);
  wrap.removeChild(typing);

  const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = 'chat-msg sistema';
  div.innerHTML = `
    ${SVN_AVATAR_HTML}
    <div class="chat-msg-col">
      <div class="chat-bubble" style="${isError ? 'color:var(--ruby-red)' : ''}">${html}</div>
      ${extraHtml ? `<div style="padding:0 4px;margin-top:4px">${extraHtml}</div>` : ''}
      <span class="chat-time">${hora}</span>
    </div>`;
  wrap.appendChild(div);
  scrollChatBottom();
}
```

---

### 4. Atualizar `renderTranscript()` — mesmo padrão visual

No `renderTranscript()`, substituir as bolhas do sistema para usar o mesmo
padrão de avatar + `.chat-msg-col`:

```js
// Substituir cada bloco de mensagem do sistema dentro do innerHTML por:

// DE (sistema):
`<div class="chat-msg sistema">
  <div class="chat-bubble">...</div>
  <span class="chat-time">...</span>
</div>`

// PARA (sistema com avatar):
`<div class="chat-msg sistema">
  ${SVN_AVATAR_HTML}
  <div class="chat-msg-col">
    <div class="chat-bubble">...</div>
    <span class="chat-time">...</span>
  </div>
</div>`

// E mensagens do usuário:
// DE:
`<div class="chat-msg usuario"><div class="chat-bubble">...</div></div>`

// PARA:
`<div class="chat-msg usuario">
  <div class="chat-msg-col">
    <div class="chat-bubble">...</div>
  </div>
</div>`
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas `solicitacao.html`
- O fundo `#ede8e3` é um tom levemente mais escuro/quente que o Paper White
  `#FFF8F3`, mantendo o light mode mas dando profundidade ao chat
- O `filter: invert(1)` na logo assume que o SVG é escuro sobre fundo
  transparente — se a logo já for branca, remover o filter
- A sombra nas bolhas (`box-shadow`) é sutil — dupla camada (sharp + difusa)
  igual ao padrão das referências enviadas
- O input também ganhou fundo branco com sombra para se destacar do
  fundo `#ede8e3` da área de input
