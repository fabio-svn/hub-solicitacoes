# Correção — Títulos das seções no ClickUp

O ClickUp não renderiza Markdown na descrição via API v2.
Substituir os títulos `## emoji Label` por separadores visuais em texto puro.

---

## `clickup.ts` — Substituir todos os títulos de seção

### Antes (não renderiza):
```
## 👤 Solicitante
## 🎯 Resumo da solicitação
## 🎤 Palestrantes
## 📦 Materiais solicitados
## 📝 Observações gerais
## 📌 Resumo
## 📝 Detalhes
## 📎 Arquivos
```

### Depois (texto puro com separador visual):
```
━━━━━━━━━━━━━━━━━━━━━━
👤 SOLICITANTE
━━━━━━━━━━━━━━━━━━━━━━
```

### Substituições a fazer em `buildRequesterSection()`:
```ts
// DE:
return `## 👤 Solicitante\n\n${items.join("\n")}`;
// PARA:
return `━━━━━━━━━━━━━━━━━━━━━━\n👤 SOLICITANTE\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
```

### Em `buildResumoSection()`:
```ts
// DE:
return `## 🎯 Resumo da solicitação\n\n${items.join("\n")}`;
// PARA:
return `━━━━━━━━━━━━━━━━━━━━━━\n🎯 RESUMO DA SOLICITAÇÃO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
```

### Em `buildPalestrantesSection()`:
```ts
// DE:
return `## 🎤 Palestrantes\n\n${items.join("\n")}`;
// PARA:
return `━━━━━━━━━━━━━━━━━━━━━━\n🎤 PALESTRANTES\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
```

### Em `buildMateriaisSection()`:
```ts
// DE:
return `## 📦 Materiais solicitados\n\n${lines.join("\n").trimEnd()}`;
// PARA:
return `━━━━━━━━━━━━━━━━━━━━━━\n📦 MATERIAIS SOLICITADOS\n━━━━━━━━━━━━━━━━━━━━━━\n\n${lines.join("\n").trimEnd()}`;
```

### Em `buildEventDescription()` — observações:
```ts
// DE:
if (obs) blocks.push(`## 📝 Observações gerais\n\n• ${obs}`);
// PARA:
if (obs) blocks.push(`━━━━━━━━━━━━━━━━━━━━━━\n📝 OBSERVAÇÕES GERAIS\n━━━━━━━━━━━━━━━━━━━━━━\n\n• ${obs}`);
```

### Em `buildGeneralDescription()` — resumo:
```ts
// DE:
if (resumoItems.length > 0) blocks.push(`## 📌 Resumo\n\n${resumoItems.join("\n")}`);
// PARA:
if (resumoItems.length > 0) blocks.push(`━━━━━━━━━━━━━━━━━━━━━━\n📌 RESUMO\n━━━━━━━━━━━━━━━━━━━━━━\n\n${resumoItems.join("\n")}`);
```

### Em `buildDetailsSection()`:
```ts
// DE:
return `## 📝 Detalhes\n\n${items.join("\n")}`;
// PARA:
return `━━━━━━━━━━━━━━━━━━━━━━\n📝 DETALHES\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
```

### Em `buildArquivosSection()`:
```ts
// DE:
return `## 📎 Arquivos\n\n${items.join("\n")}`;
// PARA:
return `━━━━━━━━━━━━━━━━━━━━━━\n📎 ARQUIVOS\n━━━━━━━━━━━━━━━━━━━━━━\n\n${items.join("\n")}`;
```

### Em `buildGeneralDescription()` — observações:
```ts
// DE:
if (obs) blocks.push(`## 📝 Observações gerais\n\n• ${obs}`);
// PARA:
if (obs) blocks.push(`━━━━━━━━━━━━━━━━━━━━━━\n📝 OBSERVAÇÕES GERAIS\n━━━━━━━━━━━━━━━━━━━━━━\n\n• ${obs}`);
```

---

## Resultado esperado no ClickUp:

```
━━━━━━━━━━━━━━━━━━━━━━
👤 SOLICITANTE
━━━━━━━━━━━━━━━━━━━━━━

• Solicitante: João Paulo Rodrigues Sardeto
• E-mail: joao.sardeto@svninvest.com.br

━━━━━━━━━━━━━━━━━━━━━━
🎯 RESUMO DA SOLICITAÇÃO
━━━━━━━━━━━━━━━━━━━━━━

• Natureza: Presencial
• Título do evento: Como e onde investir em 2026
...

━━━━━━━━━━━━━━━━━━━━━━
🎤 PALESTRANTES
━━━━━━━━━━━━━━━━━━━━━━

• Nome do palestrante 1: Bruno Silva
...
```

---

## OBSERVAÇÕES

- Após editar `clickup.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- O separador `━━━` usa o caractere Unicode U+2501 (Box Drawings Heavy Horizontal)
  que renderiza corretamente em qualquer ambiente de texto puro
- As tasks existentes no ClickUp não são afetadas — só as novas criações
