# Revisão lote 3 — solicitacao.html, thankyou.html, style.css, r2.ts, webhook.ts

---

## 1. `solicitacao.html` — 8 correções

### 1a. `renderPage()` re-injeta `solHeaderRight` sobrescrevendo o badge de status

```js
// renderPage() define sEl (solStatus) corretamente no início,
// depois no final reescreve headerRight.innerHTML que contém um NOVO
// elemento #solStatus. O ID fica duplicado no DOM.
// Qualquer código que fizer getElementById('solStatus') depois vai pegar
// o primeiro (já desatualizado) ou comportamento indefinido.

// Solução: não duplicar o badge — manter o elemento original e apenas
// atualizar seu conteúdo:

// REMOVER a linha que recria o badge no headerRight:
// DE:
const headerRight = document.getElementById('solHeaderRight');
headerRight.innerHTML =
  '<span class="sol-status-badge" id="solStatus" style="...">' + esc(statusObj.label) + '</span>' + ...

// PARA: deixar o badge existente e só adicionar os botões dinâmicos:
const headerRight = document.getElementById('solHeaderRight');
// O badge já existe como primeiro filho — atualizar apenas os botões extras:
const botoesExtra = document.getElementById('solHeaderBotoes') || (() => {
  const div = document.createElement('div');
  div.id = 'solHeaderBotoes';
  div.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';
  headerRight.appendChild(div);
  return div;
})();
botoesExtra.innerHTML = (isAdm && item.clickup_url ? `...botão clickup...` : '') + ...;
```

### 1b. `renderAprovacao()` faz fetch de `/entrega` mas não cancela se a página mudar

```js
// renderAprovacao() é async e faz fetch de /entrega.
// Se o usuário navegar para outra página antes de resolver, o componente
// tenta atualizar o DOM que pode não existir mais.
// Baixo risco com SPA não usada, mas adicionar guard:

async function renderAprovacao(item, dados) {
  const card = document.getElementById('aprovacaoCard');
  if (!card) return; // guard — DOM pode ter sido destruído
  // ... resto
}
```

### 1c. `resolveRodadaAtual()` com `getLinksHash` — comparação por URL pode falhar com ordem

```js
// getLinksHash ordena por url antes de criar o hash — correto ✅.
// Porém se os links tiverem labels diferentes mas mesma URL,
// o hash seria o mesmo e uma nova rodada não seria criada.
// Comportamento aceitável por design, mas documentar.
```

### 1d. Sistema de aprovação usa `localStorage` — dados perdidos em modo privado

```js
// getRodadas() e saveRodadas() usam localStorage.
// Em modo privado ou se o usuário limpar o cache, as rodadas são perdidas
// e na próxima visita a conversa começa do zero (isNova = true).
// Se a decisão já foi tomada no servidor (status 'concluido'), o chat
// vai mostrar "Materiais prontos" novamente — confuso para o usuário.
// Mitigação: verificar o status da solicitação antes de exibir o chat:

// Se item.status === 'concluido' e rodadas.length === 0,
// exibir mensagem estática em vez do chat interativo:
if (item.status === 'concluido' && rodadas.length === 0) {
  // Renderizar transcript simplificado com mensagem de conclusão
  await mensagemSistema('Esta solicitação foi concluída. Para mais informações, entre em contato com o time de Marketing.');
  document.getElementById('chatInputArea').style.display = 'none';
  return;
}
```

### 1e. `renderDados()` — `WIDE_KEYS` não inclui chaves comuns de campos grandes

```js
// 'materiais' está em WIDE_KEYS mas 'ideaQuando', 'localSugestoes',
// 'linkTransmissao', 'personalizacao', 'textoCartaoPresente' não estão.
// Adicionar ao Set:
const WIDE_KEYS = new Set([
  'conteudo','finalidade','observacoes','observacoesFinais','briefing','descricao',
  'descricaoEvento','texto','detalhes','contexto','informacaoAdicional','resumo',
  'expectativas','objetivos','estrategia','canais','materiais','selos','publico',
  'ideaQuando','localSugestoes','linkTransmissao','personalizacao',
  'textoCartaoPresente','elementosDescricao','qtdTamanhos','explicacao',
  'mensagem','assinatura','agradecimento','conteudoMaterial',  // ← adicionar
]);
```

