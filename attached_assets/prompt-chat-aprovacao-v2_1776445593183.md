# Sistema de Aprovação v2 — Chat com bolhas, rodadas e histórico persistente

---

## VISÃO GERAL

O sistema de aprovação funciona como um chat real com:
- Bolhas de mensagem (sistema à esquerda, usuário à direita)
- Indicador "digitando..." antes de cada resposta do sistema
- Scroll automático a cada nova mensagem
- Campo de input fixo no rodapé
- Histórico persistente em `localStorage` por rodada
- Múltiplas rodadas quando o link de entrega muda após revisão
- Chat congelado como transcript após decisão final

---

## 1. `solicitacao.html` — Estilos do chat

Adicionar ao bloco `<style>` existente:

```css
/* ── Chat de aprovação ───────────────────────── */
.chat-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  max-height: 420px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.chat-msg {
  display: flex;
  flex-direction: column;
  max-width: 82%;
  gap: 3px;
}

.chat-msg.sistema { align-self: flex-start; }
.chat-msg.usuario { align-self: flex-end; align-items: flex-end; }

.chat-bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 0.875rem;
  line-height: 1.55;
  word-break: break-word;
}

.chat-msg.sistema .chat-bubble {
  background: var(--paper-white);
  border: 1px solid rgba(34,27,25,0.1);
  border-bottom-left-radius: 4px;
  color: var(--carbon-black);
}

.chat-msg.usuario .chat-bubble {
  background: var(--carbon-black);
  color: var(--paper-white);
  border-bottom-right-radius: 4px;
}

.chat-msg .chat-time {
  font-size: 0.7rem;
  opacity: 0.35;
  padding: 0 4px;
}

.chat-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  background: var(--paper-white);
  border: 1px solid rgba(34,27,25,0.1);
  border-radius: 16px;
  border-bottom-left-radius: 4px;
  width: fit-content;
}

.chat-typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(34,27,25,0.35);
  animation: typing-dot 1.2s infinite;
}
.chat-typing span:nth-child(2) { animation-delay: 0.2s; }
.chat-typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
  30%            { transform: translateY(-5px); opacity: 1; }
}

.chat-input-area {
  border-top: 1px solid rgba(34,27,25,0.08);
  padding: 12px 16px;
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input-area textarea {
  flex: 1;
  border: 1px solid rgba(34,27,25,0.15);
  border-radius: 12px;
  padding: 10px 14px;
  font-family: 'Nunito Sans', sans-serif;
  font-size: 0.875rem;
  resize: none;
  min-height: 40px;
  max-height: 120px;
  line-height: 1.4;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.chat-input-area textarea:focus {
  outline: none;
  border-color: var(--carbon-black);
}

.chat-input-area textarea:disabled {
  background: transparent;
  opacity: 0.4;
  cursor: not-allowed;
}

.chat-send-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--carbon-black);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: opacity 0.2s;
}

.chat-send-btn:disabled { opacity: 0.25; cursor: not-allowed; }

.chat-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--carbon-black);
  color: var(--paper-white);
  border-radius: 8px;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.2s;
  margin: 2px 4px 2px 0;
}
.chat-link-btn:hover { opacity: 0.8; }

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
}
.btn-alterar:hover { background: #b91c1c; }

.rodada-historico {
  border: 1px solid rgba(34,27,25,0.08);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 12px;
}

.rodada-historico-header {
  padding: 10px 16px;
  background: var(--icon-bg);
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

## 2. `solicitacao.html` — Sistema de rodadas e chat

### 2a. Funções de storage de rodadas

Adicionar ao script:

```js
const APROVACAO_KEY = id => 'aprovacao_v2_' + id;

