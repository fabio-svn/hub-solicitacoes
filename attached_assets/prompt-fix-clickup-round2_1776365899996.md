# Correções ClickUp — Round 2

---

## 1. `clickup.ts` — Corrigir campos vazios e IDs

### 1a. Adicionar campo "Breve descrição do evento"

O campo não está em `EVENTOS_CUSTOM_FIELDS`. O `dadosKey` correto é `descricao`
(campo salvo pelo form-eventos nos modos maturidade 1 e 3).

Adicionar na array `EVENTOS_CUSTOM_FIELDS`:
```ts
{ label: "Breve descrição do evento", id: "4930db39-8924-4121-b432-1068e15068db", dadosKey: "descricao", clickupType: "short_text" },
```

### 1b. Adicionar campo "Cidade" com formato "Cidade - UF"

O campo Cidade não está em `EVENTOS_CUSTOM_FIELDS`. Precisa combinar cidade + sigla
do estado. Adicionar na array `EVENTOS_CUSTOM_FIELDS`:

```ts
{ label: "Cidade", id: "CIDADE_FIELD_ID", dadosKey: "_cidadeFormatada", clickupType: "short_text" },
```

E antes do loop `for (const field of EVENTOS_CUSTOM_FIELDS)` em `setEventosCustomFields`,
adicionar o campo computado no objeto dados:

```ts
// ── Campo computado: Cidade + sigla do Estado ────────────────────────────────
const cidadeRaw = str(dados.cidade as string);
const estadoRaw = str(dados.estado as string);
if (cidadeRaw) {
  // Extrair sigla: o estado vem como "41" (ID IBGE) ou como "PR — Paraná"
  // O form salva o value do <select> que é o id numérico do IBGE (ex: "41")
  // Precisamos da sigla. Criar mapa inverso de siglas:
  const IBGE_SIGLA_MAP: Record<string, string> = {
    "12":"AC","27":"AL","16":"AP","13":"AM","29":"BA","23":"CE","53":"DF",
    "32":"ES","52":"GO","21":"MA","51":"MT","50":"MS","31":"MG","15":"PA",
    "25":"PB","41":"PR","26":"PE","22":"PI","33":"RJ","24":"RN","43":"RS",
    "11":"RO","14":"RR","42":"SC","35":"SP","28":"SE","17":"TO",
  };
  const sigla = IBGE_SIGLA_MAP[estadoRaw] || estadoRaw;
  (dados as Record<string, unknown>)._cidadeFormatada = sigla
    ? `${cidadeRaw} - ${sigla}`
    : cidadeRaw;
}
```

**Atenção:** substituir `"CIDADE_FIELD_ID"` pelo ID correto do campo Cidade no ClickUp
(não foi fornecido — verificar no ClickUp e substituir).

### 1c. Adicionar campo "Endereço" preenchido pela unidade SVN selecionada

O campo "Endereço do local externo" (`localEndereco`) já existe na lista, mas quando
o usuário seleciona uma Unidade SVN o endereço vem do `unidadeSVN` e não é gravado
em `localEndereco`. Corrigir em `setEventosCustomFields`, antes do loop de campos:

```ts
// ── Campo computado: endereço da unidade SVN ────────────────────────────────
const localEvento = str(dados.localEvento as string);
if (localEvento === "unidade") {
  const UNIDADES_ENDERECOS: Record<string, string> = {
    "SVN Aracaju":              "R. Francisco Duarte Ramos, 34 - Jardins, Aracaju - SE",
    "SVN Campo Grande":         "Edifício Atrium - R. Euclides da Cunha, 1039 - Loja 3 - Jardim dos Estados",
    "SVN Cascavel":             "Av. Piquiri, 17 - Salas 01 e 02 - Centro",
    "SVN Cuiabá":               "R. Pres. Castelo Branco, 277 - Quilombo",
    "SVN Curitiba":             "Praça São Paulo da Cruz, 50 - Sala 1605 - Juveve, Curitiba - PR",
    "SVN Foz do Iguaçu":        "R. Alm. Barroso, 1139 - Centro",
    "SVN Londrina":             "Av. Higienópolis, 602 - Sala 2 - Centro, Londrina - PR",
    "SVN Maringá":              "Av. Cerro Azul, 123 - Zona 2, Maringá - PR",
    "SVN Salvador":             "Torre Nova York, Av. Tancredo Neves, 2539 - Sala 2104, Salvador - BA",
    "SVN São Paulo":            "Av. Dr. Cardoso de Melo, 1855 - Conjunto 51 - Vila Olímpia, São Paulo - SP",
    "SVN Toledo":               "Rua Nossa Senhora do Rocio, 2279 - Sala 02 - Jardim La Salle, Toledo - PR",
    "SVN Vitória da Conquista":  "Av. Jorge Teixeira, 29 - Salas 16 e 17",
  };
  const unidade = str(dados.unidadeSVN as string);
  const enderecoUnidade = UNIDADES_ENDERECOS[unidade];
  if (enderecoUnidade) {
    (dados as Record<string, unknown>).localEndereco = enderecoUnidade;
    logger.info({ unidade, endereco: enderecoUnidade }, "ClickUp: endereço da unidade SVN injetado");
  }
}
```

