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
  logger.info({ solicitacaoId, dadosKeys: Object.keys(dados) }, "Iniciando geração de Cartão de Boas-vindas (template-driven)");

  await db.update(solicitacoesTable)
    .set({ status: "gerando", updated_at: new Date() })
    .where(eq(solicitacoesTable.id, solicitacaoId));

  // Form envia snake_case; normalizeFormDados pode ter adicionado aliases,
  // mas priorizamos snake_case (origem real do formulário).
  const nomeCliente    = String(dados.nome_cliente    ?? dados.nomeCliente    ?? "").trim();
  const nomeAssinatura = String(dados.nome_assinatura ?? dados.nomeAssinatura ?? "").trim();
  const unidade        = String(dados.unidade         ?? "").trim();
  const contratoSocial = String(dados.contrato_social ?? dados.contratoSocial ?? "svn-investimentos").trim();

  // is_private_key é o campo do rádio: 'padrao' | 'private'
  // O form envia isPrivate ('sim'/'nao'); normalizeFormDados converte para is_private_key ('private'/'padrao').
  // Para registros mais antigos sem normalização, fazemos o mapeamento manual aqui como fallback.
  const isPrivateRaw = String(dados.is_private_key ?? dados.isPrivateKey ?? dados.isPrivate ?? "").trim();
  const isPrivateKey: "padrao" | "private" =
    isPrivateRaw === "sim" || isPrivateRaw === "private" ? "private" :
    isPrivateRaw === "nao" || isPrivateRaw === "padrao"  ? "padrao"  : "padrao";

  logger.info({ solicitacaoId, nomeCliente, nomeAssinatura, unidade, contratoSocial, isPrivateKey }, "[boas-vindas] campos extraídos");

  const renderData: Record<string, string> = {
    nome_cliente:    nomeCliente,
    nome_assinatura: nomeAssinatura,
    unidade,
    contrato_social: contratoSocial,
    contrato_label:  CONTRATO_LABELS[contratoSocial] || contratoSocial,
    is_private_key:  isPrivateKey,
  };

  try {
    // Busca template ativo com a variante correta
    let [templateRow] = await db
      .select()
      .from(artTemplatesTable)
      .where(and(
        eq(artTemplatesTable.tipo, 'cartao-boas-vindas'),
        eq(artTemplatesTable.is_active, true),
        eq(artTemplatesTable.variant_value, isPrivateKey)
      ));

    // Fallback: template ativo sem variant_value (setup single-template)
    if (!templateRow) {
      logger.warn({ solicitacaoId, isPrivateKey }, "[boas-vindas] nenhum template com variant, buscando sem filtro de variant");
      [templateRow] = await db
        .select()
        .from(artTemplatesTable)
        .where(and(
          eq(artTemplatesTable.tipo, 'cartao-boas-vindas'),
          eq(artTemplatesTable.is_active, true)
        ));
    }

    if (!templateRow) throw new Error('Nenhum template ativo para cartao-boas-vindas. Ative um template no painel admin.');

    logger.info({ solicitacaoId, templateId: templateRow.id, variant: templateRow.variant_value }, "[boas-vindas] template selecionado");

    const pngBuffer = await renderFromTemplate(templateRow.config as any, renderData);

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
        erro_geracao: null,
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    logger.info({ solicitacaoId, url }, "Cartão de Boas-vindas PNG gerado e disponibilizado");

  } catch (err) {
    logger.error({ err, solicitacaoId }, "Erro ao gerar Cartão de Boas-vindas PNG");
    await db.update(solicitacoesTable)
      .set({
        status: "erro",
        erro_geracao: err instanceof Error ? err.message : String(err),
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));
    throw err;
  }
}
