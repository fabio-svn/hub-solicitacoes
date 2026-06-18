# Modelo de Dados

## Tabelas principais

### `users`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | ID interno |
| `email` | `varchar(255)` | E-mail corporativo (@svninvest.com.br) — único |
| `name` | `varchar(255)` | Nome completo |
| `role` | `varchar(20)` | Role: `colaborador` (padrão), `gestor`, `admin`, `capital_humano` |
| `telefone` | `varchar(30)` | Telefone sincronizado do MySQL Contatos |
| `clickup_user_id` | `varchar(100)` | ID do usuário correspondente no ClickUp |
| `created_at` | `timestamp` | Data de criação |

---

### `solicitacoes`

Tabela central. Cada linha representa um pedido.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | ID do pedido |
| `user_email` | `varchar(255)` | E-mail do solicitante |
| `tipo_solicitacao` | `varchar(50)` | Slug do tipo (ex.: `assinatura-email`) |
| `subtipo` | `varchar(50)` | Sub-tipo opcional (ex.: `fisico`, `digital`) |
| `maturidade` | `integer` | Nível de maturidade (uso específico por tipo) |
| `dados` | `jsonb` | **Todos os campos do formulário preenchidos** (chaves snake_case) |
| `clickup_task_id` | `varchar(100)` | ID da tarefa correspondente no ClickUp |
| `titulo` | `text` | Título gerado automaticamente para exibição |
| `clickup_url` | `text` | URL da tarefa no ClickUp |
| `avaliacao` | `jsonb` | Avaliação de satisfação do solicitante (opcional) |
| `entrega_links` | `jsonb` | Array `[{ label, url }]` dos materiais entregues |
| `status` | `varchar(30)` | Status atual (slugs de `STATUS_SOLICITACAO`) |
| `responsavel` | `text` | Nome do responsável atribuído no ClickUp |
| `erro_geracao` | `text` | Mensagem de erro se a geração automática falhou |
| `notifications_sent` | `jsonb` | Controle de quais notificações já foram disparadas |
| `created_at` | `timestamp` | Data de criação |
| `updated_at` | `timestamp` | Última atualização |

---

### `arquivos`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | ID do arquivo |
| `solicitacao_id` | `integer FK → solicitacoes.id` | Solicitação à qual pertence |
| `campo` | `varchar(100)` | Nome do campo de upload (ex.: `foto_perfil`) |
| `url_r2` | `text` | URL pública no Cloudflare R2 |
| `nome_original` | `varchar(255)` | Nome original do arquivo enviado pelo usuário |
| `created_at` | `timestamp` | Data de upload |

---

### `eventos_solicitacao`

Log detalhado de eventos por solicitação (trilha de auditoria).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | ID do evento |
| `solicitacao_id` | `integer FK → solicitacoes.id` | Solicitação relacionada |
| `tipo` | `varchar(16)` | Tipo de evento (ex.: `status`, `aprovacao`, `entrega`) |
| `origem` | `varchar(32)` | Origem (ex.: `webhook`, `usuario`, `sistema`) |
| `mensagem` | `text` | Descrição legível do evento |
| `detalhes` | `jsonb` | Dados adicionais do evento |
| `user_email` | `varchar(255)` | Usuário que gerou o evento (se aplicável) |
| `created_at` | `timestamp` | Data do evento |

---

### `activity_log`

Log de alto nível do sistema (menos granular que `eventos_solicitacao`).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | |
| `created_at` | `timestamp` | |
| `user_email` / `user_name` | `text` | Usuário envolvido |
| `tipo` | `text` | Categoria do evento |
| `nivel` | `varchar(10)` | `info`, `warn`, `error` |
| `solicitacao_id` | `integer` | Referência à solicitação (se aplicável) |
| `tipo_solicitacao` | `text` | Tipo da solicitação (desnormalizado) |
| `titulo` | `text` | Título da solicitação (desnormalizado) |
| `detalhe` | `text` | Mensagem descritiva |
| `metadata` | `jsonb` | Dados extras |

---

### `art_templates`

