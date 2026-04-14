# Correção — config.js

Aplicar os ajustes abaixo no arquivo `config.js`.

---

## 1. Corrigir `_configReady` — aguardar antes de usar constantes

O fetch de `/api/config` é assíncrono mas os formulários usam as constantes imediatamente. Garantir que `_configReady` seja exportado e aguardado no `init()` de cada formulário.

Substituir o bloco atual do `_configReady` por:

```js
const _configReady = fetch('/api/config')
  .then(r => r.json())
  .then(cfg => {
    if (cfg.urlManual) URL_MANUAL = cfg.urlManual;
    if (cfg.urlTutorialTransmissao) URL_TUTORIAL_TRANSMISSAO = cfg.urlTutorialTransmissao;
    if (cfg.urlVideoHero) URL_VIDEO_HERO = cfg.urlVideoHero;
    if (cfg.urlLogoBranca) URL_LOGO_BRANCA = cfg.urlLogoBranca;
    if (cfg.urlLogoPreta) URL_LOGO_PRETA = cfg.urlLogoPreta;
    if (cfg.emailUpload) EMAIL_UPLOAD = cfg.emailUpload;
    if (cfg.r2PublicUrl) {
      PACOTE_PADRAO_IMAGENS = [
        cfg.r2PublicUrl + '/Convite.png',
        cfg.r2PublicUrl + '/tela1.png'
      ];
    }
  })
  .catch(() => {
    // Silencioso — usa valores hardcoded como fallback
  });
```

Em seguida, no `init()` de **todos os formulários e páginas** que usam constantes de URL (`index.html`, `form-eventos.html`, `form-pagina-assessores.html`, `thankyou.html`, etc.), adicionar `await _configReady` como primeira linha:

```js
async function init() {
  await _configReady; // aguardar config do servidor antes de usar as URLs
  await Auth.init();
  // ... resto do init
}
```

---

## 2. Adicionar status faltantes em `STATUS_SOLICITACAO`

Substituir o array atual por:

```js
const STATUS_SOLICITACAO = [
  { id: "recebido",       label: "Recebido",                  cor: "--sage-green"    },
  { id: "em-analise",     label: "Em análise",                cor: "--ruby-red"      },
  { id: "em-producao",    label: "Em produção",               cor: "--ruby-red"      },
  { id: "aguardando",     label: "Aguardando informação",     cor: "--leather-brown" },
  { id: "aguardando-rh",  label: "Aguardando aprovação do RH",cor: "--leather-brown" },
  { id: "concluido",      label: "Concluído",                 cor: "--sage-green"    },
  { id: "cancelado",      label: "Cancelado",                 cor: "--carbon-black"  },
];
```

---

## 3. Remover selo CFA de `SELOS_ASSESSOR`

Substituir o array atual por (removendo a entrada do CFA):

```js
const SELOS_ASSESSOR = [
  { id: "ancord",          label: "Ancord",        icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/ancord.webp" },
  { id: "cea",             label: "CEA",           icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cea.webp" },
  { id: "cfp",             label: "CFP",           icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/CFP-Logo.webp" },
  { id: "cga",             label: "CGA",           icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cga.webp" },
  { id: "cnpi",            label: "CNPI",          icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cnpj.webp" },
  { id: "cpa10",           label: "CPA-10",        icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cpa10.avif" },
  { id: "cpa20",           label: "CPA-20",        icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/cpa20.webp" },
  { id: "xp-private",      label: "XP Private",    icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/xp-private-24.webp" },
  { id: "palestrante-svn", label: "Palestrante SVN",icon_url: "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/palestrante_certificado.webp" },
];
```

---

## 4. Completar `TIPO_SOLICITACAO_LABELS`

Substituir o objeto atual por versão completa incluindo todos os tipos ativos e inativos:

