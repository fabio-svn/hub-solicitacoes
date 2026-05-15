import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";
import { gerarCartaoBoasVindas } from "../services/welcome-card-generator";

export async function gerarCartaoBoasVindasHandler(
  solicitacaoId: number,
  dados: Record<string, unknown>
): Promise<void> {
  logger.info({ solicitacaoId }, "Iniciando geração de Cartão de Boas-vindas PNG");

  const nomeCliente    = String(dados.nomeCliente    || "").trim();
  const nomeAssinatura = String(dados.nomeAssinatura || "").trim();
  const unidade        = String(dados.unidade        || "").trim();
  const contratoSocial = String(dados.contratoSocial || "svn-investimentos").trim() as
    'svn-investimentos' | 'svn-capital' | 'svn-connect';
  const isPrivate =
    dados.isPrivate === true ||
    String(dados.isPrivate || "").toLowerCase() === "sim";

  try {
    const pngBuffer = await gerarCartaoBoasVindas({
      nomeCliente,
      nomeAssinatura,
      unidade,
      contratoSocial,
      isPrivate,
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
