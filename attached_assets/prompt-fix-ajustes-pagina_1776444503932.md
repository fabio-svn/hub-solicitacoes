# Ajustes — Ordem de categorias + Pulse na etapa atual + Badge/glow no card de aprovação

---

## 1. `config.js` — Inverter ordem de categorias em `CATEGORIAS_SOLICITACAO`

Localizar o array de grupos/categorias e reordenar para:
1. Identidade e materiais pessoais
2. **Eventos e relacionamento** ← sobe
3. **Marketing e conteúdo** ← desce

```js
// Reordenar os grupos no array CATEGORIAS_SOLICITACAO:
// Mover o grupo "eventos-relacionamento" para antes de "marketing-conteudo"
// mantendo "identidade-materiais" como primeiro
```

---

## 2. `solicitacao.html` — Pulse na etapa atual do fluxo

### 2a. Adicionar keyframe de pulse ao `<style>` da página

```css
@keyframes pulse-dot {
  0%, 100% { box-shadow: 0 0 0 0 rgba(var(--pulse-color), 0.5); transform: scale(1); }
  50%       { box-shadow: 0 0 0 6px rgba(var(--pulse-color), 0); transform: scale(1.15); }
}
```

Como CSS variables não funcionam dentro de `rgba()` diretamente,
usar uma abordagem com `outline` animado:

```css
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0px rgba(34,27,25,0.3); }
  70%  { box-shadow: 0 0 0 7px rgba(34,27,25,0); }
  100% { box-shadow: 0 0 0 0px rgba(34,27,25,0); }
}
```

### 2b. Aplicar pulse ao círculo da etapa atual em `renderFluxo()`

Substituir o estilo inline do círculo da etapa atual:

```js
// DE:
const circBg = isConcluida ? '#065f46' : isAtual ? cor.bg : 'transparent';
// Linha do HTML do círculo:
`<div style="width:20px;height:20px;border-radius:50%;background:${circBg};border:2px solid ${circBorder};display:flex;align-items:center;justify-content:center;flex-shrink:0">`

// PARA — adicionar animation e transform-origin apenas na etapa atual:
const pulseStyle = isAtual ? 'animation:pulse-ring 1.8s ease-out infinite;' : '';

`<div style="width:20px;height:20px;border-radius:50%;background:${circBg};border:2px solid ${circBorder};display:flex;align-items:center;justify-content:center;flex-shrink:0;${pulseStyle}">`
```

### 2c. Adicionar o `@keyframes` em um bloco `<style>` inline na página

Adicionar antes do `</head>`:
```html
<style>
  @keyframes pulse-ring {
    0%   { box-shadow: 0 0 0 0px rgba(34, 27, 25, 0.35); }
    70%  { box-shadow: 0 0 0 7px rgba(34, 27, 25, 0); }
    100% { box-shadow: 0 0 0 0px rgba(34, 27, 25, 0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes badgePop {
    0%   { transform: scale(0.6); opacity: 0; }
    70%  { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
</style>
```

Obs: o `@keyframes shimmer` também precisa estar aqui pois o skeleton
loader usa animação de shimmer definida inline — mover para o `<style>`.

---

## 3. `solicitacao.html` — Badge "Novo" + glow no card de aprovação

### 3a. Lógica de "visto" com sessionStorage

No início de `renderAprovacao()`, após verificar o status:

```js
const storageKey = 'aprovacao_visto_' + item.id;
const jaVisto = sessionStorage.getItem(storageKey) === '1';
const mostrarDestaque = item.status === 'em-aprovacao' && !jaVisto;
```

### 3b. Aplicar glow e badge ao card quando `mostrarDestaque === true`

Substituir o HTML do card externo em `renderAprovacao()`:

