# Correção — Cores dos status (alinhamento com ClickUp)

---

## `config.js` — Ajustar cores de "Aguardando informação" e "Em produção"

Substituir as duas entradas em `STATUS_SOLICITACAO`:

```js
// Aguardando informação — bege/areia claro (igual ao ClickUp)
{ id: "aguardando", label: "Aguardando informação", bg: "#f5e6d3", text: "#6b3e1e", cor: "--leather-brown" },

// Em produção — laranja forte com texto branco (igual ao ClickUp)
{ id: "em-producao", label: "Em produção", bg: "#ea580c", text: "#ffffff", cor: "--ruby-red" },
```

### Resultado visual:
- **Aguardando informação**: fundo bege/areia claro `#f5e6d3`, texto marrom escuro `#6b3e1e`
- **Em produção**: fundo laranja forte `#ea580c`, texto branco `#ffffff`

Os dois ficam claramente distintos entre si e alinhados com as cores do ClickUp.

---

## OBSERVAÇÃO

Apenas `config.js` precisa ser editado — sem build necessário.
