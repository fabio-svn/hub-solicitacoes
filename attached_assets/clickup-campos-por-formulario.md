# ClickUp — Campos a criar por categoria de solicitação

> Para cada campo abaixo, após criar no ClickUp, você precisará copiar o **ID do custom field** e informar aqui para que a integração seja feita.
> Campos marcados com 🟢 **já têm ID configurado** na integração atual.

---

## Contexto: listas no ClickUp

O sistema usa **duas listas** no ClickUp:

| Lista | Tipos de solicitação |
|---|---|
| **Eventos** | `eventos` (presencial / online) |
| **Geral** | Todos os outros tipos |

Os campos de cada lista precisam ser criados na lista correspondente.

---

## 1. Lista Eventos

### Campos a criar (tipo no ClickUp → tipo sugerido)

| Campo no ClickUp | Chave no payload | Tipo sugerido | ID atual |
|---|---|---|---|
| Nome do solicitante | `nome` | Texto | 🟢 `92db4658-70d1-430e-98ec-5e27029136fd` |
| Data do evento | `dataEvento` | Data | 🟢 `361cb66a-8c99-43ec-a4fa-5a347e9a4fbd` |
| Origem do evento | `origem` | Texto | 🟢 `626bb697-d9eb-4e79-8277-8a7145e4b979` |
| Horário do evento | `horario` | Texto | 🟢 `45d8babe-a7dd-4a78-952f-1aa366bf34ed` |
| Título do evento | `nomeEvento` | Texto | 🟢 `b40d49f5-341d-4671-a4f0-7cef7a643d6b` |
| O evento terá palestrantes? | `temPalestrante` | Texto (Sim / Não) | 🟢 `8dbc39d5-f2e7-4669-be67-b1a24a53c2cf` |
| Palestrante 1 — é colaborador SVN? | `palSvn1` | Texto (Sim / Não) | 🟢 `28491235-89d7-4384-819c-66ca974d04a0` |
| Palestrante 1 — Nome | `palNome1` | Texto | 🟢 `5de3fdb1-3434-4820-92c8-6e7ee82cd3eb` |
| Palestrante 1 — Cargo | `palCargo1` | Texto | 🟢 `56fbcd07-eab1-465d-9055-8c5e6c0f39ac` |
| Palestrante 1 — Foto | arquivo `palFoto1` | URL | 🟢 `73d010f4-fb4b-4e00-bcf1-f550487c18fd` |
| Natureza | `natureza` | Texto (presencial / online) | ⬜ aguardando ID |
| Nível de maturidade | `maturidade` | Texto | ⬜ aguardando ID |
| Tipo de evento | `tipoEvento` | Texto | ⬜ aguardando ID |
| Público-alvo | `publico` | Texto | ⬜ aguardando ID |
| Número estimado de convidados | `convidados` | Número | ⬜ aguardando ID |
| Custo estimado | `custoEstimado` | Texto (ex: R$ 1.500,00) | ⬜ aguardando ID |
| Rateio | `rateio` | Texto | ⬜ aguardando ID |
| Objetivos | `objetivos` | Texto longo | ⬜ aguardando ID |
| Materiais solicitados | `materiais` | Texto (lista separada por vírgula) | ⬜ aguardando ID |
| Observações gerais | `observacoes` | Texto longo | ⬜ aguardando ID |
| Estado (presencial) | `estado` | Texto | ⬜ aguardando ID |
| Cidade (presencial) | `cidade` | Texto | ⬜ aguardando ID |
| Local / Unidade SVN (presencial) | `localEvento` + `unidadeSVN` | Texto | ⬜ aguardando ID |
| Nome do local externo (presencial) | `localNome` | Texto | ⬜ aguardando ID |
| Endereço do local externo (presencial) | `localEndereco` | Texto | ⬜ aguardando ID |
| Canal de transmissão (online) | `canal` | Texto | ⬜ aguardando ID |
| Link de transmissão (online) | `linkTransmissao` | URL | ⬜ aguardando ID |
| Ideia / Quando (maturidade 3) | `ideaQuando` | Texto | ⬜ aguardando ID |
| Logo complementar de parceiro | arquivo `logoFile` | URL | ⬜ aguardando ID |
| Imagem complementar | arquivo `imgFile` | URL | ⬜ aguardando ID |
| Demais arquivos de apoio | arquivo `demaisFile` | URL | ⬜ aguardando ID |
| Palestrante 2 — é colaborador SVN? | `palSvn2` | Texto (Sim / Não) | ⬜ aguardando ID |
| Palestrante 2 — Nome | `palNome2` | Texto | ⬜ aguardando ID |
| Palestrante 2 — Cargo | `palCargo2` | Texto | ⬜ aguardando ID |
| Palestrante 2 — Foto | arquivo `palFoto2` | URL | ⬜ aguardando ID |
| Palestrante 3 — Nome | `palNome3` | Texto | ⬜ aguardando ID |
| Palestrante 3 — Cargo | `palCargo3` | Texto | ⬜ aguardando ID |
| Palestrante 3 — Foto | arquivo `palFoto3` | URL | ⬜ aguardando ID |
| Palestrante 4 — Nome | `palNome4` | Texto | ⬜ aguardando ID |
| Palestrante 4 — Cargo | `palCargo4` | Texto | ⬜ aguardando ID |
| Palestrante 4 — Foto | arquivo `palFoto4` | URL | ⬜ aguardando ID |

