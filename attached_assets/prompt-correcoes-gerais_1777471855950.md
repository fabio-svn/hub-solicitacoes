# Correções gerais — revisão completa

---

## 1. `form-divulgacao-nps.html` — Foto: feedback visual + envio correto

### 1a. Garantir estrutura correta do campo de foto no HTML

```html
<!-- O campo de foto condicional (aparece quando modelo === 'com-foto')
     deve ter exatamente estes IDs: -->
<div class="field" id="fotoField" style="display:none">
  <label>Foto de perfil</label>
  <div class="file-input-wrapper">
    <label class="file-input-btn" for="fotoPerfil">Escolher foto</label>
    <input type="file" id="fotoPerfil" name="fotoPerfil"
      accept=".jpg,.jpeg,.png,.webp">
    <div class="file-name" id="fotoPerfilName"></div>
  </div>
  <div class="field-hint">Tamanho máximo: 5MB • Formatos: JPG, PNG, WEBP</div>
</div>
```

**CRÍTICO:** o input DEVE ter `name="fotoPerfil"` para o multer no backend
identificar o arquivo. Sem `name`, o arquivo não aparece em `req.files`.

### 1b. Adicionar FileUpload.bind no init() do form

```js
// No init() de form-divulgacao-nps.html, após os outros binds:
FileUpload.bind('fotoPerfil', 'fotoPerfilName', {
  maxMB: 5,
  accept: '.jpg,.jpeg,.png,.webp',
});
```

### 1c. Garantir que a foto vai no FormData do submitForm()

```js
// No submitForm(), certificar que o arquivo está sendo adicionado:
// O form usa FormData — o multer captura automaticamente inputs com name
// DESDE QUE o form faça: fetch('/api/solicitacoes', { method:'POST', body: formData })
// e o FormData seja criado do formulário completo OU o arquivo seja adicionado manualmente:

const fotoEl = document.getElementById('fotoPerfil');
if (fotoEl && fotoEl.files[0]) {
  formData.append('fotoPerfil', fotoEl.files[0]);
}
```

### 1d. No webhook, o campo foto chega como URL do R2

O backend envia `foto: arquivosMap["fotoPerfil"]` — que é a URL pública do R2.
No N8N, o campo chega como `{{ $json.foto }}` com a URL completa da imagem.
O Bannerbear usa essa URL como `image_url` para baixar e inserir no template.

**Problema atual:** se o R2 bucket for privado, a URL não é acessível publicamente
e o Bannerbear não consegue baixar a foto. Verificar no Cloudflare R2 se o bucket
`solicitacoes` está com Public Access habilitado.

---

## 2. `form-cartao-boas-vindas.html` — Remover campo Cidade

```html
<!-- REMOVER completamente o bloco: -->
<div class="field">
  <label>Cidade</label>
  <input type="text" id="cidade" placeholder="Cidade do assessor" required>
</div>
```

```js
// No submitForm(), remover:
// cidade: document.getElementById('cidade')?.value || '',
```

```ts
// Em forms.ts, remover "cidade" do REQUIRED_FIELDS de cartao-boas-vindas:
"cartao-boas-vindas": ["nome", "nomeCliente", "nomeAssinatura", "contratoSocial", "unidade"],
```

**Nota sobre o webhook:** o campo `cidade` ainda será enviado no payload do webhook
como string vazia `""` — isso não quebra o N8N. Se o N8N não usar o campo cidade,
pode ser removido do `buildWebhookFields` também, mas por segurança manter.

---

## 3. Dicas com textos técnicos — corrigir nos forms

### 3a. `form-cartao-visita.html` — dica do cartão físico

```html
<!-- Localizar e substituir o texto da dica do cartão físico: -->
<!-- DE (qualquer variação de): -->
"Preencha os dados que devem constar no cartão impresso. A solicitação será criada no ClickUp com prazo para a próxima quarta-feira."

<!-- PARA: -->
"Preencha os dados exatamente da forma em que devem constar no cartão impresso."
```

### 3b. `form-cartao-boas-vindas.html` — dica principal

