# Webhooks — Todos os forms de automação

## 1. Replit Secrets — atualizar todos os webhooks

```
WEBHOOK_CARTAO_FISICO=https://auto.portalsvn.com.br/webhook/cartao-fisico-790
WEBHOOK_CARTAO_DIGITAL=https://auto.portalsvn.com.br/webhook/carta-digital-235
WEBHOOK_BOAS_VINDAS=https://auto.portalsvn.com.br/webhook/cartao-boas-vindas-654
WEBHOOK_COMEMORATIVO=https://auto.portalsvn.com.br/webhook/cartao-comemorativo-893
WEBHOOK_NPS=https://auto.portalsvn.com.br/webhook/arte-nps-231
WEBHOOK_CONVITE_FP=https://auto.portalsvn.com.br/webhook/convite-fp-432
WEBHOOK_CERTIFICADO=https://auto.portalsvn.com.br/webhook/certificado-092
```

---

## 2. `forms.ts` — Atualizar buildWebhookFields para todos os tipos

```ts
case "assinatura-email":
  return {
    nome:     s(dados.nomeCompleto),
    telefone: s(dados.telefone),
    email:    s(dados.emailCorporativo),
    marca:    s(dados.marca),
    cargo:    s(dados.cargo),
    cfp:      dados.cfp === "sim" ? "Sim" : "Não",
  };

case "cartao-visita-fisico":
  return {
    nome:            s(dados.nomeCartao),
    telefone:        s(dados.whatsapp),
    email:           s(dados.emailCorporativo),
    unidade:         s(dados.unidade),
    contrato_social: s(dados.contratoSocial),
  };

case "cartao-visita-digital":
  return {
    nome:            s(dados.nomeCompleto),
    telefone:        s(dados.telefone),
    email:           s(dados.emailCorporativo),
    contrato_social: s(dados.contratoSocial),
    foto:            arquivosMap["fotoPerfil"] || "",
  };

case "cartao-boas-vindas":
  return {
    nome_cliente:    s(dados.nomeCliente),
    private:         dados.isPrivate === "sim" ? "Sim" : "Não",
    nome_assessor:   s(dados.nomeAssinatura),
    contrato_social: s(dados.contratoSocial),
    cidade:          s(dados.cidade),
    email:           userEmail,
  };

case "cartao-comemorativo":
  return {
    nome_aniversariante: s(dados.nomeAniversariante),
    modelo:              s(dados.modeloCartao),
    mensagem:            s(dados.mensagem),
    assinatura:          s(dados.assinatura),
    email:               userEmail,
  };

case "divulgacao-nps":
  return {
    nome_assessor: s(dados.nomeAssinatura),
    cargo:         s(dados.cargo),
    agradecimento: s(dados.agradecimento),
    modelo:        s(dados.modeloArte),
    foto:          arquivosMap["fotoPerfil"] || "",
    email:         userEmail,
  };

case "convite-fp":
  return {
    codigo_assessor: s(dados.codigoAssessor),
    nome_assessor:   s(dados.nomeAssinatura),
    cargo:           s(dados.cargo),
    contrato_social: s(dados.contratoSocial),
    email:           userEmail,
  };

case "certificado-eventos":
  return {
    nome:          s(dados.nomeCompleto),
    telefone:      s(dados.whatsapp),
    email:         userEmail,
    id_evento:     s(dados.idEvento),
    carga_horaria: s(dados.cargaHoraria),
  };
```

---

## 3. `form-cartao-visita.html` — Adicionar campo Contrato Social no cartão físico

```html
<!-- No step 2 do cartão físico, adicionar após o campo Unidade: -->
<div class="field">
  <label>Contrato social</label>
  <select id="contratoSocial" required>
    <option value="">Selecione</option>
    <option>SVN Capital</option>
    <option>SVN Connect</option>
    <option>SVN Investimentos</option>
  </select>
</div>
```

```js
// No submitForm() do cartão físico, adicionar:
contratoSocial: document.getElementById('contratoSocial')?.value || '',
```

```ts
// Em forms.ts, adicionar 'contratoSocial' ao REQUIRED_FIELDS do cartão físico:
"cartao-visita-fisico": ["nome", "nomeCartao", "whatsapp", "emailCorporativo", "unidade", "contratoSocial"],
```

---

## OBSERVAÇÕES

- `forms.ts` precisa de build após edições
- `form-cartao-visita.html` não precisa de build
- Atualizar os Secrets ANTES do build
- Após o build, reiniciar o servidor e testar um form de cada vez
- No N8N, os campos chegam diretamente como `{{ $json.nome }}`,
  `{{ $json.email }}` etc — sem prefixos