### 1f. `humanizeValue()` não trata 'tipoMaterial'

```js
// tipoMaterial vem como slug (ex: 'flyer-personalizado') mas humanizeValue
// não tem mapeamento para esse campo. Vai cair no fallback de humanizeSlug
// que retorna 'Flyer Personalizado' — aceitável mas poderia mapear melhor.
// Adicionar:
if (key === 'tipoMaterial') {
  const TIPOS_MAP = {
    'documento': 'Documento',
    'flyer-institucional': 'Flyer Institucional',
    'flyer-personalizado': 'Flyer Personalizado',
    'carta': 'Carta',
    'banner': 'Banner',
    'adesivo': 'Adesivo',
    'bloco-notas': 'Bloco de Notas',
    'camiseta': 'Camiseta',
    'outro-impresso': 'Outro material impresso',
  };
  return TIPOS_MAP[String(value)] || humanizeSlug(String(value));
}
```

### 1g. `renderFluxo()` não verifica `STATUS_SOLICITACAO` antes de usar

```js
// STATUS_SOLICITACAO é de config.js — se config.js não carregar,
// STATUS_SOLICITACAO seria undefined e o .find() lançaria exceção.
// Já há um `|| {}` no fallback mas a check é:
const statusObj = STATUS_SOLICITACAO.find(s => s.id === item.status) || {}
// Se STATUS_SOLICITACAO for undefined, isso lança TypeError.
// Adicionar guard:
const statusObj = (typeof STATUS_SOLICITACAO !== 'undefined'
  ? STATUS_SOLICITACAO.find(s => s.id === item.status)
  : null) || { label: item.status, bg: '#f1f5f9', text: '#475569' };
```

### 1h. `confirmarExcluir()` usa `alert()` em vez de exibir erro no modal

```js
// DE:
alert(data.error || 'Erro ao excluir. Tente novamente.');
// e:
alert('Erro de conexão.');

// PARA: exibir erro dentro do modal já existente:
const errEl = document.createElement('div');
errEl.style.cssText = 'color:#b91c1c;font-size:0.82rem;text-align:center;margin-top:8px';
errEl.textContent = data.error || 'Erro ao excluir. Tente novamente.';
document.getElementById('deleteModal').querySelector('[style*="justify-content:flex-end"]')
  .insertAdjacentElement('beforebegin', errEl);
```

---

## 2. `thankyou.html` — 4 correções

### 2a. `MSG_THANKYOU_TITULO`, `MSG_THANKYOU_SUBTITULO`, `MSG_THANKYOU_BOTAO` usados antes de verificar se existem

```js
// Essas constantes vêm de config.js. Se config.js não carregar
// (falha de rede, cache inválido), o script lança ReferenceError e
// a página fica em branco.
// Adicionar fallbacks:

const titulo = (typeof MSG_THANKYOU_TITULO !== 'undefined' ? MSG_THANKYOU_TITULO : 'Solicitação enviada!');
const subtitulo = (typeof MSG_THANKYOU_SUBTITULO !== 'undefined' ? MSG_THANKYOU_SUBTITULO : 'Sua solicitação foi registrada e está sendo processada.');
const botao = (typeof MSG_THANKYOU_BOTAO !== 'undefined' ? MSG_THANKYOU_BOTAO : 'Ver minhas solicitações');
```

### 2b. `ctaBtn2` ("Nova solicitação") não tem o mesmo fade-in que `ctaBtn`

```js
// No array do forEach de fade-in:
// ['title', 'subtitle', 'ctaBtn', 'ctaBtn2', 'logoWrap']
// ctaBtn2 JÁ está incluído no array — ✅ correto.
// Verificar se ctaBtn2 tem style="opacity:0" no HTML — SIM ✅.
// Sem problema aqui.
```