```html
<!-- DE: -->
"Preencha os dados do novo cliente para geração do cartão personalizado de boas-vindas. O cartão será enviado automaticamente via N8N."

<!-- PARA: -->
"Preencha os dados do novo cliente para geração do cartão personalizado de boas-vindas. O cartão será enviado automaticamente para o seu e-mail após a solicitação."
```

### 3c. `form-convite-fp.html` — dica principal

```html
<!-- DE: -->
"Preencha os dados para geração do convite de Financial Planning personalizado. O convite será criado e enviado automaticamente via N8N."

<!-- PARA: -->
"Preencha os dados para geração do convite de Financial Planning personalizado. O convite será enviado automaticamente para o seu e-mail."
```

### 3d. Varredura geral — remover qualquer menção a ClickUp/N8N nos forms

Nos seguintes arquivos, localizar e remover/substituir qualquer texto visível
que mencione "ClickUp", "N8N", "webhook", "Bannerbear" ou similar:
- `form-assinatura-email.html`
- `form-cartao-visita.html`
- `form-cartao-boas-vindas.html`
- `form-cartao-comemorativo.html`
- `form-divulgacao-nps.html`
- `form-convite-fp.html`
- `form-certificado-eventos.html`

---

## 4. `forms.ts` — Gerar título para todos os tipos, incluindo sem ClickUp

### Problema
Forms sem ClickUp (`TIPOS_SEM_CLICKUP`) nunca têm o campo `titulo` preenchido
no banco, porque o título era gerado pelo `createClickUpTask`. Isso faz com que
os cards no dashboard mostrem apenas o tipo como título.

### Solução: gerar título no handler POST antes do ClickUp

```ts
// Em router.post("/solicitacoes"), APÓS o insert no banco e ANTES do ClickUp,
// adicionar geração de título para todos os tipos:

function gerarTituloSolicitacao(tipo: string, dados: Record<string, unknown>, userName: string): string {
  const s = (v: unknown) => String(v || "").trim();
  switch (tipo) {
    case "assinatura-email":
      return `[Assinatura de E-mail] ${s(dados.nomeCompleto) || userName}`;
    case "cartao-visita-fisico":
      return `[Cartão de Visita] ${s(dados.nomeCartao) || userName}`;
    case "cartao-visita-digital":
      return `[Cartão Digital] ${s(dados.nomeCompleto) || userName}`;
    case "cartao-boas-vindas":
      return `[Cartão de Boas-vindas] ${s(dados.nomeCliente) || userName}`;
    case "cartao-comemorativo":
      return `[Cartão Comemorativo] ${s(dados.nomeAniversariante) || userName}`;
    case "divulgacao-nps":
      return `[Arte NPS] ${s(dados.nomeAssinatura) || userName}`;
    case "convite-fp":
      return `[Convite FP] ${s(dados.nomeAssinatura) || userName}`;
    case "certificado-eventos":
      return `[Certificado] ${s(dados.nomeCompleto) || userName}`;
    case "pagina-online":
      return `[Página Online] ${s(dados.titulo)}`;
    case "outro":
      return `[Outro] ${s(dados.titulo)}`;
    case "brindes":
      return `[Brinde] ${s(dados.titulo) || userName}`;
    case "patrocinio":
      return `[Patrocínio] ${s(dados.tituloEvento)}`;
    case "email-marketing":
      return `[E-mail Marketing] ${s(dados.assunto)}`;
    case "producao-video":
      return `[Produção de Vídeo] ${s(dados.titulo) || s(dados.tituloFotos) || userName}`;
    case "sessao-fotos":
      return `[Sessão de Fotos] ${s(dados.tituloFotos) || userName}`;
    case "materiais-impressos": {
      const tipoMat = s(dados.tipoMaterial) || s(dados.tipoImpresso) || "Material";
      const label = tipoMat.charAt(0).toUpperCase() + tipoMat.slice(1);
      return `[Material Impresso] ${label}`;
    }
    default:
      return `[${tipo}] ${userName}`;
  }
}

// No handler, após o insert:
const tituloGerado = gerarTituloSolicitacao(tipo_solicitacao, parsedDados, user.name);

// Atualizar o banco com o título gerado imediatamente:
await db.update(solicitacoesTable)
  .set({ titulo: tituloGerado })
  .where(eq(solicitacoesTable.id, solicitacao.id));

// Depois, o createClickUpTask pode sobrescrever o titulo com o nome da task do ClickUp
// (comportamento atual mantido para tipos COM ClickUp)
```

