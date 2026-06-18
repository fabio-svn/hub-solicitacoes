# Admin & Dashboard

## Páginas de acompanhamento

| Página | Arquivo | Acesso | Descrição |
|---|---|---|---|
| Minhas solicitações | `dashboard.html` | Todos os usuários autenticados | Lista as próprias solicitações (ou todas, se gestor/admin) |
| Painel admin | `admin.html` | `admin`, `gestor` | Visão geral de todas as solicitações |
| Usuários | `admin-usuarios.html` | `admin` | Gerencia usuários e roles |
| ClickUp Listas | `admin-clickup-lists.html` | `admin` | Configura qual lista ClickUp recebe cada tipo |
| Templates de Arte | `admin-templates.html` | `admin` | Gerencia templates de geração automática |
| Assets | `admin-assets.html` | `admin` | Biblioteca de imagens/logos usados nos templates |
| Log de atividades | `admin-log.html` | `admin`, `gestor` | Histórico de eventos do sistema |
| Tombamentos | `admin-tombamentos.html` | `admin` | Geração em massa de assinaturas e cartões digitais |
| Capital Humano | `capital-humano.html` | `capital_humano`, `admin` | Seleção de formulários exclusivos do setor |

---

## Dashboard (`dashboard.html`)

### Contadores no topo

- **Em andamento** — solicitações com status diferente de `concluido` e `cancelado`
- **Concluídas** — solicitações com status `concluido`

### Abas

| Aba | Conteúdo |
|---|---|
| **Solicitações gerais** | Todos os tipos exceto `eventos` |
| **Eventos** | Apenas tipo `eventos` |

### Filtros disponíveis

- **Período:** Hoje / 7 dias / 30 dias / Todos
- **Tipo:** lista de tipos de solicitação
- **Status:** lista dos status (`STATUS_SOLICITACAO`)
- **Alertas:** solicitações com pendência de aprovação

Implementados via `filters.js` com estado local e callback de re-renderização.

### Cards de solicitação

Cada card exibe:
- Título da solicitação
- Tipo (label amigável)
- Data de criação
- Badge de status (cor conforme `STATUS_SOLICITACAO`)
- Badge **"APROVAÇÃO"** em vermelho se status for `em-aprovacao` e não lido
- Botão **"Baixar"** se houver `entrega_links`

---

## Status das solicitações

Lista completa de status com seus slugs internos:

| Slug | Label | Cor de fundo |
|---|---|---|
| `recebido` | Recebido | Cinza escuro |
| `alinhamentos` | Alinhamentos | Azul |
| `em-analise` | Em análise | Amarelo |
| `em-andamento` | Em andamento | Amarelo |
| `em-producao` | Em produção | Laranja |
| `em-revisao` | Em revisão | Roxo |
| `em-aprovacao` | Em aprovação | Azul |
| `cotacao-aprovacao` | Em cotação / aprovação | Azul |
| `aguardando` | Aguardando informação | Marrom |
| `aguardando-rh` | Aguardando aprovação do RH | Marrom |
| `aguardando-pagamento` | Aguardando pagamento | Marrom |
| `aguardando-finalizacao` | Aguardando finalização | Roxo |
| `concluido` | Concluído | Verde |
| `cancelado` | Cancelado | Vermelho |
| `em-espera` | Em espera | Cinza escuro |
| `gerando` | Gerando arte | Azul claro |
| `erro` | Erro | Vermelho claro |
| `aguardando-validacao` | Aguardando validação | Vermelho claro |
| `aguardando-contrato` | Aguardando contrato | Cinza claro |
| `validado` | Validado | Verde claro |
| `liberado-design` | Em design | Roxo claro |
| `arte-finalizada` | Arte finalizada | Amarelo claro |
| `envio-grafica` | Envio gráfica | Azul claro |
| `envio-assessor` | Envio assessor | Verde claro |
| `reprovado` | Reprovado | Vermelho claro |

---

## Gerenciamento de usuários (`admin-usuarios.html`)

- **Listagem** com busca por nome/e-mail
- **Criar usuário:** formulário com e-mail, nome, role e ClickUp user ID opcional
- **Alterar role:** dropdown inline para cada usuário (roles: Colaborador, Capital Humano, Gestor, Admin)
- **Impersonation:** admins e gestores podem logar como outro usuário via `POST /api/admin/impersonate`

> Não é possível alterar a própria role.

---

## Tombamentos (`admin-tombamentos.html`)

Funcionalidade para geração em lote de assinaturas de e-mail e cartões digitais a partir de uma planilha.

**Fluxo:**
1. Admin faz upload de Excel/CSV com lista de colaboradores
2. Opcionalmente, faz upload de um ZIP com fotos de perfil (nomes de arquivo correspondendo aos nomes da planilha)
3. O sistema processa cada linha e gera assinatura de e-mail e/ou cartão digital para cada pessoa
4. Resultado disponível como ZIPs para download (`assinaturas_zip_url`, `cartoes_zip_url`)
5. Links expiram conforme `expires_at`

**Rotas de API envolvidas:**
- `POST /api/admin/tombamentos` — cria um novo lote
- `GET /api/admin/tombamentos` — lista lotes
- `PATCH /api/admin/tombamentos/:id` — atualiza status e URLs de entrega
- `POST /api/admin/tombamentos/parse` — valida e interpreta o arquivo de planilha

---

## Templates de Arte (`admin-templates.html`)

Interface para criação e edição dos templates usados pela geração automática.

- Templates são armazenados na tabela `art_templates`
- Cada template tem `tipo` (tipo de solicitação) e `variant_value` (ex.: slug de marca)
- A configuração (`config` JSONB) define camadas: imagem de fundo, textos, posições, fontes, cores
- Templates com `is_active = false` são ignorados pela geração
- Assets (imagens) são gerenciados separadamente em `admin-assets.html`

---

## Log de Atividades (`admin-log.html`)

Exibe registros da tabela `activity_log` com:
- Filtro por tipo de evento, nível, período
- Busca por e-mail de usuário ou título de solicitação
- Detalhes expandíveis por entrada

---

## Fluxo de aprovação de arte (detalhe da solicitação)

Para tipos com aprovação (`solicitacao.html`):

1. Quando status muda para `em-aprovacao`, a seção "Materiais para aprovação" aparece com badge **NOVO** (destacada com borda vermelha no primeiro acesso).
2. O usuário expande o acordeão e vê links para os arquivos.
3. Escolhe **"Aprovado"** → `POST /api/solicitacoes/:id/aprovacao` → notificação ao time.
4. Ou escolhe **"Solicitar alterações"** → digita observações → enviadas ao time → status muda para `reprovado`.
5. Quando o time revisa, uma nova rodada começa (novo conjunto de links na mesma solicitação).
6. Após aprovação final, pesquisa de satisfação opcional aparece.

O histórico de rodadas é armazenado localmente no `localStorage` do navegador (chave `svn_rodadas_<id>`).