### 2c. Falta `auth.js` no `<script src>` — página não requer autenticação?

```js
// thankyou.html carrega config.js mas NÃO carrega auth.js.
// Isso significa que qualquer pessoa com a URL pode acessar a página
// sem estar autenticada. Intencional? Se o usuário abrir
// /thankyou.html diretamente, a página mostra os defaults.
// Se for intencional (não requer auth), ok.
// Se não for, adicionar:
// <script src="auth.js"></script>
// E no script:
// await Auth.init();
// if (!Auth.isAuthenticated()) { window.location.href = '/auth/login'; return; }
```

### 2d. `sessionStorage.removeItem` dentro do try sem garantia de execução

```js
// Já identificado em análise anterior (prompt-cleanup-geral.md item 5a).
// Confirmando que na versão atual o removeItem está FORA do if(itens.length > 0),
// ou seja, é chamado sempre no bloco try.

// Verificando o código atual:
// sessionStorage.removeItem('svn_ultimo_resumo') → chamado após montar itens
// MAS se raw === null (throw) ou JSON.parse falhar,
// o catch captura e o removeItem NÃO é chamado — dados ficam no storage.
// Para garantir limpeza mesmo em erro:

try {
  const raw = sessionStorage.getItem('svn_ultimo_resumo');
  if (!raw) throw new Error('sem resumo');
  const resumo = JSON.parse(raw);
  // ... processar resumo ...
} catch {
  // dados de fallback
} finally {
  sessionStorage.removeItem('svn_ultimo_resumo'); // ← mover para finally
}
```

---

## 3. `style.css` — 5 observações

### 3a. `--ruby-red: #9f3f37` no CSS mas `#AC3631` nos comentários/código JS

```css
/* O CSS define --ruby-red como #9f3f37 (tom mais escuro/dessaturado)
   mas as referências em code comments, prompts e nos forms usam #AC3631.
   Isso cria inconsistência visual entre elementos que usam a variável CSS
   e elementos com cor hardcoded.
   
   Verificar qual é o valor correto e padronizar:
   - Se #AC3631 é o brand color oficial → atualizar :root no CSS
   - Se #9f3f37 é o correto → atualizar as cores hardcoded no JS/HTML */

:root {
  --ruby-red: #AC3631;  /* ← verificar e unificar */
}
```

### 3b. `.form-step` tem `display:none` mas também está sendo controlado por `.active { display: block }`

```css
/* Isso é correto para o padrão de multi-step, mas form-cartao-visita.html
   usa uma variação com `.form-step { display: none }` via <style> local
   que pode conflitar com o CSS global dependendo da ordem de carga.
   Não é um bug crítico mas verificar se todos os forms com steps
   usam o mesmo padrão de classes. */
```

### 3c. `@media (prefers-reduced-motion)` zera animações mas `shimmer` do skeleton ainda aparece

```css
/* O shimmer do skeleton loader usa animation:shimmer 1.2s infinite.
   A media query de reduced-motion define animation-duration: 0.01ms
   mas não desativa o shimmer visual.
   Para usuários com reduced-motion, o skeleton ainda pisca rapidamente.
   Adicionar: */
@media (prefers-reduced-motion: reduce) {
  .shimmer-inner { animation: none; background: rgba(255,255,255,0.3); }
}
```

### 3d. `.btn-submit-gold:hover` muda a cor para vermelho — comportamento inesperado

```css
/* O botão de submit dourado ao hover vira vermelho (ruby-red).
   Isso é intencional? Visualmente surpreende o usuário.
   Se intencional, ok. Se não, manter o gold no hover: */
.btn-submit-gold:hover {
  background: linear-gradient(135deg, #b89438 0%, #d4a848 40%, #b89438 60%, #8a6820 100%);
  /* manter dourado escurecido em vez de mudar para vermelho */
}
```

### 3e. `.float-whatsapp` tem `bottom: 78px` hardcoded como fallback mas o JS calcula dinamicamente

