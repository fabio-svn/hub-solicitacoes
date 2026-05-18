import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, artTemplatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "../services/template-renderer";

const MARCA_TO_SLUG: Record<string, string> = {
  'svn':                                  'svn-investimentos',
  'svn investimentos':                    'svn-investimentos',
  'svn capital':                          'svn-capital',
  'svn connect':                          'svn-connect',
  'svn gestão':                           'svn-gestao',
  'svn gestao':                           'svn-gestao',
  'svn global':                           'svn-global',
  'svn investment & merchant banking':    'svn-imb',
  'svn imb':                              'svn-imb',
  'svn agro, câmbio & commodities':       'svn-agro-cambio-commodities',
  'svn agro, cambio & commodities':       'svn-agro-cambio-commodities',
  'svn agro, câmbio e commodities':       'svn-agro-cambio-commodities',
  'svn proteção patrimonial':             'svn-protecao-patrimonial',
  'svn protecao patrimonial':             'svn-protecao-patrimonial',
  'svn wealth planning':                  'svn-wealth-planning',
};

function normalizeMarca(raw: string): string {
  const slug = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 &,]/g, '').trim();
  if (MARCA_TO_SLUG[slug]) return MARCA_TO_SLUG[slug];
  if (MARCA_TO_SLUG[raw.toLowerCase()]) return MARCA_TO_SLUG[raw.toLowerCase()];
  return raw;
}

export async function gerarAssinaturaEmail(
  solicitacaoId: number,
  dados: Record<string, unknown>
): Promise<void> {
  logger.info({ solicitacaoId }, "Iniciando geração de assinatura PNG (template-driven)");

  const nome       = String(dados.nomeCompleto || dados.nome || "").trim();
  const telefone   = String(dados.telefone || "").trim();
  const email      = String(dados.emailCorporativo || dados.email || "").trim();
  const marcaRaw   = String(dados.marca || "SVN Investimentos").trim();
  const marca      = normalizeMarca(marcaRaw);
  const marcaLabel = marcaRaw.startsWith('svn-') ? (marcaRaw.replace(/svn-/, 'SVN ').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())) : marcaRaw;
  const cargo      = String(dados.cargo || "").trim();
  const temCFP     = String(dados.tem_cfp || dados.cfp || "").toLowerCase() === "sim";

  try {
    const [templateRow] = await db
      .select()
      .from(artTemplatesTable)
      .where(and(
        eq(artTemplatesTable.tipo, 'assinatura-email'),
        eq(artTemplatesTable.is_active, true)
      ));

    if (!templateRow) throw new Error('Nenhum template ativo para assinatura-email. Ative um template no painel admin.');

    const pngBuffer = await renderFromTemplate(templateRow.config as any, {
      nome,
      cargo,
      telefone,
      email,
      marca,
      marca_label: marcaLabel,
      tem_cfp:     temCFP ? 'sim' : 'nao',
    });

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
