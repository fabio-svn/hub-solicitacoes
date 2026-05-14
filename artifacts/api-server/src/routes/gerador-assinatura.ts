import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";
import { gerarAssinatura } from "../services/assinatura-generator";

export async function gerarAssinaturaEmail(
  solicitacaoId: number,
  dados: Record<string, unknown>
): Promise<void> {
  logger.info({ solicitacaoId }, "Iniciando geração de assinatura PNG");

  const nome     = String(dados.nomeCompleto || dados.nome || "").trim();
  const telefone = String(dados.telefone || "").trim();
  const email    = String(dados.emailCorporativo || "").trim();
  const cfp      = String(dados.cfp || "").toLowerCase() === "sim";

  try {
    const { pngBuffer, fitNome } = await gerarAssinatura({
      nome,
      telefone,
      email,
      temCFP: cfp,
      marca: "svn-investimentos",
    });

    if (fitNome.belowFloor) {
      logger.warn({ solicitacaoId, nome, size: fitNome.size }, "Nome abaixo do floor mínimo de fonte");
    }

    const tmpPath = path.join(os.tmpdir(), `assinatura-${solicitacaoId}-${Date.now()}.png`);
    await fs.promises.writeFile(tmpPath, pngBuffer);

    const url = await uploadToR2(
      { path: tmpPath, originalname: "assinatura.png", mimetype: "image/png" },
      solicitacaoId,
      "assinatura"
    );

    await fs.promises.unlink(tmpPath).catch(() => {});

    await db.update(solicitacoesTable)
      .set({
        entrega_links: [{ label: "Assinatura de E-mail", url }],
        status: "concluido",
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    logger.info({ solicitacaoId, url }, "Assinatura PNG gerada e disponibilizada");

  } catch (err) {
    logger.error({ err, solicitacaoId }, "Erro ao gerar assinatura PNG");
    throw err;
  }
}
