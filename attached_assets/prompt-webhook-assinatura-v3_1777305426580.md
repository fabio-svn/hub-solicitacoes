# Fix — Webhook Assinatura de E-mail: formato correto do Elementor

## `forms.ts` — Atualizar payload do webhook

O Elementor envia os dados como `form_fields[name]`, `form_fields[phone]` etc,
junto com metadados `post_id`, `form_id`, `action`, `referrer`.
O N8N espera exatamente esse formato.

Localizar o bloco do webhook de assinatura-email e substituir por:

```ts
// Montar payload idêntico ao formato do Elementor:
const formFields: Record<string, string> = {
  name:  String(parsedDados.nomeCompleto || parsedDados.nome || ""),
  phone: String(parsedDados.telefone     || ""),
  email: String(parsedDados.emailCorporativo || ""),
  marca: String(parsedDados.marca        || ""),
  cfp:   parsedDados.cfp === "sim" ? "Sim" : "Não",
};
if (parsedDados.cargo) formFields.cargo = String(parsedDados.cargo);

// Enviar como application/x-www-form-urlencoded (igual ao Elementor)
const body = new URLSearchParams();
Object.entries(formFields).forEach(([k, v]) => {
  body.append(`form_fields[${k}]`, v);
});
body.append('post_id',   '2750');
body.append('form_id',   'a0c2112');
body.append('action',    'elementor_pro_forms_send_form');
body.append('referrer',  'https://hub.portalsvn.com.br/form-assinatura-email.html');

fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: body.toString(),
}).catch(err => {
  logger.error({ err, webhookUrl }, "Webhook assinatura-email falhou");
});
```

---

## OBSERVAÇÕES

- `forms.ts` precisa de build
- `post_id` e `form_id` são hardcoded com os valores do formulário
  Elementor original (`2750` e `a0c2112`) — o N8N pode estar usando
  esses valores para identificar qual workflow executar
- O `Content-Type` é `application/x-www-form-urlencoded`, não JSON —
  essa é a diferença chave em relação às tentativas anteriores
- O campo `cargo` não estava no formulário Elementor original,
  então é enviado apenas se preenchido
