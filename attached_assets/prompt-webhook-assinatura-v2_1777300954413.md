# Fix — Webhook Assinatura de E-mail: corrigir nomes dos campos

## `forms.ts` — Atualizar payload do webhook

Localizar o bloco adicionado anteriormente para `assinatura-email`
e substituir o objeto JSON pelo payload com os nomes corretos:

```ts
body: JSON.stringify({
  name:   parsedDados.nomeCompleto       || parsedDados.nome || "",
  phone:  parsedDados.telefone           || "",
  email:  parsedDados.emailCorporativo   || "",
  marca:  parsedDados.marca              || "",
  cargo:  parsedDados.cargo              || "",
  cfp:    parsedDados.cfp === "sim" ? "Sim" : "Não",
}),
```

Remover os campos `id`, `tipo`, `setor`, `solicitante`, `solicitanteEmail`,
`criadoEm` — o N8N do Elementor não os espera e campos extras podem
causar comportamento inesperado dependendo do workflow.

---

## OBSERVAÇÕES

- `forms.ts` precisa de build
- O campo `cargo` estava no form do Elementor mas não foi adicionado
  ao form de assinatura do hub — verificar se o form HTML tem o campo
  `cargo` e se está sendo enviado em `parsedDados`. Se não tiver,
  adicionar o campo ao `form-assinatura-email.html` (select com CARGOS_ASSESSOR)
