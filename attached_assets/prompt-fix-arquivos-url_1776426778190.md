# Correção — URLs de arquivos e links na descrição do ClickUp

---

## DIAGNÓSTICO

A URL `/solicitacoes/20/imgFile/11-Colete-NBA.webp` indica que
`R2_PUBLIC_URL` está ausente ou vazio nas variáveis de ambiente do Replit.
Quando vazio, o `r2.ts` gera uma URL relativa sem domínio — o arquivo
pode até existir no R2 mas o link fica inacessível.

---

## 1. Replit — Verificar e corrigir variáveis de ambiente

No painel de Secrets/Environment Variables do Replit, confirmar que
estas variáveis estão definidas:

```
R2_PUBLIC_URL = https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev
R2_ACCOUNT_ID = <seu account id do Cloudflare>
R2_ACCESS_KEY  = <sua access key>
R2_SECRET_KEY  = <sua secret key>
R2_BUCKET      = <nome do bucket>
```

**Este é o fix principal** — sem `R2_PUBLIC_URL` definido, todas as
URLs geradas são relativas e inacessíveis.

---

## 2. `r2.ts` — Tornar o fallback do placeholder mais seguro

Substituir o fallback do placeholder para usar o domínio do `app.ts`:

```ts
// DE:
if (!client || !R2_BUCKET) {
  logger.warn("R2 not configured, using placeholder URL");
  return `${R2_PUBLIC_URL}solicitacoes/${solicitacaoId}/${campo}/${file.originalname}`;
}

// PARA:
if (!client || !R2_BUCKET) {
  logger.error({ solicitacaoId, campo }, "R2 não configurado — arquivo não salvo, retornando placeholder");
  const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/*$/, "/") || "";
  if (!baseUrl) {
    logger.error("R2_PUBLIC_URL ausente — URL do arquivo ficará inválida");
  }
  return `${baseUrl}solicitacoes/${solicitacaoId}/${campo}/${file.originalname}`;
}
```

Isso pelo menos loga um erro visível nos logs do Replit quando
`R2_PUBLIC_URL` estiver ausente, facilitando diagnóstico futuro.

---

## 3. `clickup.ts` — Completar `ARQUIVO_LABELS` com todos os campos

Adicionar os campos faltantes ao objeto `ARQUIVO_LABELS`:

```ts
const ARQUIVO_LABELS: Record<string, string> = {
  // Já existentes:
  arquivoBase:      "Arquivo base",
  arquivoApoio:     "Arquivo de apoio",
  materialAtual:    "Material atual",
  fotoPerfil:       "Foto de perfil",
  logoFile:         "Logo complementar de parceiro",
  // Adicionar:
  imgFile:          "Imagem complementar",
  demaisFile:       "Demais arquivos de apoio",
  arquivoBaseNova:  "Arquivo base (nova apresentação)",
  matEmailBase:     "Base para disparo de e-mail",
  palFoto1:         "Foto — Palestrante 1",
  palFoto2:         "Foto — Palestrante 2",
  palFoto3:         "Foto — Palestrante 3",
  palFoto4:         "Foto — Palestrante 4",
};
```

Com isso, **todos** os arquivos enviados em qualquer formulário
aparecerão automaticamente na seção `📎 ARQUIVOS` da descrição
do ClickUp com labels legíveis.

---

## 4. `clickup.ts` — Incluir fotos de palestrantes na seção de arquivos

Atualmente as fotos `palFoto1`...`palFoto4` são tratadas como campos
customizados (`isArquivo: true` em `EVENTOS_CUSTOM_FIELDS`) mas
**não** aparecem na descrição de texto.

O `buildArquivosSection()` já itera sobre o `arquivosMap` completo,
então com os labels adicionados no passo 3, as fotos vão aparecer
automaticamente na seção `📎 ARQUIVOS` da descrição também — como
link clicável, além de preencher o campo customizado.

Nenhuma mudança adicional necessária além do passo 3.

---

## OBSERVAÇÕES

- **Prioridade:** Corrigir `R2_PUBLIC_URL` no Replit primeiro (passo 1)
  — é a causa raiz do problema
- Após editar `r2.ts` e `clickup.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- Os arquivos já enviados com URL quebrada estão salvos no R2
  com o path correto — só a URL está errada. Não é possível
  corrigir retroativamente as URLs no banco sem uma migration manual,
  mas os novos envios já vão funcionar após definir `R2_PUBLIC_URL`
