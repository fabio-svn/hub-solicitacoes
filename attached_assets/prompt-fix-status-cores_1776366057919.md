# Correção — Cores dos status alinhadas com ClickUp

Atualizar `STATUS_SOLICITACAO` no `config.js` com as cores alinhadas
ao ClickUp para a lista Geral. As cores do fluxo de eventos permanecem
como estão.

## `config.js` — Substituir `STATUS_SOLICITACAO`

```js
const STATUS_SOLICITACAO = [
  { id: "recebido",               label: "Recebido",                   bg: "#f1f5f9", text: "#475569",  cor: "--carbon-black"  },
  { id: "alinhamentos",           label: "Alinhamentos",               bg: "#e8f0fb", text: "#1a56a0",  cor: "--sage-green"    },
  { id: "em-analise",             label: "Em análise",                 bg: "#fef9c3", text: "#854d0e",  cor: "--ruby-red"      },
  { id: "em-andamento",           label: "Em andamento",               bg: "#fef3c7", text: "#92660a",  cor: "--leather-brown" },
  { id: "em-producao",            label: "Em produção",                bg: "#ffedd5", text: "#9a3412",  cor: "--ruby-red"      },
  { id: "em-revisao",             label: "Em revisão",                 bg: "#ede9fe", text: "#5b21b6",  cor: "--leather-brown" },
  { id: "em-aprovacao",           label: "Em aprovação",               bg: "#dbeafe", text: "#1e40af",  cor: "--sage-green"    },
  { id: "cotacao-aprovacao",      label: "Em cotação / aprovação",     bg: "#dbeafe", text: "#1e40af",  cor: "--leather-brown" },
  { id: "aguardando",             label: "Aguardando informação",      bg: "#fde8cc", text: "#7c4a03",  cor: "--leather-brown" },
  { id: "aguardando-rh",          label: "Aguardando aprovação do RH", bg: "#fce8f3", text: "#9d174d",  cor: "--leather-brown" },
  { id: "aguardando-pagamento",   label: "Aguardando pagamento",       bg: "#fce8f3", text: "#9d174d",  cor: "--leather-brown" },
  { id: "aguardando-finalizacao", label: "Aguardando finalização",     bg: "#ede9fe", text: "#5b21b6",  cor: "--leather-brown" },
  { id: "concluido",              label: "Concluído",                  bg: "#d1fae5", text: "#065f46",  cor: "--sage-green"    },
  { id: "reprovado",              label: "Reprovado / Cancelado",      bg: "#fee2e2", text: "#991b1b",  cor: "--ruby-red"      },
  { id: "cancelado",              label: "Cancelado",                  bg: "#fee2e2", text: "#991b1b",  cor: "--carbon-black"  },
  { id: "em-espera",              label: "Em espera",                  bg: "#f1f5f9", text: "#475569",  cor: "--carbon-black"  },
];
```

### Mapeamento com o ClickUp:
- Recebido → cinza claro (`#f1f5f9` / `#475569`)
- Em análise → amarelo (`#fef9c3` / `#854d0e`)
- Aguardando informação → marrom claro (`#fde8cc` / `#7c4a03`)
- Em produção → laranja (`#ffedd5` / `#9a3412`)
- Em revisão → roxo (`#ede9fe` / `#5b21b6`)
- Em aprovação → azul (`#dbeafe` / `#1e40af`)
- Concluído → verde (`#d1fae5` / `#065f46`)
- Cancelado → vermelho (`#fee2e2` / `#991b1b`)

### Também adicionar os novos status ao `CLICKUP_STATUS_MAP` em `clickup.ts`:
```ts
"em revisao":    "em-revisao",
"em revisão":    "em-revisao",
"em aprovacao":  "em-aprovacao",
"em aprovação":  "em-aprovacao",
```

### E ao `VALID_STATUSES` em `forms.ts`:
```ts
"em-revisao",
"em-aprovacao",
```

---

## OBSERVAÇÕES
- Após editar `clickup.ts` e `forms.ts`, rodar build:
  `cd artifacts/api-server && pnpm run build`
- `config.js` não precisa de build — muda imediatamente
- Os filtros de status nos dashboards (`dashboard.html` e `admin.html`)
  mostram apenas um subconjunto de status — não precisam ser alterados
  agora, mas podem ser expandidos futuramente para incluir Em revisão
  e Em aprovação