---

## 5. `solicitacao.html` — Humanizar campos com texto bruto

### Adicionar mapas em humanizeValue():

```js
function humanizeValue(key, value) {
  // ... código existente ...

  // Adicionar ANTES do bloco de maps existente:

  // isPrivate
  if (key === 'isPrivate') {
    return value === 'sim' || value === 'Sim' ? 'Sim' : 'Não';
  }

  // Modelo do cartão comemorativo
  if (key === 'modeloCartao') {
    const map = { dourado: 'Dourado', vermelho: 'Vermelho' };
    return map[String(value).toLowerCase()] || humanizeSlug(String(value));
  }

  // Modelo de arte NPS
  if (key === 'modeloArte') {
    const map = { 'com-foto': 'Com foto', 'sem-foto': 'Sem foto' };
    return map[String(value)] || humanizeSlug(String(value));
  }

  // Private (variação)
  if (key === 'private') {
    return value === 'Sim' || value === 'sim' ? 'Sim' : 'Não';
  }

  // ... restante do código existente ...
}
```

### Adicionar ao DRAWER_FIELD_LABELS em config.js:

```js
// Adicionar entradas faltando:
emailUsuario:     "E-mail",
nomeCliente:      "Nome do cliente",  // já existe? confirmar
private:          "Cliente Private?",
cidade:           "Cidade",
unidade:          "Unidade",
whatsapp:         "WhatsApp",         // já existe? confirmar
codigoAssessor:   "Código do assessor", // já existe? confirmar
```

---

## 6. `thankyou.html` — Prevenir hifenização

### Adicionar CSS inline no card:

```html
<!-- Localizar o .thankyou-card ou adicionar style ao h1 e p: -->

<!-- No elemento h1 (título): -->
<h1 style="font-weight:700;font-size:1.6rem;margin-bottom:12px;opacity:0;
           hyphens:none;word-break:keep-all;overflow-wrap:break-word" id="title"></h1>

<!-- No elemento p (subtítulo): -->
<p style="font-weight:400;opacity:0;color:rgba(255,248,243,0.95);margin-bottom:28px;
          hyphens:none;word-break:keep-all;overflow-wrap:break-word" id="subtitle"></p>
```

Ou, de forma mais limpa, adicionar no `<style>` da página (se houver) ou no `style.css`:

```css
/* thankyou.html — prevenir hifenização automática */
.thankyou-card h1,
.thankyou-card p {
  hyphens: none;
  -webkit-hyphens: none;
  word-break: keep-all;
  overflow-wrap: break-word;
}
```

---

## 7. `dashboard.html` — Padronização do título nos cards da lista

### Em renderList(), a lógica de título já existe:
```js
const titulo = item.titulo || dados.nomeEvento || dados.tituloEvento || dados.titulo
  || dados.nomeCompleto || item.tipo_solicitacao;
```

Com o fix do item 4 (gerarTituloSolicitacao no forms.ts), `item.titulo` agora
sempre virá preenchido com o formato `[Tipo] Nome/Título`.

**Nenhuma mudança necessária no dashboard.html** — o fix é feito no backend.

---

## OBSERVAÇÕES

- `forms.ts` precisa de build após edições (items 2 e 4)
- `form-divulgacao-nps.html`, `form-cartao-visita.html`, `form-cartao-boas-vindas.html`,
  `form-convite-fp.html`, `solicitacao.html`, `thankyou.html` não precisam de build
- O item 1 (foto NPS) tem uma dependência do R2 estar público — se o R2 continuar
  privado, a foto vai para o banco mas o Bannerbear não consegue acessar a URL
- O item 4 (título para todos os tipos) é a correção mais impactante —
  vai preencher o título de todas as novas solicitações, incluindo os forms
  de automação que antes ficavam sem título