Templates dinâmicos para geração de arte.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | |
| `tipo` | `varchar(100)` | Tipo de solicitação ao qual o template se aplica |
| `variant_value` | `varchar(100)` | Valor de variante (ex.: slug de marca) |
| `name` | `varchar(200)` | Nome descritivo do template |
| `config` | `jsonb` | Configuração completa do template (camadas, fontes, posições) |
| `is_active` | `boolean` | Se `false`, ignorado pela geração |
| `created_at` / `updated_at` | `timestamp` | |
| `updated_by` | `integer FK → users.id` | |

---

### `art_assets`

Imagens/logos reutilizáveis nos templates.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | |
| `filename` | `varchar(300)` | Nome original do arquivo |
| `storage_key` | `varchar(500)` | Chave no R2 |
| `url` | `varchar(500)` | URL pública |
| `mime_type` | `varchar(100)` | |
| `size_bytes` | `bigint` | |
| `width` / `height` | `integer` | Dimensões da imagem |
| `uploaded_by` | `integer FK → users.id` | |
| `used_in_template_ids` | `integer[]` | IDs de templates que usam este asset |

---

### `cartao_aprovacoes`

Workflow de aprovação e impressão de cartão de visita físico.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | |
| `solicitacao_id` | `integer FK → solicitacoes.id` | |
| `data_pedido` | `varchar(20)` | Data do pedido (legado: string formatada) |
| `nome` / `whatsapp` / `email` | `varchar` | Dados do solicitante |
| `unidade` | `varchar(120)` | Unidade SVN de entrega |
| `contrato_social` | `varchar(60)` | Entidade jurídica |
| `envio_para` | `varchar(255)` | Endereço de entrega |
| `custo` | `varchar(20)` | Custo estimado |
| `status` | `varchar(40)` | Status específico do cartão físico |
| `observacao` | `text` | Observações do time |

---

### `tombamentos`

Geração em massa de assets digitais (onboarding / migração).

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `serial PK` | |
| `nome` | `varchar(255)` | Nome do lote |
| `marca` | `varchar(60)` | Marca SVN alvo |
| `status` | `varchar(30)` | Status do processamento |
| `linhas` | `jsonb` | Array de registros do spreadsheet |
| `assinaturas_zip_url` | `text` | URL do ZIP com assinaturas geradas |
| `cartoes_zip_url` | `text` | URL do ZIP com cartões gerados |
| `expires_at` | `timestamp` | Expiração dos arquivos gerados |
| `created_by` | `varchar(255)` | Email do admin que criou |

---

### Demais tabelas de configuração

| Tabela | Propósito |
|---|---|
| `user_tipo_assignments` | RBAC: mapeia usuário → tipo de solicitação permitido |
| `tipo_clickup_list` | Mapeia tipo de solicitação → lista ClickUp configurada |
| `clickup_lists` | Cache das listas ClickUp disponíveis |

---

## O campo `dados` (JSONB)

`solicitacoes.dados` armazena **todos os campos do formulário** como um objeto JSON livre. Não há colunas separadas por campo — a estrutura varia por `tipo_solicitacao`.

**Convenção de chaves:** snake_case canônico, conforme `KEY_MAP` em `forms.ts`.

Exemplo para `assinatura-email`:
```json
{
  "nome_assinatura": "João Silva",
  "cargo": "Assessor de Investimentos",
  "marca": "svn-investimentos",
  "contrato_social": "svn-investimentos",
  "whatsapp": "(41) 99999-0000",
  "email_corporativo": "joao.silva@svninvest.com.br",
  "selos": ["ancord", "cfp"],
  "is_private_key": false
}
```

---

## Resolução de labels para exibição

Quando o detalhe de uma solicitação é exibido, os valores brutos do campo `dados` precisam ser convertidos para texto legível. O fluxo é:

1. **`window._svnFieldLabels`** (populado por `/api/form-schemas`) — primeiro lookup: `_svnFieldLabels[campo][valor]`.
2. **`humanizeValue(key, value)`** em `utils.js` — fallback geral: trata booleanos, slugs comuns, datas, listas.
3. **`DRAWER_FIELD_LABELS`** em `config.js` — define o label do **nome** do campo (ex.: `nome_assinatura` → "Nome para assinatura"). Campos com `skip: true` são omitidos na exibição.

Labels de nomes de campos: `DRAWER_FIELD_LABELS_FLAT` é o mapa plano `{ chave: label }` derivado de `DRAWER_FIELD_LABELS`.
