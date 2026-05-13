import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/*$/, "/");

const LOGOS: Record<string, string> = {
  "SVN Investimentos": `${R2_PUBLIC_URL}SVN-1.svg`,
  "SVN Capital":       `${R2_PUBLIC_URL}SVN-1.svg`,
  "SVN Connect":       `${R2_PUBLIC_URL}SVN-1.svg`,
};

const SELO_CFP_URL = `${R2_PUBLIC_URL}CFP-Logo.webp`;

function buildHtmlAssinatura(dados: Record<string, unknown>): string {
  const nome     = String(dados.nomeCompleto || dados.nome || "");
  const cargo    = String(dados.cargo || "");
  const telefone = String(dados.telefone || "");
  const email    = String(dados.emailCorporativo || "");
  const marca    = String(dados.marca || "SVN Investimentos");
  const cfp      = String(dados.cfp || "") === "sim";
  const logoUrl  = LOGOS[marca] || LOGOS["SVN Investimentos"];
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

    const tmpPath = path.join(os.tmpdir(), `assinatura-${solicitacaoId}-${Date.now()}.html`);
    await fs.promises.writeFile(tmpPath, html, "utf-8");

    const url = await uploadToR2(
      { path: tmpPath, originalname: "assinatura.html", mimetype: "text/html" },
      solicitacaoId,
      "assinatura"
    );

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