### 1d. Corrigir ID do campo "Tipo de evento"

Na array `EVENTOS_CUSTOM_FIELDS`, localizar:
```ts
{ label: "Tipo de evento", id: "b0261bc8-2ead-4820-9df9-6475c35cb182", ... },
```
Substituir o `id` por:
```ts
{ label: "Tipo de evento", id: "c81a416c-a09d-41f4-a003-5261bf6edce6", ... },
```

### 1e. Remover campo duplicado com ID `196f6d96-7ca9-4e88-bbf5-598cbf375146`

Procurar na array `EVENTOS_CUSTOM_FIELDS` e em qualquer chamada de
`setClickUpCustomField` o campo com `id: "196f6d96-7ca9-4e88-bbf5-598cbf375146"`
e remover completamente a entrada.

### 1f. Adicionar campos "Imagem complementar de parceiro" e "Arquivo adicional"

Na array `EVENTOS_CUSTOM_FIELDS`, adicionar:
```ts
{ label: "Imagem complementar de parceiro", id: "2d45b87d-dfd0-4f8d-92d2-0a6efc27eec7", dadosKey: "imgFile",    clickupType: "short_text", isArquivo: true },
{ label: "Arquivo adicional",               id: "35d6d98f-e139-444a-a32a-699a24fe544a", dadosKey: "demaisFile", clickupType: "short_text", isArquivo: true },
```

Também garantir que `forms.ts` está passando esses arquivos no `arquivos` map.
No handler do POST em `forms.ts`, verificar se `imgFile` e `demaisFile` estão
sendo incluídos no upload R2 e passados para `createClickUpTask`. Se não estiver,
adicionar ao loop de upload:
```ts
// Os campos logoFile, imgFile, demaisFile já devem estar sendo tratados
// pelo multer e uploadToR2 — confirmar que chegam no ArquivosMap.
```

---

## 2. `thankyou.html` — Corrigir visual do botão "Nova solicitação"

Localizar o botão de "Nova solicitação" adicionado e verificar sua classe.
Ele deve ter exatamente as mesmas classes do botão "Ver minha solicitação":

```html
<!-- O botão "Ver minha solicitação" existente usa: -->
<a href="/dashboard.html" class="btn btn-primary" style="opacity:0" id="ctaBtn"></a>

<!-- O botão "Nova solicitação" deve usar o mesmo padrão: -->
<a href="/solicitacoes.html" class="btn btn-primary" id="ctaBtn2" style="opacity:0">Nova solicitação</a>
```

Se o botão já existir mas com estilo inline diferente (ex: `background`, `color`,
`border-radius` diferentes do padrão), remover todos os estilos inline e deixar
apenas `class="btn btn-primary"`. A animação de entrada deve seguir o mesmo padrão
do botão principal — adicionar ao array de animações escalonadas:

```js
// No trecho que anima os elementos, adicionar 'ctaBtn2' ao array:
['title', 'subtitle', 'ctaBtn', 'ctaBtn2', 'logoWrap'].forEach((id, i) => {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.transition = 'opacity 0.4s ease';
    el.style.opacity = '1';
  }, 700 + i * 200);
});
```

---

## OBSERVAÇÕES

- Após aplicar as mudanças no `clickup.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- O campo "Cidade" no ClickUp (ponto 1b) precisa que você confirme o ID do campo
  no ClickUp antes de substituir `"CIDADE_FIELD_ID"` — não foi fornecido nas
  informações. Os demais campos têm IDs confirmados.
- O mapa `UNIDADES_ENDERECOS` no ponto 1c é uma cópia fiel do array `UNIDADES_SVN`
  do `config.js` — se futuramente uma unidade for adicionada ou o endereço mudar,
  atualizar em ambos os lugares.
- Os campos `imgFile` e `demaisFile` (ponto 1f) já devem estar sendo enviados pelo
  form-eventos via multer — confirmar nos logs do servidor após o build se as URLs
  do R2 estão chegando no `ArquivosMap`.
