# Hub de Solicitações SVN — Refinamentos: UI da Assinatura de E-mail

Esta tarefa refina a implementação anterior do tipo `assinatura-email`. São 3 ajustes focados, todos no frontend (exceto pela remoção do mecanismo de teste, que pode tocar backend).

Execute na ordem. Após terminar, rode o build (`cd artifacts/api-server && pnpm run build`) e reinicie o servidor.

---

## Mudança 1 — Página de Resumo da Solicitação

Refatorar o layout da página de resumo **especificamente para o tipo `assinatura-email`**. Outros tipos de solicitação mantêm o layout atual. Use o tipo como condição de renderização.

### 1.1 Header da página

**Hoje:** título mostra o nome da pessoa + várias informações abaixo (status, ID, datas etc).

**Novo:** dois elementos lado a lado, sem nada abaixo.

**Lado esquerdo (título grande):**
- Texto: o **label do tipo de solicitação** (ex.: `Assinatura de e-mail`). Esse label já existe em `CATEGORIAS_SOLICITACAO` no `config.js` — usar a propriedade `label` do item correspondente.
- Tipografia: a mesma fonte serif usada nos headings do hub (Ivy Journal / Taviraj), tamanho generoso (~48-56px), peso light, cor `--carbon-black`.
- Não renderizar nenhum texto/info abaixo do título.

**Lado direito (status + data):**
- Linha 1: `Material disponível` em verde (mesmo verde do `--success` ou similar que já existe no design system). Nunito Sans 600.
- Linha 2: `Data: {data formatada}` em texto secundário (cinza médio). Nunito Sans 400, menor.
- Formato da data: `14 de maio de 2026 - 10:41` (usar `createdAt` ou `dataConclusao` da solicitação — preferir o momento da geração do PNG; se não houver campo específico, usa `updatedAt`).

### 1.2 Remover badges/tags atuais do canto superior direito

Remover do canto direito:
- Tag "Concluído"
- Componente de avaliação (estrelas / rating)

**Manter o botão Deletar** com a mesma lógica atual (só admin enxerga). Pode posicionar discretamente abaixo do bloco de status do lado direito, ou em um ícone-só no canto. O importante é não competir visualmente com o "Material disponível".

### 1.3 Card da assinatura

**Hoje:** assinatura aparece dentro de um card com fundo claro (paper white) visível ao redor.

**Novo:** o card é a própria assinatura — sem padding com cor de fundo, sem moldura branca. Apenas:
- Rounded corners (`border-radius: 12px` por exemplo)
- Sombra/glow sutil para dar elevação visual (`box-shadow: 0 4px 24px rgba(0,0,0,0.15)` ou similar)
- A imagem do PNG ocupa 100% da largura disponível com `object-fit: contain` e `display: block` para evitar gap inferior

CSS sugerido:

```css
.assinatura-preview-card {
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(34, 27, 25, 0.12);
  margin: 24px 0;
}

.assinatura-preview-card img {
  display: block;
  width: 100%;
  height: auto;
}
```

### 1.4 Botão de download

Posicionado **imediatamente abaixo** do card da assinatura. Mudanças:

- Texto: `Fazer download` (era "Baixar assinatura (.png)")
- Largura: 100% do container (mesma largura do card da assinatura acima)
- Altura: ~64-72px (botão grande, presença forte)
- Background: o **degrade dourado** já existente do botão "Enviar" dos formulários
- Ícone de download SVG à esquerda do texto (manter o que já está)
- Fonte: Nunito Sans 700, tamanho ~18-20px, cor escura (`--carbon-black`) para contraste no dourado

### 1.5 ID interno

Manter o texto `ID interno: {id}` em fonte pequena, cor secundária, posicionado abaixo do botão de download. Já está OK na implementação atual — só conferir que não regrediu.

### 1.6 Estrutura HTML resultante

Esquema do que deve sobrar na coluna principal da página:

```
< Minhas solicitações  (breadcrumb existente)

┌─────────────────────────────────────────────┬───────────────────────┐
│ Assinatura de e-mail                        │ Material disponível   │
│ (h1 grande, serif)                          │ Data: 14 de maio...   │
│                                             │ [Deletar - se admin]  │
└─────────────────────────────────────────────┴───────────────────────┘

[ASSINATURA PNG — card sem fundo branco, sombra sutil]

[FAZER DOWNLOAD — botão grande dourado, full width]

ID interno: 251
```