> Os campos de palestrantes 2, 3 e 4 ainda precisam ser adicionados ao payload do formulário além dos IDs.

---

## 2. Lista Geral — Artes e Divulgação

**Tipo:** `artes-divulgacao`

| Campo no ClickUp | Chave no payload | Tipo sugerido | ID |
|---|---|---|---|
| Nome do solicitante | `nome` | Texto | ⬜ aguardando ID |
| Título / identificação da peça | `titulo` | Texto | ⬜ aguardando ID |
| Finalidade | `finalidade` | Texto longo | ⬜ aguardando ID |
| Canais de divulgação | `canais` | Texto (lista separada por vírgula) | ⬜ aguardando ID |
| Canal personalizado (outro) | `canalOutro` | Texto | ⬜ aguardando ID |
| Conteúdo / Briefing da peça | `conteudo` | Texto longo | ⬜ aguardando ID |
| Público-alvo | `publicoAlvo` | Texto | ⬜ aguardando ID |
| Prazo de entrega | `prazoEntrega` | Data | ⬜ aguardando ID |
| Observações | `observacoes` | Texto longo | ⬜ aguardando ID |
| Arquivo de apoio | arquivo `arquivoApoio` | URL | ⬜ aguardando ID |

---

## 3. Lista Geral — Atualização de Material

**Tipo:** `atualizacao-material`

| Campo no ClickUp | Chave no payload | Tipo sugerido | ID |
|---|---|---|---|
| Nome do solicitante | `nome` | Texto | ⬜ aguardando ID |
| Título do material | `titulo` | Texto | ⬜ aguardando ID |
| Finalidade | `finalidade` | Texto longo | ⬜ aguardando ID |
| Descrição das atualizações | `descricao` | Texto longo | ⬜ aguardando ID |
| Material atual (arquivo) | arquivo `materialAtual` | URL | ⬜ aguardando ID |

---

## 4. Lista Geral — Criação de PDF

**Tipos:** `conteudo-pdf-informativo` / `conteudo-pdf-ebook`  
**Subtipos:** `informativo` / `ebook`

| Campo no ClickUp | Chave no payload | Tipo sugerido | ID |
|---|---|---|---|
| Nome do solicitante | `nome` | Texto | ⬜ aguardando ID |
| Título do documento | `titulo` | Texto | ⬜ aguardando ID |
| Finalidade | `finalidade` | Texto longo | ⬜ aguardando ID |
| Canais de distribuição | `canais` | Texto (lista separada por vírgula) | ⬜ aguardando ID |
| Canal personalizado (outro) | `canalOutro` | Texto | ⬜ aguardando ID |
| Conteúdo / Briefing | `conteudo` | Texto longo | ⬜ aguardando ID |
| Público-alvo | `publicoAlvo` | Texto | ⬜ aguardando ID |
| Prazo de entrega | `prazoEntrega` | Data | ⬜ aguardando ID |
| Observações | `observacoes` | Texto longo | ⬜ aguardando ID |
| Arquivo de apoio | arquivo `arquivoApoio` | URL | ⬜ aguardando ID |