```js
card.innerHTML = `
  <div class="form-card" id="aprovacaoCardInner" style="padding:24px;transition:box-shadow 0.4s ease;${
    mostrarDestaque
      ? 'box-shadow:0 0 0 2px var(--ruby-red), 0 8px 32px rgba(172,54,49,0.18);'
      : ''
  }">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;position:relative">
      <!-- Ícone -->
      <div style="width:36px;height:36px;border-radius:50%;background:rgba(219,234,254,0.5);display:flex;align-items:center;justify-content:center;flex-shrink:0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1e40af" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
      </div>
      <!-- Título e subtítulo -->
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.95rem;display:flex;align-items:center;gap:8px">
          Materiais para aprovação
          ${mostrarDestaque
            ? '<span style="background:var(--ruby-red);color:white;font-size:0.65rem;font-weight:700;padding:2px 8px;border-radius:999px;animation:badgePop 0.4s ease forwards">NOVO</span>'
            : ''}
        </div>
        <div style="font-size:0.8rem;opacity:0.5">Os materiais já estão disponíveis para sua análise</div>
      </div>
      <!-- Chevron -->
      <svg id="aprovacaoChevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4;transition:transform 0.25s;flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
    </div>

    <!-- Área do chat (sanfona) -->
    <div id="chatArea" style="overflow:hidden;max-height:0;transition:max-height 0.35s ease">
      <div id="chatInner" style="background:var(--icon-bg);border-radius:12px;padding:20px;min-height:80px">
        <div id="chatLoading" style="text-align:center;padding:16px;opacity:0.4;font-size:0.85rem">Carregando arquivos...</div>
        <div id="chatContent" style="display:none"></div>
      </div>
    </div>
  </div>`;

// Tornar o header clicável para abrir/fechar sanfona
const cardHeader = card.querySelector('.form-card > div:first-child');
let chatAberto = false;

cardHeader.style.cursor = 'pointer';
cardHeader.onclick = () => {
  chatAberto = !chatAberto;
  const chatArea = document.getElementById('chatArea');
  const chevron = document.getElementById('aprovacaoChevron');

  if (chatAberto) {
    chatArea.style.maxHeight = chatArea.scrollHeight + 400 + 'px';
    chevron.style.transform = 'rotate(180deg)';
    // Marcar como visto — remover glow e badge
    if (mostrarDestaque) {
      sessionStorage.setItem(storageKey, '1');
      const inner = document.getElementById('aprovacaoCardInner');
      if (inner) inner.style.boxShadow = '';
      // O badge some naturalmente quando o componente é re-renderizado
    }
    // Carregar conteúdo na primeira abertura
    if (!cardHeader.dataset.loaded) {
      cardHeader.dataset.loaded = '1';
      carregarEntrega(item);
    }
  } else {
    chatArea.style.maxHeight = '0';
    chevron.style.transform = 'rotate(0deg)';
  }
};

// Abrir automaticamente se já estava visto (UX: não esconder o que já foi visto)
// Não abre automaticamente — usuário decide quando expandir
```

### 3c. Extrair lógica de carregamento para `carregarEntrega(item)`

Mover o bloco do `try/catch` de fetch do `/entrega` para função separada:

```js
async function carregarEntrega(item) {
  // Todo o bloco de fetch('/api/solicitacoes/' + item.id + '/entrega')
  // e renderização do chatContent vai aqui —
  // exatamente o mesmo código do prompt-sistema-aprovacao.md,
  // apenas movido para função nomeada chamada pelo onclick do header
}
```

---

## OBSERVAÇÕES

- Sem build necessário — apenas `config.js` e `solicitacao.html`
- O glow some permanentemente após o primeiro clique no card
  (salvo em `sessionStorage` — persiste enquanto a aba estiver aberta)
- Se o usuário fechar e reabrir a aba, o glow volta a aparecer —
  isso é intencional para garantir que a notificação não seja perdida
  se a pessoa fechou a aba sem perceber. Para persistir entre sessões,
  trocar `sessionStorage` por `localStorage`
- A cor do pulse na etapa atual (`rgba(34,27,25,0.35)`) é neutra e
  funciona tanto no tema claro quanto no escuro