---

## Mudança 2 — Botão de download na lista do dashboard

**Hoje:** na grade de solicitações, o card de assinatura concluída mostra "Baixar" como texto puro sem fundo nem borda. Visualmente fica perdido — não parece um elemento clicável, e quebra o padrão das tags de status que aparecem nos outros cards.

**Novo:** transformar em um botão visual no mesmo formato/dimensões das tags de status (pill compacta), mas com o degrade dourado, deixando claro que é interativo.

### Especificação

```css
.card-solicitacao .btn-download-tag {
  /* mesmas dimensões e formato das tags de status */
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;             /* ajustar para bater com .tag-status existente */
  border-radius: 999px;          /* pill */
  font-family: 'Nunito Sans', sans-serif;
  font-size: 13px;
  font-weight: 700;
  color: var(--carbon-black);

  /* degrade dourado — usar o MESMO gradient do botão Enviar */
  background: /* copiar exatamente do .btn-submit ou equivalente */;

  text-decoration: none;
  transition: filter 0.15s ease;
  cursor: pointer;
}

.card-solicitacao .btn-download-tag:hover {
  filter: brightness(1.05);
}

.card-solicitacao .btn-download-tag svg {
  width: 13px;
  height: 13px;
}
```

**Importante:** o tamanho do botão precisa ficar visualmente equivalente a uma tag de status (`Em análise`, `Concluído`, etc) do hub — não maior, não menor. Se necessário, inspecionar a classe `.tag-status` (ou equivalente) e replicar `padding`, `font-size` e `border-radius` exatos para garantir consistência.

O label fica `Baixar` mesmo (curto, cabe na pill).

---

## Mudança 3 — Remover mecanismo de geração de arquivo de teste

Na implementação anterior foi (provavelmente) criado algum mecanismo de teste para validar a geração da assinatura — pode ter sido:
- Endpoint dev tipo `GET /api/test/assinatura` ou `POST /api/dev/gerar-assinatura-teste`
- Botão no admin para gerar amostra
- Script standalone que gera PNG sem passar pelo fluxo da solicitação
- Imagens-amostra commitadas no repo

**Remover tudo isso.** A única forma de gerar o PNG deve ser via submissão real do formulário de assinatura → criação da solicitação → chamada ao service `gerarAssinatura` no fluxo do handler.

Checar e limpar:

1. Rotas/endpoints de dev relacionados à assinatura → deletar
2. Botões/links no admin de teste → deletar
3. Scripts `pnpm run gerar-teste` ou similar no `package.json` → deletar
4. Arquivos PNG de amostra no diretório de assets (não as imagens base — só as amostras geradas) → deletar
5. Qualquer feature flag tipo `ENABLE_ASSINATURA_TEST` → remover

O service `assinatura-generator.ts` em si **fica** — ele é chamado pelo fluxo de produção. Só o que é específico de teste/dev deve sair.

---

## Build e validação

```bash
cd artifacts/api-server && pnpm run build
# Reiniciar servidor
```

### Testes manuais

1. **Lista de solicitações**: a solicitação concluída de assinatura deve mostrar o botão de download em formato de pill dourada, alinhado com as outras tags. Clicar baixa o PNG.

2. **Página de resumo (não-admin)**: abrir uma solicitação de assinatura como assessor normal:
   - Título "Assinatura de e-mail" grande à esquerda
   - "Material disponível" + data à direita
   - Sem tag de concluído, sem avaliação, sem botão deletar
   - Card da assinatura sem fundo branco, com sombra sutil
   - Botão "Fazer download" grande dourado abaixo
   - "ID interno: ..." pequeno abaixo

3. **Página de resumo (admin)**: igual ao não-admin, **mais** o botão de deletar visível na coluna da direita.

4. **Outros tipos de solicitação** (ex.: cartão de visita, brindes): conferir que NÃO foram afetados — o layout antigo (com card de campos, tag de status, etc) deve continuar igual. A condição de tipo `assinatura-email` precisa estar bem isolada.

5. **Geração de teste removida**: tentar acessar qualquer endpoint/botão antigo de teste → deve retornar 404 ou não existir mais. Só o fluxo real (form → solicitação → PNG) deve funcionar.