```css
/* O CSS define bottom: 78px mas cada página tem um script inline que
   recalcula via JS. O CSS fallback está OK para o primeiro render,
   mas em páginas com 2 float-home buttons, o WhatsApp pode aparecer
   na posição errada por um frame antes do JS rodar.
   Baixo impacto visual. */
```

---

## 4. `r2.ts` — 3 correções

### 4a. Placeholder de URL retornado quando R2 não configurado é enganoso

```ts
// Quando o cliente S3 não está configurado, a função retorna:
return `${baseUrl}solicitacoes/${solicitacaoId}/${campo}/${file.originalname}`;
// Esse placeholder usa o nome original do arquivo, que pode conter
// espaços e caracteres especiais — a URL será inválida.
// Além disso, o arquivo é DELETADO mas a URL placeholder é salva no banco
// como se o arquivo existisse.
// Melhor: retornar string vazia ou lançar exceção:

if (!client || !R2_BUCKET) {
  logger.error({ solicitacaoId, campo }, "R2 não configurado — upload impossível");
  await fs.promises.unlink(file.path).catch(() => {});
  throw new Error("R2 não configurado — arquivo não pode ser salvo");
  // O chamador (forms.ts ou routes) deve tratar essa exceção e
  // não bloquear o envio do form, apenas logar a falha do arquivo.
}
```

### 4b. `fs.createReadStream()` não fecha explicitamente em caso de erro do S3

```ts
// A stream é criada e passada para PutObjectCommand.
// Se a operação S3 falhar DEPOIS de começar a transmitir,
// a stream pode ficar aberta. O `finally` faz unlink do arquivo
// mas o file descriptor pode já ter sido fechado pelo SDK — geralmente ok.
// Usar Buffer em vez de stream para arquivos pequenos, ou garantir destroy:

const fileBuffer = await fs.promises.readFile(file.path);
await client.send(new PutObjectCommand({
  Bucket: R2_BUCKET,
  Key: key,
  Body: fileBuffer,         // ← Buffer em vez de stream
  ContentType: file.mimetype,
  ContentLength: fileBuffer.length,  // ← recomendado para R2
}));
```

### 4c. Extensão do arquivo pode ser vazia para arquivos sem extensão

```ts
// SE file.originalname não tem extensão (ex: 'arquivo' sem ponto),
// `split('.').pop()` retorna o nome completo ('arquivo'),
// e a key ficaria: .../uuid.arquivo — incorreto.

// DE:
const ext = file.originalname.split(".").pop() || "";
const key = `solicitacoes/${solicitacaoId}/${campo}/${uuidv4()}.${ext}`;

// PARA:
const parts = file.originalname.split(".");
const ext = parts.length > 1 ? parts.pop()! : "";
const key = ext
  ? `solicitacoes/${solicitacaoId}/${campo}/${uuidv4()}.${ext}`
  : `solicitacoes/${solicitacaoId}/${campo}/${uuidv4()}`;
```

---

## 5. `webhook.ts` — 4 correções

### 5a. `res.sendStatus(200)` antes do processamento — correto mas importante

```ts
// O padrão fire-and-forget (respond 200 imediatamente, processar depois)
// é correto para webhooks do ClickUp que têm timeout curto.
// Se o processamento lançar exceção DEPOIS do res.sendStatus(200),
// o Express não pode mais responder — mas o catch final loga o erro.
// ✅ Correto como está.
```

### 5b. `CLICKUP_STATUS_MAP` tem entradas duplicadas/sobrepostas inconsistentes

```ts
// "aguardando informacao" → "aguardando"
// mas "aguardando rh" → "aguardando-rh"
// "aguardando pagamento" → "aguardando-pagamento"
// "aguardando finalizacao" → "aguardando-finalizacao"
// "em espera" → "em-espera"
//
// Esses status (aguardando-rh, aguardando-pagamento, aguardando-finalizacao,
// em-espera, cotacao-aprovacao, alinhamentos) existem no mapeamento mas
// provavelmente NÃO existem em STATUS_SOLICITACAO em config.js.
// O hub vai receber esses status mas não saberá como renderizá-los.
// Verificar se esses status estão definidos em STATUS_SOLICITACAO —
// se não estiverem, o frontend vai exibir o slug bruto.
// Adicionar ao STATUS_SOLICITACAO em config.js ou remover do mapa.
```

