# Melhoria — Performance de envio + Indicador de carregamento

---

## 1. `clickup.ts` — Paralelizar chamadas de campos customizados

### 1a. Substituir o loop sequencial em `setEventosCustomFields()`

Localizar o bloco:
```ts
// ── Campos da lista EVENTOS_CUSTOM_FIELDS ───────────────────────────────────
for (const field of EVENTOS_CUSTOM_FIELDS) {
  // ...
  await setClickUpCustomField(taskId, field.id, value, field.label, { ... });
}
```

Substituir por versão paralela em lotes de 10:
```ts
// ── Campos da lista EVENTOS_CUSTOM_FIELDS — paralelo em lotes de 10 ─────────
const fieldPromises: Array<Promise<void>> = [];

for (const field of EVENTOS_CUSTOM_FIELDS) {
  let value: string | null;

  if (field.isArquivo) {
    const url = arquivos[field.dadosKey] || null;
    if (!url) { logger.warn({ taskId, label: field.label }, "ClickUp: arquivo sem URL, pulando"); continue; }
    value = url;
  } else {
    const raw = dados[field.dadosKey];
    if (raw === undefined || raw === null || str(raw as string) === "") {
      logger.warn({ taskId, label: field.label, dadosKey: field.dadosKey }, "ClickUp: campo sem valor, pulando");
      continue;
    }
    if (field.dadosKey === "dataEvento") {
      value = formatDate(String(raw)) ?? String(raw);
    } else if (field.dadosKey === "natureza") {
      const n = str(raw as string).toLowerCase();
      value = n === "presencial" ? "Presencial" : n === "online" ? "Online" : str(raw as string);
    } else {
      value = str(raw as string);
    }
  }

  fieldPromises.push(
    setClickUpCustomField(taskId, field.id, value, field.label, {
      clickupType: field.clickupType,
      raw: dados[field.dadosKey],
    })
  );
}

// Executar em lotes de 10 para não sobrecarregar a API do ClickUp
const BATCH_SIZE = 10;
for (let i = 0; i < fieldPromises.length; i += BATCH_SIZE) {
  await Promise.all(fieldPromises.slice(i, i + BATCH_SIZE));
}
```

### 1b. Paralelizar também os campos fixos em `setEventosCustomFields()`

Os três campos computados (e-mail, local, materiais) podem rodar em paralelo
entre si antes dos campos da lista:

```ts
// Substituir as 3 chamadas sequenciais no início da função por:
await Promise.all([
  user.email
    ? setClickUpCustomField(taskId, "ae56f16a-8d97-40e0-9032-c357eb0793ca", user.email, "E-mail do Solicitante", { clickupType: "short_text" })
    : Promise.resolve(),
  localHuman
    ? setClickUpCustomField(taskId, "38ac133a-13b0-4428-98eb-adb5f8cdc23a", localHuman, "Local do evento", { clickupType: "short_text" })
    : Promise.resolve(),
  (Array.isArray(materiaisArr) && materiaisArr.length > 0)
    ? setClickUpCustomField(taskId, "3266524c-febc-47ac-a76d-0d9c4256d9dc", materiaisText, "Solicitações", { clickupType: "text", raw: materiaisArr })
    : Promise.resolve(),
]);
```

**Nota:** calcular `localHuman`, `materiaisText` e verificar `materiaisArr`
antes do `Promise.all`, como já é feito hoje.

### 1c. Paralelizar campos em `setGeneralCustomFields()`

Substituir o loop `for` dos `textFields` por `Promise.all`:

```ts
// Substituir:
for (const { id, value, label, clickupType } of textFields) {
  if (!value) { ... continue; }
  await setClickUpCustomField(taskId, id, value, label, { clickupType, raw: value });
}

// Por:
await Promise.all(
  textFields
    .filter(({ value }) => !!value)
    .map(({ id, value, label, clickupType }) =>
      setClickUpCustomField(taskId, id, value, label, { clickupType, raw: value })
    )
);
```

E as 3 chamadas finais (dropdown, prazo, arquivos) manter sequenciais
pois dependem de lógica condicional — ou paralelizar as que sempre rodam:

```ts
// Prazo e dropdown podem rodar em paralelo:
await Promise.all([
  setClickUpCustomField(taskId, "ea901547-...", tipoDemandaOrderindex, "Tipo de Demanda", { clickupType: "drop_down", raw: tipo }),
  prazoRaw && !isNaN(new Date(prazoRaw + "T12:00:00").getTime())
    ? setClickUpCustomField(taskId, "33c5d4c5-...", new Date(prazoRaw + "T12:00:00").getTime(), "Prazo de entrega", { clickupType: "date", raw: prazoRaw })
    : Promise.resolve(),
  arquivoPrincipal
    ? setClickUpCustomField(taskId, "294f47eb-...", arquivoPrincipal, "Arquivo principal", { clickupType: "url" })
    : Promise.resolve(),
  arquivoApoio
    ? setClickUpCustomField(taskId, "67d565fd-...", arquivoApoio, "Arquivo de apoio", { clickupType: "url" })
    : Promise.resolve(),
]);
```

---

## 2. `form-eventos.html` — Indicador de carregamento progressivo

### 2a. Substituir o indicador simples no `submitForm()`

Localizar:
```js
const btn = document.getElementById('btnSubmit');
btn.disabled = true; btn.textContent = 'Enviando...';
```

Substituir por função com mensagens progressivas:

```js
const btn = document.getElementById('btnSubmit');
btn.disabled = true;

// Mensagens progressivas para envios longos
const loadingMessages = [
  'Enviando...',
  'Processando arquivos...',
  'Registrando solicitação...',
  'Quase pronto...',
];
let msgIdx = 0;
btn.textContent = loadingMessages[0];
const msgInterval = setInterval(() => {
  msgIdx = Math.min(msgIdx + 1, loadingMessages.length - 1);
  if (!btn.disabled) { clearInterval(msgInterval); return; }
  btn.textContent = loadingMessages[msgIdx];
}, 3000);
```

### 2b. Garantir que o intervalo é limpo em caso de erro

Nos blocos de erro do `submitForm()`, adicionar `clearInterval(msgInterval)`:

```js
// No bloco else (erro de resposta):
else {
  clearInterval(msgInterval);
  const errEl = document.getElementById('submitError');
  if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro ao enviar. Tente novamente.'; }
  btn.disabled = false; btn.textContent = 'Enviar';
}
// No catch (erro de conexão):
} catch (e) {
  clearInterval(msgInterval);
  const errEl = document.getElementById('submitError');
  if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Erro de conexão. Verifique sua internet.'; }
  btn.disabled = false; btn.textContent = 'Enviar';
}
```

### 2c. Limpar intervalo no sucesso

Logo antes do `window.location.href = '/thankyou.html'`:
```js
clearInterval(msgInterval);
```

---

## OBSERVAÇÕES

- Após editar `clickup.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- `form-eventos.html` não precisa de build
- A paralelização não altera os dados enviados ao ClickUp — apenas
  reduz o tempo de ~8-10s para ~1-3s no pior caso
- As mensagens progressivas mudam a cada 3 segundos — tempo suficiente
  para o usuário perceber que algo está acontecendo sem criar ansiedade
- O intervalo de lotes (`BATCH_SIZE = 10`) pode ser reduzido para 5
  se houver erros de rate limiting do ClickUp nos logs
