# Correção — Base de e-mail marketing no envio e descrição

O arquivo `matEmailBase` é capturado pelo `FileUpload.bind` mas nunca
é enviado ao servidor nem aparece na descrição do ClickUp.

---

## 1. `form-eventos.html` — Enviar o arquivo no `submitForm()`

Localizar o bloco de upload de arquivos no `submitForm()`:
```js
['logoFile','imgFile','demaisFile'].forEach(id => {
  const f = document.getElementById(id)?.files[0];
  if (f) formData.append(id, f);
});
```

Adicionar o `matEmailBase` logo após:
```js
const matEmailBaseFile = document.getElementById('matEmailBase')?.files[0];
if (matEmailBaseFile) formData.append('matEmailBase', matEmailBaseFile);
```

---

## 2. `clickup.ts` — Exibir o arquivo na descrição

### 2a. Adicionar label em `ARQUIVO_LABELS`

```ts
// Adicionar ao objeto ARQUIVO_LABELS:
matEmailBase: "Base para disparo de e-mail",
```

### 2b. O arquivo já vai aparecer automaticamente

O `buildArquivosSection()` já itera sobre todos os arquivos recebidos
via `arquivos` map e usa `ARQUIVO_LABELS` para o label. Com o label
adicionado no passo 2a, o arquivo vai aparecer na seção
`📎 ARQUIVOS` da descrição automaticamente, junto com os demais.

Resultado na descrição do ClickUp:
```
━━━━━━━━━━━━━━━━━━━━━━
📎 ARQUIVOS
━━━━━━━━━━━━━━━━━━━━━━

• Base para disparo de e-mail: https://r2.dev/solicitacoes/123/matEmailBase/...
```

---

## OBSERVAÇÕES

- Após editar `clickup.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- `form-eventos.html` não precisa de build
- O arquivo já é aceito pelo multer (que usa `upload.any()`) e
  já seria salvo no R2 — só faltava o `formData.append` no frontend
  e o label no backend
