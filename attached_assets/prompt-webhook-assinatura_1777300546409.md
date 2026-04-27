# Webhook N8N — Assinatura de E-mail

## Objetivo
Após salvar a solicitação de `assinatura-email` no banco, o backend
faz um POST para a URL do webhook N8N com os dados do form formatados.

---

## `forms.ts` — Adicionar chamada ao webhook após salvar solicitação

### Localizar o handler POST /solicitacoes

Após o bloco que tenta criar a task no ClickUp (que para assinatura-email
retorna `{ taskId: null }` imediatamente), adicionar:

```ts
// Após o bloco try/catch do ClickUp:
if (tipo_solicitacao === "assinatura-email") {
  const webhookUrl = process.env.WEBHOOK_ASSINATURA_EMAIL;
  if (webhookUrl) {
    // Fire-and-forget — não bloqueia a resposta ao usuário
    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id:              solicitacao.id,
        tipo:            "assinatura-email",
        nome:            parsedDados.nomeCompleto  || parsedDados.nome || "",
        telefone:        parsedDados.telefone       || "",
        email:           parsedDados.emailCorporativo || "",
        marca:           parsedDados.marca          || "",
        setor:           parsedDados.setor          || "",
        cfp:             parsedDados.cfp            || "nao",
        solicitante:     user.name,
        solicitanteEmail: user.email,
        criadoEm:        solicitacao.created_at,
      }),
    }).catch(err => {
      logger.error({ err, webhookUrl }, "Webhook assinatura-email falhou");
    });
  } else {
    logger.warn("WEBHOOK_ASSINATURA_EMAIL não configurado");
  }
}
```

---

## OBSERVAÇÕES

- `forms.ts` precisa de build após esta edição
- Fire-and-forget: o backend responde `{ success: true }` para o usuário
  imediatamente, sem aguardar o N8N processar
- Se o webhook falhar, o erro é logado mas não impede o fluxo do usuário —
  a solicitação já está salva no banco
- O campo `cfp` é enviado como `"sim"` ou `"nao"` (string)
- Verificar no N8N quais são os nomes de campo esperados e ajustar
  as chaves do JSON acima se necessário após o primeiro teste
