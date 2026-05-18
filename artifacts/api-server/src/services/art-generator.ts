import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, artTemplatesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { uploadToR2 } from "../routes/r2";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "./template-renderer";
import { FORM_SCHEMAS } from "../config/form-schemas";

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, c => "_" + c.toLowerCase());
}

function buildRenderData(dados: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(dados)) {
    const strVal = String(value ?? "");
    result[key] = strVal;
    const snakeKey = camelToSnake(key);
    if (snakeKey !== key) result[snakeKey] = strVal;
  }
  return result;
}

const TIPO_LABELS: Record<string, string> = {
  "cartao-comemorativo":   "Cartão Comemorativo",
  "cartao-visita-fisico":  "Cartão de Visita",
  "cartao-visita-digital": "Cartão Digital",
  "divulgacao-nps":        "Arte NPS",
  "convite-fp":            "Convite FP",
  "certificado-eventos":   "Certificado",
  "cartao-boas-vindas":    "Cartão de Boas-vindas",
  "assinatura-email":      "Assinatura de E-mail",
};

export async function gerarArteParaSolicitacao(
  solicitacaoId: number,
  tipo: string,
  dados: Record<string, unknown>,
): Promise<void> {
  logger.info({ solicitacaoId, tipo }, "[render] iniciando geração de arte (template-driven)");

  const formSchema = FORM_SCHEMAS[tipo];
  const variantField = formSchema?.template_variant_field;
  const variantValue = variantField && dados[variantField] != null
    ? String(dados[variantField])
    : null;

  const templateWhere = variantField && variantValue
    ? and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true), eq(artTemplatesTable.variant_value, variantValue))
    : and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true));

  const [templateRow] = await db
    .select()
    .from(artTemplatesTable)
    .where(templateWhere);

  if (!templateRow) {
    logger.info({ solicitacaoId, tipo }, "[render] sem template ativo, pulando geração");
    return;
  }

  const renderData = buildRenderData(dados);
  logger.info({ solicitacaoId, tipo, keys: Object.keys(renderData) }, "[render] dados mapeados, renderizando");

  const pngBuffer = await renderFromTemplate(templateRow.config as any, renderData);

  const filename = `${tipo}-${solicitacaoId}-${Date.now()}.png`;
  const tmpPath = path.join(os.tmpdir(), filename);
  await fs.promises.writeFile(tmpPath, pngBuffer);

  const url = await uploadToR2(
    { path: tmpPath, originalname: `${tipo}.png`, mimetype: "image/png" },
    solicitacaoId,
    tipo,
  );

  await fs.promises.unlink(tmpPath).catch(() => {});

  logger.info({ solicitacaoId, tipo, url }, "[r2] upload OK");

  const label = TIPO_LABELS[tipo] || tipo;
  await db.update(solicitacoesTable)
    .set({
      entrega_links: [{ label, url }],
      status: "concluido",
      updated_at: new Date(),
    })
    .where(eq(solicitacoesTable.id, solicitacaoId));

  logger.info({ solicitacaoId, tipo, url }, "Arte gerada e salva");
}