---

## 5. Lista Geral — Apresentações

**Tipos:** `apresentacao-nova` / `apresentacao-atualizar`  
**Subtipos:** `nova` / `atualizar`

| Campo no ClickUp | Chave no payload | Tipo sugerido | ID |
|---|---|---|---|
| Nome do solicitante | `nome` | Texto | ⬜ aguardando ID |
| Título | `titulo` | Texto | ⬜ aguardando ID |
| Finalidade | `finalidade` | Texto longo | ⬜ aguardando ID |
| Tamanho / Formato | `tamanho` | Texto (ex: 16:9, A4) | ⬜ aguardando ID |
| Tipo de criação | `tipoCriacao` | Texto (do zero / base existente) | ⬜ aguardando ID |
| Elementos desejados | `elementos` | Texto (lista separada por vírgula) | ⬜ aguardando ID |
| Descrição dos elementos | `elementosDescricao` | Texto longo | ⬜ aguardando ID |
| Público-alvo | `publicoAlvo` | Texto | ⬜ aguardando ID |
| Prazo de entrega | `prazoEntrega` | Data | ⬜ aguardando ID |
| Observações | `observacoes` | Texto longo | ⬜ aguardando ID |
| Apresentação atual (para atualizar) | arquivo `arquivoBase` | URL | ⬜ aguardando ID |
| Base para nova apresentação | arquivo `arquivoBaseNova` | URL | ⬜ aguardando ID |
| Arquivo de apoio | arquivo `arquivoApoio` | URL | ⬜ aguardando ID |

---

## 6. Lista Geral — Página de Assessores

**Tipos:** `pagina-assessores-dados` / `pagina-assessores-atualizacao`  
**Subtipos:** `dados` / `atualizacao`

| Campo no ClickUp | Chave no payload | Tipo sugerido | ID |
|---|---|---|---|
| Nome do solicitante (usuário logado) | `nome` | Texto | ⬜ aguardando ID |
| Nome completo do assessor | `nomeCompleto` | Texto | ⬜ aguardando ID |
| Código do assessor | `codigoAssessor` | Texto | ⬜ aguardando ID |
| Unidade | `unidade` | Texto | ⬜ aguardando ID |
| Contrato social | `contratoSocial` | Texto | ⬜ aguardando ID |
| LinkedIn | `linkedin` | URL | ⬜ aguardando ID |
| Instagram | `instagram` | Texto | ⬜ aguardando ID |
| Mini bio | `miniBio` | Texto longo | ⬜ aguardando ID |
| Selos | `selos` | Texto (lista separada por vírgula) | ⬜ aguardando ID |
| Depoimentos | `depoimentos` | Texto longo (JSON formatado) | ⬜ aguardando ID |
| Foto de perfil | arquivo `fotoPerfil` | URL | ⬜ aguardando ID |

---

## Resumo de totais

| Categoria | Campos de texto/data | Campos de arquivo | Total |
|---|---|---|---|
| Eventos | 29 | 11 | **40** |
| Artes e Divulgação | 9 | 1 | **10** |
| Atualização de Material | 4 | 1 | **5** |
| Criação de PDF | 9 | 1 | **10** |
| Apresentações | 10 | 3 | **13** |
| Página de Assessores | 10 | 1 | **11** |
| **Total geral** | **71** | **18** | **89** |

---

## Campos compartilhados entre formulários da Lista Geral

Os campos abaixo aparecem em **mais de um tipo** de solicitação na lista Geral. Se preferir não duplicar no ClickUp, você pode criar um único custom field compartilhado:

| Campo | Aparece em |
|---|---|
| Nome do solicitante | Todos os tipos |
| Prazo de entrega | Artes, PDF, Apresentações |
| Público-alvo | Artes, PDF, Apresentações |
| Canais | Artes, PDF |
| Finalidade | Artes, PDF, Apresentações, Atualização |
| Observações | Artes, PDF, Apresentações, Atualização |
| Arquivo de apoio | Artes, PDF, Apresentações |
