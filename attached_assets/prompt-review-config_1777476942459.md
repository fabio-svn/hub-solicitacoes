# Revisão config.js — análise completa

---

## BOAS NOTÍCIAS — maioria dos problemas anteriores já resolvidos

Comparando com a versão anterior que analisei nos prompts de cleanup:

✅ `CATEGORIAS_SOLICITACAO` — layout "trio" removido da categoria Audiovisual  
✅ Constantes `URL_FORM_*` e `URL_ADMIN` removidas — código morto limpo  
✅ `TIPO_SOLICITACAO_LABELS` — tipos obsoletos removidos  
✅ `STATUS_SOLICITACAO` — inclui todos os status extras do webhook  
   (`alinhamentos`, `cotacao-aprovacao`, `aguardando-rh`, `aguardando-pagamento`,  
   `aguardando-finalizacao`, `em-espera`) — resolvendo o problema apontado no batch3  
✅ Comentário documentando duplicação com `SETOR_CODIGO_MAP` em clickup.ts  
✅ `FLUXOS_ETAPAS` para eventos e `_default` — visível no solicitacao.html  

---

## Problemas restantes — 5 itens

### 1. `DRAWER_FIELD_LABELS` sem entrada para `email` e `emailCertificado`

```js
// Faltam labels para campos que aparecem no drawer de admin e solicitação:
// "email" → exibe a chave bruta no drawer
// "emailCertificado" → idem
// "nome" → idem (exibe "nome" em vez de "Solicitante")
// "emailDestinatario" → adicionado recentemente no cartão comemorativo
// "fotoPerfil" → label útil no drawer

// Adicionar ao DRAWER_FIELD_LABELS:
email:               "E-mail",
emailCertificado:    "E-mail para certificado",
emailDestinatario:   "E-mail para envio do cartão",
nome:                "Solicitante",
fotoPerfil:          "Foto de perfil",
nomeCartao:          "Nome no cartão",  // já existe ✅
personalizacao:      "Personalização",
textoCartaoPresente: "Texto do cartão presente",
```

### 2. `FLUXOS_ETAPAS` sem fluxo específico para `brindes` e `patrocinio`

```js
// brindes e patrocinio usam o fluxo "_default" que foi projetado para
// solicitações de conteúdo (em-analise → em-producao → em-revisao → em-aprovacao).
// Para brindes/patrocinio, o fluxo real é mais próximo do de eventos
// (alinhamentos → cotacao → aguardando-pagamento → concluido).
// Se o time quiser um rail correto na solicitação.html:

"brindes": [
  { id: "recebido",             label: "Recebido",                visivel: true  },
  { id: "em-analise",           label: "Em análise",              visivel: true  },
  { id: "cotacao-aprovacao",    label: "Em cotação / aprovação",  visivel: true  },
  { id: "aguardando-pagamento", label: "Aguardando pagamento",    visivel: true  },
  { id: "concluido",            label: "Concluído",               visivel: true  },
  { id: "reprovado",            label: "Reprovado",               visivel: false },
],
"patrocinio": [
  { id: "recebido",             label: "Recebido",                visivel: true  },
  { id: "alinhamentos",         label: "Alinhamentos",            visivel: true  },
  { id: "em-andamento",         label: "Em andamento",            visivel: true  },
  { id: "cotacao-aprovacao",    label: "Em cotação / aprovação",  visivel: true  },
  { id: "aguardando-pagamento", label: "Aguardando pagamento",    visivel: true  },
  { id: "concluido",            label: "Concluído",               visivel: true  },
  { id: "reprovado",            label: "Reprovado",               visivel: false },
],
// Confirmar com o time se esses são os status reais usados no ClickUp
// para essas listas antes de aplicar.
```

### 3. `STATUS_SOLICITACAO` — `reprovado` e `cancelado` têm o mesmo bg mas labels diferentes

```js
// { id: "reprovado", label: "Reprovado / Cancelado", bg: "#C82828", text: "#FFFFFF" },
// { id: "cancelado", label: "Cancelado",             bg: "#C82828", text: "#FFFFFF" },
// Visualmente idênticos — o usuário não distingue um do outro pelo badge.
// Se há diferença semântica (reprovado = recusado pelo time, cancelado = cancelado pelo solicitante),
// diferenciar visualmente:
{ id: "reprovado", label: "Reprovado",  bg: "#C82828", text: "#FFFFFF" },
{ id: "cancelado", label: "Cancelado",  bg: "#6B7280", text: "#FFFFFF" }, // cinza para cancelado
// Opcional — confirmar preferência visual com o time.
```

### 4. `_configReady` — sem retry em caso de falha da rede

```js
// DE:
const _configReady = fetch('/api/config').then(r => r.json()).then(cfg => {
  // ...
}).catch(() => {});  // ← silencia erros, usa defaults

// O .catch(() => {}) silencia qualquer erro e usa os valores padrão hardcoded.
// Se /api/config falhar (servidor reiniciando, deploy em andamento),
// os forms carregam com os valores padrão — comportamento aceitável ✅.
// O problema: _configReady resolve imediatamente no catch sem sinalizar o erro.
// Forms que fazem `await _configReady` antes de renderizar vão prosseguir
// com os valores default sem saber que o backend está offline.
// Para produção, adicionar log de aviso (não bloqueia, só informa):

}).catch((err) => {
  console.warn('[config] Falha ao carregar configurações do servidor, usando defaults:', err?.message);
});
```

### 5. `UNIDADES_SVN` — duplicação com `UNIDADES_ENDERECOS` em clickup.ts

```js
// Idêntico ao problema do SETOR_CODIGOS (documentado com comentário).
// UNIDADES_SVN (config.js, frontend) e UNIDADES_ENDERECOS (clickup.ts, backend)
// têm os mesmos endereços mas em formatos diferentes:
// - config.js: array de { nome, endereco }
// - clickup.ts: Record<string, string> nome → endereco
// Já tem comentário para SETOR_CODIGOS mas NÃO tem para UNIDADES_SVN.
// Adicionar comentário:

// NOTA: Endereços duplicados de UNIDADES_ENDERECOS em clickup.ts.
// Ao adicionar ou alterar unidades, atualizar AMBOS os arquivos.
const UNIDADES_SVN = [ ... ];
```

---

## RESUMO

**Situação geral:** o config.js está bem organizado e a maioria dos problemas identificados nos prompts anteriores foi corrigida. O arquivo está saudável.

**Ações necessárias:**
- Adicionar entries faltantes ao `DRAWER_FIELD_LABELS` (baixo esforço, alto impacto no drawer)
- Adicionar fluxos específicos para `brindes` e `patrocinio` se o rail de andamento estiver sendo usado por esses tipos
- Adicionar comentário de duplicação em `UNIDADES_SVN`

**Ações opcionais:**
- Diferenciar cores de `reprovado` vs `cancelado`
- Adicionar log no `.catch()` do `_configReady`
