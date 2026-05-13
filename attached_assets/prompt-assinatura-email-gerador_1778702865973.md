# Geração automática de assinatura de e-mail — sem N8N

## Contexto
Ao invés de disparar webhook para o N8N, o backend gera o HTML da assinatura
diretamente, salva no R2 e disponibiliza o link no hub.

---

## 1. Migration — adicionar coluna `entrega_links`

```sql
ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS entrega_links JSONB;
```

No schema Drizzle, adicionar à tabela solicitacoes:
```ts
entrega_links: jsonb("entrega_links"),
```

---

## 2. `artifacts/api-server/src/routes/forms.ts`

### 2a. Remover `assinatura-email` de TIPOS_SEM_CLICKUP (já não usa ClickUp mas agora
tem geração própria — manter fora do ClickUp está correto, apenas documentar)

### 2b. Remover `assinatura-email` do `WEBHOOK_MAP`

```ts
// DE:
const WEBHOOK_MAP: Record<string, string | undefined> = {
  "assinatura-email": process.env.WEBHOOK_ASSINATURA_EMAIL,
  ...
};

// PARA: remover a linha do assinatura-email
const WEBHOOK_MAP: Record<string, string | undefined> = {
  // "assinatura-email" removido — geração feita diretamente pelo backend
  ...
};
```

### 2c. Adicionar chamada ao gerador após o insert da solicitação

```ts
// No POST /solicitacoes, após o bloco de upload de arquivos e geração do título,
// adicionar para o tipo assinatura-email:

if (tipo_solicitacao === "assinatura-email") {
  // Fire-and-forget — não bloqueia o response
  gerarAssinaturaEmail(solicitacao.id, parsedDados).catch(err => {
    logger.error({ err }, "Erro ao gerar assinatura de e-mail");
  });
}

// Manter o dispararWebhook() logo abaixo — ele vai ignorar assinatura-email
// porque não está mais no WEBHOOK_MAP
```

### 2d. Novo endpoint POST /solicitacoes/:id/entrega (se ainda não existir)

```ts
router.post("/solicitacoes/:id/entrega", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const internalSecret = process.env.INTERNAL_API_SECRET;
    const user = req.session?.user;
    const isInternal = internalSecret && req.headers['x-internal-secret'] === internalSecret;
    const isAdmin = user?.role === 'admin' || user?.role === 'gestor';

    if (!isInternal && !isAdmin) {
      res.status(403).json({ error: "Acesso negado" }); return;
    }

    const { links } = req.body as { links: Array<{ label: string; url: string }> };
    if (!links || !Array.isArray(links) || links.length === 0) {
      res.status(400).json({ error: "links é obrigatório" }); return;
    }

    const [solicitacao] = await db.select()
      .from(solicitacoesTable)
      .where(eq(solicitacoesTable.id, id));

    if (!solicitacao) { res.status(404).json({ error: "Não encontrada" }); return; }

    await db.update(solicitacoesTable)
      .set({ entrega_links: links, status: "em-aprovacao", updated_at: new Date() })
      .where(eq(solicitacoesTable.id, id));

    logger.info({ id, links: links.length }, "Links de entrega salvos");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar entrega");
    res.status(500).json({ error: "Erro" });
  }
});
```

### 2e. Atualizar GET /solicitacoes/:id/entrega para ler entrega_links do banco primeiro

```ts
// No início do GET /entrega, antes de consultar o ClickUp:
if (
  solicitacao.entrega_links &&
  Array.isArray(solicitacao.entrega_links) &&
  (solicitacao.entrega_links as Array<unknown>).length > 0
) {
  res.json({ links: solicitacao.entrega_links, status: solicitacao.status });
  return;
}
// ... resto do código (fallback ClickUp) permanece igual
```

---

## 3. Novo arquivo: `artifacts/api-server/src/routes/gerador-assinatura.ts`

Criar arquivo com o gerador da assinatura:

```ts
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// URLs dos assets no R2
const LOGOS: Record<string, string> = {
  "SVN Investimentos": "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-1.svg",
  "SVN Capital":       "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-1.svg",
  "SVN Connect":       "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/SVN-1.svg",
  // Adicionar logos específicos por marca quando disponíveis
};

const SELO_CFP_URL = "https://pub-a2132f9b61f940659cc98265acfcf64c.r2.dev/CFP-Logo.webp";

function buildHtmlAssinatura(dados: Record<string, unknown>): string {
  const nome     = String(dados.nomeCompleto || dados.nome || "");
  const cargo    = String(dados.cargo || "");
  const telefone = String(dados.telefone || "");
  const email    = String(dados.emailCorporativo || "");
  const marca    = String(dados.marca || "SVN Investimentos");
  const cfp      = String(dados.cfp || "") === "sim";
  const logoUrl  = LOGOS[marca] || LOGOS["SVN Investimentos"];

  // Formatar telefone para tel: (remover máscara)
  const telLimpo = telefone.replace(/\D/g, "");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,sans-serif">
<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;max-width:500px">
  <tbody>
    <tr>
      <td style="padding:0 0 12px 0;border-bottom:2px solid #221B19">
        <img src="${logoUrl}" alt="${marca}" height="32" style="display:block;height:32px;width:auto;border:0">
      </td>
    </tr>
    <tr>
      <td style="padding:12px 0 0 0">
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
          <tbody>
            <tr>
              <td style="vertical-align:top;padding-right:16px">
                <table cellpadding="0" cellspacing="0" border="0">
                  <tbody>
                    <tr>
                      <td style="font-family:Arial,sans-serif;font-size:15px;font-weight:700;color:#221B19;padding-bottom:2px;white-space:nowrap">
                        ${nome}
                      </td>
                    </tr>
                    ${cargo ? `
                    <tr>
                      <td style="font-family:Arial,sans-serif;font-size:12px;color:#666666;padding-bottom:8px;white-space:nowrap">
                        ${cargo}
                      </td>
                    </tr>` : ""}
                    ${telefone ? `
                    <tr>
                      <td style="font-family:Arial,sans-serif;font-size:12px;color:#221B19;padding-bottom:2px">
                        <a href="tel:+55${telLimpo}" style="color:#221B19;text-decoration:none">${telefone}</a>
                      </td>
                    </tr>` : ""}
                    ${email ? `
                    <tr>
                      <td style="font-family:Arial,sans-serif;font-size:12px;color:#AC3631;padding-bottom:2px">
                        <a href="mailto:${email}" style="color:#AC3631;text-decoration:none">${email}</a>
                      </td>
                    </tr>` : ""}
                  </tbody>
                </table>
              </td>
              ${cfp ? `
              <td style="vertical-align:middle;padding-left:12px;border-left:1px solid #e5e7eb">
                <img src="${SELO_CFP_URL}" alt="CFP" height="48" style="display:block;height:48px;width:auto;border:0">
              </td>` : ""}
            </tr>
          </tbody>
        </table>
      </td>
    </tr>
  </tbody>
</table>
</body>
</html>`;
}

export async function gerarAssinaturaEmail(
  solicitacaoId: number,
  dados: Record<string, unknown>
): Promise<void> {
  logger.info({ solicitacaoId }, "Gerando assinatura de e-mail");

  try {
    const html = buildHtmlAssinatura(dados);

    // Salvar HTML em arquivo temporário
    const tmpPath = path.join(os.tmpdir(), `assinatura-${solicitacaoId}-${Date.now()}.html`);
    await fs.promises.writeFile(tmpPath, html, "utf-8");

    // Upload para R2
    const url = await uploadToR2(
      { path: tmpPath, originalname: "assinatura.html", mimetype: "text/html" },
      solicitacaoId,
      "assinatura"
    );

    // Salvar link + mudar status para em-aprovacao
    await db.update(solicitacoesTable)
      .set({
        entrega_links: [{ label: "Assinatura de E-mail", url }],
        status: "em-aprovacao",
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    logger.info({ solicitacaoId, url }, "Assinatura gerada e disponibilizada");
  } catch (err) {
    logger.error({ err, solicitacaoId }, "Erro ao gerar assinatura");
    throw err;
  }
}
```

---

## 4. Importar o gerador em forms.ts

```ts
// No topo de forms.ts, adicionar:
import { gerarAssinaturaEmail } from "./gerador-assinatura";
```

---

## 5. Replit Secrets — adicionar

```
INTERNAL_API_SECRET=svn_internal_2026_TROCAR_POR_STRING_ALEATORIA
```

---

## 6. Build

```
cd artifacts/api-server && pnpm run build
```

Reiniciar o servidor após o build.

---

## Resultado

- Assessor envia o formulário de assinatura
- Backend gera o HTML instantaneamente e salva no R2
- Status muda para `em-aprovacao` automaticamente
- Notificação aparece no hub
- Assessor baixa o arquivo `.html` e instala no cliente de e-mail
- N8N não é mais necessário para assinatura de e-mail
