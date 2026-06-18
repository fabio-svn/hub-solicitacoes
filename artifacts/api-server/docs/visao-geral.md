# Visão Geral

## O que é o Hub

O Hub de Solicitações SVN é um sistema web interno que centraliza os pedidos de materiais de marketing feitos por colaboradores e pelo time de Capital Humano à equipe de Marketing da SVN Invest. Substitui fluxos informais (WhatsApp, e-mail) por um processo rastreável com status em tempo real, integração com ClickUp e geração automática de alguns materiais digitais.

## Problema que resolve

- Eliminar pedidos perdidos ou sem histórico
- Dar visibilidade de status para quem pediu e para quem executa
- Automatizar geração de artefatos simples (assinaturas de e-mail, cartões digitais, artes NPS etc.)
- Unificar briefings em formulários estruturados, reduzindo idas e vindas

## Públicos

| Público | O que faz no Hub |
|---|---|
| **Colaborador / Assessor** (`colaborador`) | Abre solicitações, acompanha status, baixa materiais prontos, aprova artes |
| **Capital Humano** (`capital_humano`) | Acessa formulários exclusivos da área (onboarding, books, linha do tempo etc.) |
| **Gestor** (`gestor`) | Visualiza todas as solicitações, gerencia impersonation |
| **Admin** (`admin`) | Acesso completo: usuários, templates de arte, ClickUp config, tombamentos |
| **Time de Marketing** | Atualiza status via ClickUp; o webhook sincroniza o Hub automaticamente |

## Tipos de solicitação suportados

### Identidade e materiais pessoais
| Tipo (`tipo_solicitacao`) | Label |
|---|---|
| `assinatura-email` | Assinatura de E-mail |
| `cartao-visita-fisico` | Cartão de Visita — Físico |
| `cartao-visita-digital` | Cartão de Visita — Digital |
| `cartao-boas-vindas` | Cartão de Boas-vindas |
| `cartao-comemorativo` | Cartão Comemorativo |
| `divulgacao-nps` | Arte NPS |
| `convite-fp` | Convite Financial Planning |
| `pagina-assessores` | Página de Assessores |

### Eventos e relacionamento
| Tipo | Label |
|---|---|
| `eventos` | Eventos |
| `patrocinio` | Patrocínio |
| `brindes` | Brindes |
| `pagina-online` | Página Online |

### Marketing e conteúdo
| Tipo | Label |
|---|---|
| `artes-divulgacao` | Arte de Divulgação |
| `apresentacao-nova` | Apresentação — Nova |
| `apresentacao-atualizar` | Apresentação — Atualização |
| `conteudo-pdf-informativo` | PDF — Informativo |
| `conteudo-pdf-ebook` | PDF — Ebook |
| `email-marketing` | E-mail Marketing |
| `atualizacao-material` | Atualização de Material |
| `materiais-impressos` | Materiais Impressos |

### Audiovisual
| Tipo | Label |
|---|---|
| `producao-video` | Produção de Vídeo |
| `sessao-fotos` | Sessão de Fotos |
| `producao-audiovisual` | Produção Audiovisual |

### Capital Humano (acesso restrito à role `capital_humano` / `admin`)
| Tipo | Label |
|---|---|
| `ch-kit-onboarding` | Kit Onboarding |
| `ch-atualizacao-pessoas` | Atualização de Pessoas nos Sites |
| `ch-conteudo-pdf` | Conteúdo em PDF (CH) |
| `ch-arte-divulgacao` | Arte de Divulgação (CH) |
| `ch-atualizacao-books` | Atualização de Books |
| `ch-linha-do-tempo` | Linha do Tempo |
| `ch-aniversariantes` | Aniversariantes do Mês |

### Outros
| Tipo | Label |
|---|---|
| `outro` | Outro |

## Geração automática de artefatos

Os tipos a seguir geram o material instantaneamente via `art-generator.ts` + n8n, sem intervenção manual do time de Marketing:

- `assinatura-email`
- `cartao-visita-digital`
- `cartao-boas-vindas`
- `divulgacao-nps`
- `convite-fp`
- `cartao-comemorativo`

## Fluxo de aprovação

Tipos que passam por um ciclo de aprovação pelo solicitante (chat na página de detalhe da solicitação):

- `eventos`
- `artes-divulgacao`
- `atualizacao-material`
- `conteudo-pdf-informativo`
- `conteudo-pdf-ebook`
- `apresentacao-nova`
- `apresentacao-atualizar`