### 5c. Busca por `clickup_task_id` sem índice

```ts
// .where(eq(solicitacoesTable.clickup_task_id, taskId))
// Se a tabela não tiver índice em clickup_task_id, essa query faz
// full table scan a cada webhook. Com volume alto de eventos, pode
// ser lento.
// Adicionar à migration:
// CREATE INDEX IF NOT EXISTS idx_sol_clickup_task_id
//   ON "solicitacoes" (clickup_task_id)
//   WHERE clickup_task_id IS NOT NULL;
```

### 5d. Webhook sem verificação de assinatura (secret)

```ts
// O endpoint /webhook/clickup não verifica nenhum header de autenticação.
// Qualquer pessoa que conheça a URL pode enviar requisições falsas
// e alterar o status de qualquer solicitação.
// ClickUp suporta webhook secret — adicionar verificação:

router.post("/webhook/clickup", async (req, res) => {
  // Verificar assinatura se CLICKUP_WEBHOOK_SECRET estiver configurado:
  const secret = process.env.CLICKUP_WEBHOOK_SECRET;
  if (secret) {
    const signature = req.headers['x-signature'] as string;
    if (!signature) { res.sendStatus(401); return; }
    const crypto = require('crypto');
    const expected = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (signature !== expected) { res.sendStatus(401); return; }
  }

  res.sendStatus(200); // ← fire-and-forget após validar
  // ... resto do processamento
});
```

---

## 6. `style.css` + `solicitacao.html` — inconsistências visuais cross-page

### 6a. `.btn-submit-gold` — hover vermelho inconsistente com outros forms

```
Já apontado em 3d.
```

### 6b. `form-step leaving` animação definida em style.css mas não usada em todos os forms

```
.form-step.leaving é definido no CSS mas apenas form-eventos.html
usa a classe 'leaving' no goStep(). Os outros forms trocam steps
diretamente sem animação de saída. Consistência visual parcial.
Não é bug mas impacto na UX ao navegar entre steps nos forms mais simples.
```

---

## RESUMO DE PRIORIDADES — LOTE 3

**Críticos:**
- 5d. webhook.ts: endpoint sem autenticação — qualquer um pode alterar status
- 4a. r2.ts: URL placeholder inválida salva no banco quando R2 não configurado
- 2a. thankyou.html: crash se config.js não carregar (ReferenceError)
- 1a. solicitacao.html: ID #solStatus duplicado no DOM

**Importantes:**
- 5b. webhook.ts: status desconhecidos (aguardando-rh etc) não estão em STATUS_SOLICITACAO
- 5c. webhook.ts: falta índice em clickup_task_id
- 4b. r2.ts: usar Buffer em vez de stream para evitar file descriptor leak
- 4c. r2.ts: extensão vazia gera key malformada
- 1e. solicitacao.html: WIDE_KEYS incompleto — campos longos renderizam em grid de 2 colunas
- 1f. solicitacao.html: tipoMaterial não humanizado
- 1h. solicitacao.html: alert() no modal de exclusão
- 2d. thankyou.html: removeItem não chamado em caso de erro (usar finally)
- 3a. style.css: --ruby-red desalinhado com as cores hardcoded nos forms

**Baixa prioridade:**
- 1b. solicitacao.html: guard de DOM no renderAprovacao
- 1d. solicitacao.html: localStorage perdido em modo privado
- 1g. solicitacao.html: guard de STATUS_SOLICITACAO undefined
- 2c. thankyou.html: ausência de auth (intencional?)
- 3c. style.css: shimmer não respeita prefers-reduced-motion
- 3d. style.css: hover vermelho no botão dourado (intencional?)
- 6b. style.css: animação leaving parcialmente implementada