```js
const TIPO_SOLICITACAO_LABELS = {
  // Ativos
  "eventos":                        "Evento",
  "pagina-assessores-dados":        "Página de Assessores — Dados",
  "pagina-assessores-atualizacao":  "Página de Assessores — Atualização",
  "pagina-assessores":              "Página de Assessores",
  "apresentacao-nova":              "Apresentação — Nova",
  "apresentacao-atualizar":         "Apresentação — Atualização",
  "apresentacao":                   "Apresentação",
  "artes-divulgacao":               "Arte de Divulgação",
  "conteudo-pdf-informativo":       "PDF — Informativo",
  "conteudo-pdf-ebook":             "PDF — Ebook",
  "conteudo-pdf":                   "Conteúdo em PDF",
  "atualizacao-material":           "Atualização de Material",
  // Em breve — labels para caso apareçam no drawer
  "assinatura-email":               "Assinatura de E-mail",
  "cartao-visita-fisico":           "Cartão de Visita — Físico",
  "cartao-visita-digital":          "Cartão de Visita — Digital",
  "cartao-visita":                  "Cartão de Visita",
  "cartao-boas-vindas":             "Cartão de Boas-vindas",
  "cartao-comemorativo":            "Cartão Comemorativo",
  "divulgacao-nps":                 "Divulgação NPS",
  "convite-fp":                     "Convite Financial Planning",
  "email-marketing":                "E-mail Marketing",
  "materia-blog":                   "Matéria para Blog/Jornal/Revista",
  "conteudos-central":              "Conteúdos Central SVN",
  "certificado-eventos":            "Certificado para Eventos",
  "patrocinio":                     "Patrocínio",
  "brindes":                        "Brindes",
  "pagina-online":                  "Página Online",
  "producao-video":                 "Produção de Vídeo",
  "analise-gravacoes":              "Análise de Elegibilidade para Gravações",
  "materiais-impressos":            "Materiais Impressos",
  "obras-manutencao":               "Obras e Manutenções",
  "outro":                          "Outro",
};
```

---

## 5. Adicionar `DRAWER_FIELD_LABELS`

Adicionar este objeto ao final do `config.js`, antes do fechamento do arquivo:

```js
const DRAWER_FIELD_LABELS = {
  // Solicitante
  nome:               "Solicitante",
  setor:              "Setor",
  // Evento
  natureza:           "Natureza",
  maturidade:         "Maturidade",
  nomeEvento:         "Nome do evento",
  dataEvento:         "Data",
  horario:            "Horário",
  horBrasilia:        "Horário de Brasília?",
  descricao:          "Descrição",
  origem:             "Origem",
  tipoEvento:         "Tipo de evento",
  publico:            "Público",
  estado:             "Estado",
  cidade:             "Cidade",
  localEvento:        "Local",
  unidadeSVN:         "Unidade SVN",
  localNome:          "Nome do local",
  localEndereco:      "Endereço",
  localSugestoes:     "Sugestões de local",
  convidados:         "Nº de convidados",
  // Online
  canal:              "Canal de transmissão",
  linkTransmissao:    "Link da transmissão",
  objetivos:          "Objetivos de retorno",
  // Custos
  custoEstimado:      "Custo estimado",
  rateio:             "Rateio",
  // Materiais
  materiais:          "Materiais solicitados",
  // Palestrantes
  palestrantes:       "Palestrantes",
  // Observações
  observacoes:        "Observações",
  ideaQuando:         "Ideia de quando realizar",
  tipoAprox:          "Tipo aproximado",
  // Assessores
  nomeCompleto:       "Nome completo",
  codigoAssessor:     "Código de assessor",
  unidade:            "Unidade",
  contratoSocial:     "Contrato social",
  linkedin:           "LinkedIn",
  instagram:          "Instagram",
  miniBio:            "Mini bio",
  selos:              "Selos e certificações",
  depoimentos:        "Depoimentos",
  // Apresentações / PDF / Artes
  tituloMaterial:     "Título do material",
  finalidade:         "Finalidade",
  tamanho:            "Tamanho",
  tipoCriacao:        "Tipo de criação",
  publicoAlvo:        "Público-alvo",
  prazoEntrega:       "Prazo desejado",
  canaisCompartilhar: "Canais de compartilhamento",
  conteudo:           "Conteúdo",
  observacoesFinais:  "Observações finais",
  // Atualização de material
  descricaoAtualizacao: "O que atualizar",
};
```

---

## OBSERVAÇÃO

Não alterar nenhuma outra constante do arquivo além das listadas acima.
Preservar todos os valores de URLs, arrays e objetos não mencionados exatamente como estão.
