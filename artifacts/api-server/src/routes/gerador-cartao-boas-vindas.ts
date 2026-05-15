import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, artTemplatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "../services/template-renderer";

const CONTRATO_LABELS: Record<string, string> = {
  'svn-investimentos': 'SVN Investimentos',
  'svn-capital':       'SVN Capital',
  'svn-connect':       'SVN Connect',
};

export async function gerarCartaoBoasVindasHandler(
  solicitacaoId: number,
  dados: Record<string, unknown>
): Promise<void> {
  logger.info({ solicitacaoId }, "Iniciando geração de Cartão de Boas-vindas (template-driven)");

  const nomeCliente    = String(dados.nomeCliente    || "").trim();
  const nomeAssinatura = String(dados.nomeAssinatura || "").trim();
  const unidade        = String(dados.unidade        || "").trim();
  const contratoSocial = String(dados.contratoSocial || "svn-investimentos").trim();
  const isPrivate =
    dados.isPrivate === true ||
    String(dados.isPrivate || "").toLowerCase() === "sim";

  try {
    const [templateRow] = await db
      .select()
      .from(artTemplatesTable)
      .where(and(
        eq(artTemplatesTable.tipo, 'cartao-boas-vindas'),
        eq(artTemplatesTable.is_active, true)
      ));

    if (!templateRow) throw new Error('Nenhum template ativo para cartao-boas-vindas. Ative um template no painel admin.');

    const pngBuffer = await renderFromTemplate(templateRow.config as any, {
      nome_cliente:    nomeCliente,
      nome_assinatura: nomeAssinatura,
      unidade,
      contrato_social: contratoSocial,
      contrato_label:  CONTRATO_LABELS[contratoSocial] || contratoSocial,
      is_private_key:  isPrivate ? 'private' : 'padrao',
    });

    const tmpPath = path.join(os.tmpdir(), `cartao-boas-vindas-${solicitacaoId}-${Date.now()}.png`);
    await fs.promises.writeFile(tmpPath, pngBuffer);

    const url = await uploadToR2(
      { path: tmpPath, originalname: "cartao-boas-vindas.png", mimetype: "image/png" },
      solicitacaoId,
      "cartao-boas-vindas"
    );

    await fs.promises.unlink(tmpPath).catch(() => {});

    await db.update(solicitacoesTable)
      .set({
        entrega_links: [{ label: "Cartão de Boas-vindas", url }],
        status: "concluido",
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    logger.info({ solicitacaoId, url }, "Cartão de Boas-vindas PNG gerado e disponibilizado");

  } catch (err) {
    logger.error({ err, solicitacaoId }, "Erro ao gerar Cartão de Boas-vindas PNG");
    throw err;
  }
}
