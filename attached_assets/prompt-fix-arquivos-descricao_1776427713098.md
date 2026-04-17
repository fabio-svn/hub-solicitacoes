# Correção — Arquivos na descrição de eventos + URLs corretas

---

## DIAGNÓSTICO

Dois problemas distintos:

1. **Eventos**: `buildEventDescription()` nunca recebe nem exibe arquivos —
   logos, imagens e fotos de palestrantes não aparecem na descrição.

2. **Todos os forms**: URLs estão quebradas (`/solicitacoes/20/imgFile/...`)
   porque `R2_PUBLIC_URL` não está definida como variável de ambiente no Replit.
   **Configurar essa variável resolve as URLs em todos os forms automaticamente.**

---

## 1. Replit — Definir variável de ambiente (causa raiz)

No painel de Secrets do Replit, adicionar:
```
R2_PUBLIC_URL = https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev
```

Verificar também que estas estão definidas:
```
R2_ACCOUNT_ID = <account id do Cloudflare>
R2_ACCESS_KEY  = <access key>
R2_SECRET_KEY  = <secret key>
R2_BUCKET      = <nome do bucket>
```

Sem necessidade de build — as variáveis de ambiente são lidas em runtime.

---

## 2. `clickup.ts` — Passar arquivos para `buildEventDescription()`

### 2a. Atualizar assinatura de `buildEventDescription()`

```ts
// DE:
function buildEventDescription(dados: FormDados, user: UserData): string {

// PARA:
function buildEventDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
```

### 2b. Adicionar seção de arquivos ao final de `buildEventDescription()`

```ts
// Adicionar antes do return blocks.join("\n\n"):

const arquivosSection = buildArquivosSection(arquivos);
if (arquivosSection) blocks.push(arquivosSection);
```

O bloco completo da função fica:
```ts
function buildEventDescription(dados: FormDados, user: UserData, arquivos: ArquivosMap): string {
  const blocks: string[] = [];
  blocks.push(buildRequesterSection(user));
  blocks.push(buildResumoSection(dados));
  const palestrantes = buildPalestrantesSection(dados);
  if (palestrantes) blocks.push(palestrantes);
  const materiais = buildMateriaisSection(dados);
  if (materiais) blocks.push(materiais);
  const arquivosSection = buildArquivosSection(arquivos);
  if (arquivosSection) blocks.push(arquivosSection);
  const obs = str(dados.observacoes);
  if (obs) blocks.push(`━━━━━━━━━━━━━━━━━━━━━━\n📝 OBSERVAÇÕES GERAIS\n━━━━━━━━━━━━━━━━━━━━━━\n\n• ${obs}`);
  logger.info({ blocos: blocks.length }, "ClickUp: descricao humanizada de evento gerada");
  return blocks.join("\n\n");
}
```

### 2c. Passar `safeArquivos` na chamada de `buildEventDescription()`

Em `createClickUpTask()`, localizar:
```ts
description = buildEventDescription(dados, user);
```

Substituir por:
```ts
description = buildEventDescription(dados, user, safeArquivos);
```

---

## OBSERVAÇÕES

- Após editar `clickup.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- Com `R2_PUBLIC_URL` definido, as URLs vão passar a ser absolutas
  (`https://pub-xxx.r2.dev/solicitacoes/...`) em todos os forms
- Os arquivos já enviados com URL relativa no banco não são corrigidos
  retroativamente — apenas novos envios terão URLs corretas
- Para eventos, após a correção, a seção `📎 ARQUIVOS` vai listar:
  logo complementar, imagem complementar, demais arquivos e fotos
  dos palestrantes (com os labels definidos em `ARQUIVO_LABELS`)