function getRodadas(solId) {
  try {
    const raw = localStorage.getItem(APROVACAO_KEY(solId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRodadas(solId, rodadas) {
  try {
    localStorage.setItem(APROVACAO_KEY(solId), JSON.stringify(rodadas));
  } catch {}
}

function getLinksHash(links) {
  return links.map(l => l.url).sort().join('|');
}

function resolveRodadaAtual(solId, linksAtuais) {
  const rodadas = getRodadas(solId);
  if (rodadas.length === 0) {
    // Primeira rodada
    const nova = { numero: 1, links: linksAtuais, decisao: null, mensagens: [], data: new Date().toISOString() };
    saveRodadas(solId, [nova]);
    return { rodadas: [nova], rodadaAtual: nova, isNova: true };
  }
  const ultima = rodadas[rodadas.length - 1];
  const hashAtual = getLinksHash(linksAtuais);
  const hashUltima = getLinksHash(ultima.links || []);

  if (ultima.decisao !== null && hashAtual !== hashUltima) {
    // Links mudaram após decisão anterior → nova rodada
    const nova = { numero: rodadas.length + 1, links: linksAtuais, decisao: null, mensagens: [], data: new Date().toISOString() };
    rodadas.push(nova);
    saveRodadas(solId, rodadas);
    return { rodadas, rodadaAtual: nova, isNova: true };
  }

  if (ultima.decisao !== null) {
    // Links iguais mas já decidido — mostrar histórico apenas
    return { rodadas, rodadaAtual: ultima, isNova: false };
  }

  // Rodada em aberto
  return { rodadas, rodadaAtual: ultima, isNova: false };
}
```

### 2b. Substituir `renderAprovacao()` completamente

```js
async function renderAprovacao(item, dados) {
  const card = document.getElementById('aprovacaoCard');
  const statusComAprovacao = ['em-aprovacao', 'concluido', 'reprovado', 'em-revisao'];
  const temHistorico = getRodadas(item.id).length > 0;

  if (!statusComAprovacao.includes(item.status) && !temHistorico) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';

  const storageKey = 'aprovacao_visto_' + item.id;
  const jaVisto = localStorage.getItem(storageKey) === '1';
  const mostrarDestaque = item.status === 'em-aprovacao' && !jaVisto;

  card.innerHTML = `
    <div class="form-card" id="aprovacaoCardInner" style="overflow:hidden;padding:0;transition:box-shadow 0.4s ease;${
      mostrarDestaque ? 'box-shadow:0 0 0 2px var(--ruby-red),0 8px 32px rgba(172,54,49,0.18);' : ''
    }">
      <!-- Header clicável -->
      <div id="aprovacaoHeader" style="padding:20px 24px;cursor:pointer;display:flex;align-items:center;gap:12px">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(219,234,254,0.5);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-weight:700;font-size:0.95rem;display:flex;align-items:center;gap:8px">
            Materiais para aprovação
            ${mostrarDestaque ? '<span style="background:var(--ruby-red);color:white;font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:999px;animation:badgePop 0.4s ease forwards">NOVO</span>' : ''}
          </div>
          <div style="font-size:0.8rem;opacity:0.5" id="aprovacaoSubtitle">
            ${item.status === 'em-aprovacao' ? 'Os materiais estão prontos para sua análise' : 'Histórico de aprovação'}
          </div>
        </div>
        <svg id="aprovacaoChevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.35;transition:transform 0.25s;flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
      </div>

      <!-- Corpo sanfona -->
      <div id="aprovacaoBody" style="max-height:0;overflow:hidden;transition:max-height 0.35s ease">
        <div style="border-top:1px solid rgba(34,27,25,0.07)">
          <div id="chatLoading" style="padding:24px;text-align:center;opacity:0.4;font-size:0.85rem">
            Carregando...
          </div>
          <div id="chatUI" style="display:none">
            <!-- Histórico de rodadas anteriores -->
            <div id="historicoRodadas" style="padding:0 16px;padding-top:16px"></div>
            <!-- Chat ativo -->
            <div class="chat-wrap" id="chatWrap"></div>
            <!-- Input fixo -->
            <div class="chat-input-area" id="chatInputArea">
              <textarea id="chatInput" placeholder="Digite sua mensagem..." rows="1" disabled
                oninput="autoResizeTextarea(this)"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();enviarMensagemUsuario()}"
              ></textarea>
              <button class="chat-send-btn" id="chatSendBtn" disabled onclick="enviarMensagemUsuario()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  // Controle do sanfona
  let aberto = false;
  let carregado = false;

  document.getElementById('aprovacaoHeader').onclick = async () => {
    aberto = !aberto;
    const body = document.getElementById('aprovacaoBody');
    const chevron = document.getElementById('aprovacaoChevron');
    chevron.style.transform = aberto ? 'rotate(180deg)' : 'rotate(0deg)';

    if (aberto) {
      body.style.maxHeight = '700px';
      localStorage.setItem(storageKey, '1');
      if (mostrarDestaque) {
        document.getElementById('aprovacaoCardInner').style.boxShadow = '';
      }
      if (!carregado) {
        carregado = true;
        await iniciarChat(item);
      }
    } else {
      body.style.maxHeight = '0';
    }
  };
}
```

### 2c. Função principal do chat `iniciarChat()`

```js
async function iniciarChat(item) {
  const nomeUsuario = dados_globais?.nome || item.user_name || 'você';

  // Buscar links do ClickUp
  let linksAtuais = [];
  try {
    const res = await fetch('/api/solicitacoes/' + item.id + '/entrega');
    const data = await res.json();
    linksAtuais = data.links || [];
  } catch {}

  document.getElementById('chatLoading').style.display = 'none';
  document.getElementById('chatUI').style.display = 'block';

  // Resolver rodada atual
  const { rodadas, rodadaAtual, isNova } = resolveRodadaAtual(item.id, linksAtuais);

  // Renderizar histórico de rodadas anteriores
  renderHistoricoRodadas(rodadas.slice(0, -1));

  // Iniciar chat da rodada atual
  const jaDecidido = rodadaAtual.decisao !== null;

  if (jaDecidido) {
    // Mostrar transcript congelado
    renderTranscript(rodadaAtual, nomeUsuario);
    document.getElementById('chatInputArea').style.display = 'none';
    return;
  }

  // Chat ativo
  window._chatState = {
    solId: item.id,
    rodadaAtual,
    rodadas,
    nomeUsuario,
    fase: 'apresentacao', // apresentacao → decisao → alteracao_input → alteracao_confirmacao → finalizado
    mensagensAlteracao: [],
  };

  // Iniciar conversa
  await mensagemSistema(gerarMensagemBoasVindas(nomeUsuario, rodadaAtual, isNova));

  if (linksAtuais.length === 0) {
    await mensagemSistema('Os arquivos ainda estão sendo preparados. Volte em breve.');
    document.getElementById('chatInputArea').style.display = 'none';
    return;
  }

  await delay(800);
  await mensagemSistema(renderLinksMsg(linksAtuais), true);
  await delay(1000);
  await mensagemSistema('Por favor, analise os materiais e selecione uma das opções:', false, renderBotoesDecisao());
  window._chatState.fase = 'decisao';
}

function gerarMensagemBoasVindas(nome, rodada, isNova) {
  const primeiroNome = nome.split(' ')[0];
  if (rodada.numero === 1) return `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais da sua solicitação estão prontos. 🎉`;
  return `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais foram revisados e uma nova versão está disponível. Veja o que foi atualizado abaixo.`;
}

function renderLinksMsg(links) {
  const btns = links.map(l =>
    `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="chat-link-btn">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      ${esc(l.label)}
    </a>`
  ).join('');
  return `Aqui estão os arquivos disponíveis:<br><div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">${btns}</div>`;
}

function renderBotoesDecisao() {
  return `<div class="chat-action-btns">
    <button class="btn-aprovar" onclick="acaoAprovar()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Aprovado
    </button>
    <button class="btn-alterar" onclick="acaoSolicitarAlteracao()">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Solicitar alterações
    </button>
  </div>`;
}
```

### 2d. Funções de interação do chat

```js
async function acaoAprovar() {
  if (window._chatState?.fase !== 'decisao') return;
  window._chatState.fase = 'finalizado';
  desabilitarInput();
  removerBotoesDecisao();

  // Bolha do usuário
  adicionarMensagemUsuario('Aprovado ✓');
  await delay(900);
  await mensagemSistema('Ótimo! Sua aprovação foi registrada. O time de marketing será notificado. 🎉');

  // Registrar no ClickUp
  try {
    await fetch('/api/solicitacoes/' + window._chatState.solId + '/aprovacao', { method: 'POST' });
  } catch {}

  // Salvar decisão
  const rodadas = getRodadas(window._chatState.solId);
  const ultima = rodadas[rodadas.length - 1];
  ultima.decisao = 'aprovado';
  ultima.dataDecisao = new Date().toISOString();
  saveRodadas(window._chatState.solId, rodadas);

  document.getElementById('chatInputArea').style.display = 'none';
}

async function acaoSolicitarAlteracao() {
  if (window._chatState?.fase !== 'decisao') return;
  window._chatState.fase = 'alteracao_input';
  removerBotoesDecisao();

  adicionarMensagemUsuario('Solicitar alterações');
  await delay(900);
  await mensagemSistema('Claro! Descreva o que precisa ser alterado. Pode enviar em várias mensagens — quando terminar, é só me dizer.');

  habilitarInput('Descreva a alteração...');
}

async function enviarMensagemUsuario() {
  const input = document.getElementById('chatInput');
  const texto = input.value.trim();
  if (!texto || !window._chatState) return;

  const fase = window._chatState.fase;
  if (fase !== 'alteracao_input') return;

  input.value = '';
  input.style.height = 'auto';
  desabilitarInput();

  adicionarMensagemUsuario(texto);
  window._chatState.mensagensAlteracao.push(texto);

  await delay(1000);
  await mensagemSistema(
    `Anotado! Gostaria de acrescentar mais alguma coisa?`,
    false,
    `<div class="chat-action-btns" style="margin-top:6px">
      <button class="btn-aprovar" style="background:#2563eb" onclick="acaoTemMais()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Sim, tenho mais
      </button>
      <button class="btn-alterar" style="background:#7c3aed" onclick="acaoFinalizarAlteracao()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
        Não, pode enviar
      </button>
    </div>`
  );
  window._chatState.fase = 'alteracao_confirmacao';
}

async function acaoTemMais() {
  if (window._chatState?.fase !== 'alteracao_confirmacao') return;
  window._chatState.fase = 'alteracao_input';
  removerBotoesDecisao();
  await delay(300);
  habilitarInput('Acrescente mais detalhes...');
}

async function acaoFinalizarAlteracao() {
  if (window._chatState?.fase !== 'alteracao_confirmacao') return;
  window._chatState.fase = 'finalizado';
  removerBotoesDecisao();
  desabilitarInput();

  adicionarMensagemUsuario('Não, pode enviar.');
  await delay(900);
  await mensagemSistema('Perfeito! Enviando sua solicitação de alteração...');

  const mensagens = window._chatState.mensagensAlteracao;
  const mensagemFormatada = mensagens.length === 1
    ? mensagens[0]
    : mensagens.map((m, i) => `${i + 1}. ${m}`).join('\n');

  // Enviar para o ClickUp
  let sucesso = false;
  try {
    const res = await fetch('/api/solicitacoes/' + window._chatState.solId + '/alteracao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem: mensagemFormatada }),
    });
    sucesso = res.ok;
  } catch {}

  await delay(600);
  if (sucesso) {
    await mensagemSistema('Alteração enviada com sucesso! O time de marketing foi notificado e entrará em contato em breve. ✉️');
  } else {
    await mensagemSistema('Houve um erro ao enviar. Por favor, tente novamente ou entre em contato com o time de marketing.', true);
    window._chatState.fase = 'alteracao_input';
    habilitarInput('Tente novamente...');
    return;
  }

  // Salvar decisão
  const rodadas = getRodadas(window._chatState.solId);
  const ultima = rodadas[rodadas.length - 1];
  ultima.decisao = 'alteracao';
  ultima.mensagens = mensagens;
  ultima.dataDecisao = new Date().toISOString();
  saveRodadas(window._chatState.solId, rodadas);

  document.getElementById('chatInputArea').style.display = 'none';
}
```

### 2e. Funções utilitárias do chat

```js
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function autoResizeTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function scrollChatBottom() {
  const wrap = document.getElementById('chatWrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

function habilitarInput(placeholder) {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  if (input) { input.disabled = false; input.placeholder = placeholder || 'Digite sua mensagem...'; input.focus(); }
  if (btn) btn.disabled = false;
}

function desabilitarInput() {
  const input = document.getElementById('chatInput');
  const btn = document.getElementById('chatSendBtn');
  if (input) input.disabled = true;
  if (btn) btn.disabled = true;
}

function removerBotoesDecisao() {
  document.querySelectorAll('.chat-action-btns').forEach(el => el.remove());
}

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

function renderTranscript(rodada, nomeUsuario) {
  const wrap = document.getElementById('chatWrap');
  if (!wrap) return;

  // Mensagem inicial do sistema
  const primeiroNome = nomeUsuario.split(' ')[0];
  const msgInicial = rodada.numero === 1
    ? `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais da sua solicitação estiveram disponíveis.`
    : `Olá, <strong>${esc(primeiroNome)}</strong>! Os materiais revisados estiveram disponíveis.`;

  const hora = rodada.data
    ? new Date(rodada.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  wrap.innerHTML = `
    <div class="chat-msg sistema">
      <div class="chat-bubble">${msgInicial}</div>
      <span class="chat-time">${hora}</span>
    </div>
    <div class="chat-msg sistema">
      <div class="chat-bubble">${renderLinksMsg(rodada.links || [])}</div>
    </div>
    ${rodada.decisao === 'aprovado'
      ? `<div class="chat-msg usuario"><div class="chat-bubble">Aprovado ✓</div></div>
         <div class="chat-msg sistema"><div class="chat-bubble" style="background:#d1fae5;border-color:#a7f3d0;color:#065f46">Aprovação registrada com sucesso! ✓</div></div>`
      : rodada.mensagens?.length
        ? rodada.mensagens.map(m => `<div class="chat-msg usuario"><div class="chat-bubble">${esc(m)}</div></div>`).join('') +
          `<div class="chat-msg sistema"><div class="chat-bubble">Alteração enviada ao time de marketing. ✉️</div></div>`
        : ''
    }`;

  // Badge de status no subtítulo
  const sub = document.getElementById('aprovacaoSubtitle');
  if (sub) {
    sub.textContent = rodada.decisao === 'aprovado'
      ? `Aprovado em ${new Date(rodada.dataDecisao || rodada.data).toLocaleDateString('pt-BR')}`
      : `Alteração solicitada em ${new Date(rodada.dataDecisao || rodada.data).toLocaleDateString('pt-BR')}`;
  }
}

function renderHistoricoRodadas(rodadasAnteriores) {
  const container = document.getElementById('historicoRodadas');
  if (!container || rodadasAnteriores.length === 0) return;

  container.innerHTML = rodadasAnteriores.map(rodada => {
    const decisaoLabel = rodada.decisao === 'aprovado' ? '✓ Aprovado' : '✏️ Alteração solicitada';
    const dataLabel = rodada.dataDecisao
      ? new Date(rodada.dataDecisao).toLocaleDateString('pt-BR')
      : '';
    return `
      <div class="rodada-historico">
        <div class="rodada-historico-header" onclick="toggleHistoricoRodada(this)">
          <span>Rodada ${rodada.numero} — ${decisaoLabel}${dataLabel ? ' · ' + dataLabel : ''}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="rodada-historico-body">
          <div style="padding:12px 16px;font-size:0.82rem;opacity:0.7">
            ${rodada.links?.map(l => `<a href="${esc(l.url)}" target="_blank" style="color:var(--carbon-black);font-weight:600">${esc(l.label)}</a>`).join(' · ') || 'Sem links'}
            ${rodada.decisao === 'alteracao' && rodada.mensagens?.length
              ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(34,27,25,0.08)">${rodada.mensagens.map((m, i) => `<div style="margin-bottom:4px">${rodada.mensagens.length > 1 ? (i+1)+'. ' : ''}${esc(m)}</div>`).join('')}</div>`
              : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleHistoricoRodada(header) {
  const body = header.nextElementSibling;
  const chevron = header.querySelector('svg');
  const isOpen = body.style.maxHeight && body.style.maxHeight !== '0px';
  body.style.maxHeight = isOpen ? '0' : body.scrollHeight + 'px';
  if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
}
```

---

## 3. `forms.ts` — Proteção contra aprovação dupla no backend

### 3a. Em `/aprovacao`, verificar comentários existentes antes de criar

```ts
// Antes de adicionar comentário de aprovação, verificar se já existe
const existingComments = await fetch(
  `https://api.clickup.com/api/v2/task/${solicitacao.clickup_task_id}/comment`,
  { headers: { "Authorization": token } }
);
if (existingComments.ok) {
  const commentsData = await existingComments.json() as { comments?: Array<{ comment_text: string }> };
  const jaAprovado = commentsData.comments?.some(c =>
    c.comment_text?.includes('Aprovado por') && c.comment_text?.includes(user.name)
  );
  if (jaAprovado) {
    // Já aprovado — retornar sucesso sem duplicar
    res.json({ success: true, alreadyApproved: true });
    return;
  }
}
```

### 3b. Em `/alteracao`, formatar o comentário como lista numerada quando múltiplos itens

```ts
// O frontend já envia mensagemFormatada com numeração quando múltiplos itens
// Apenas garantir que o comentário fica bem formatado:
const comentario = mensagens.length > 1
  ? `${mentionText}✏️ Alterações solicitadas por ${user.name}:\n\n${mensagem.trim()}`
  : `${mentionText}✏️ Alteração solicitada por ${user.name}:\n\n${mensagem.trim()}`;
```

---

## OBSERVAÇÕES

- Após editar `forms.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- `solicitacao.html` não precisa de build
- O `dados_globais` referenciado em `iniciarChat` deve ser a variável
  onde os dados da solicitação são armazenados globalmente no init da página
  — verificar o nome exato e ajustar se necessário (pode ser `item` direto)
- O `localStorage` persiste entre sessões — o histórico de rodadas
  fica disponível mesmo após fechar e reabrir o browser
- O chat é travado pelo `fase` — cada ação só funciona no momento correto,
  evitando cliques duplos ou ações fora de ordem
- O indicador "digitando..." dura 1.2s antes de cada mensagem do sistema
  — pode ser ajustado no `delay(1200)` dentro de `mensagemSistema()`
