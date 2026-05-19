import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, artTemplatesTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { uploadToR2 } from "../routes/r2";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "./template-renderer";
import { renderTemplateToPdf } from "./pdf-renderer";
import { FORM_SCHEMAS, FormSchema } from "../config/form-schemas";

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

function resolveComputed(
  dados: Record<string, unknown>,
  schema: FormSchema | undefined,
): Record<string, unknown> {
  if (!schema?.computed?.length) return dados;
  const result = { ...dados };
  for (const c of schema.computed) {
    if (!c.derived_from || !c.transform) continue;
    const source = String(dados[c.derived_from] ?? "");
    if (!source) continue;
    switch (c.transform) {
      case "digits_only": {
        let digits = source.replace(/\D/g, "");
        if (digits.length === 11 && !digits.startsWith("55")) {
          digits = "55" + digits;
        }
        result[c.name] = digits;
        break;
      }
      case "website_by_value":
      case "label_by_value":
        result[c.name] = c.lookup?.[source] ?? "";
        break;
    }
  }
  return result;
}

const TIPO_LABELS: Record<string, string> = {
  "cartao-comemorativo":   "Cartão Comemorativo",
  "cartao-visita-fisico":  "Cartão de Visita",
  "cartao-visita-digital": "Cartão Digital",
  "divulgacao-nps":        "Arte NPS",
  "convite-fp":            "Convite FP",
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

  const resolvedDados = resolveComputed(dados, formSchema);

  const variantField = formSchema?.template_variant_field;
  const variantValue = variantField && resolvedDados[variantField] != null
    ? String(resolvedDados[variantField])
    : null;

  logger.info({
    tipo,
    variantField: variantField ?? null,
    variantValue,
    bodyKeys: Object.keys(resolvedDados),
  }, "[render] buscando template ativo");

  const templateWhere = variantValue
    ? and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true), eq(artTemplatesTable.variant_value, variantValue))
    : and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true), isNull(artTemplatesTable.variant_value));

  const [templateRow] = await db
    .select()
    .from(artTemplatesTable)
    .where(templateWhere)
    .orderBy(desc(artTemplatesTable.id))
    .limit(1);

  if (!templateRow) {
    logger.info({ solicitacaoId, tipo }, "[render] sem template ativo, pulando geração");
    return;
  }

  await db.update(solicitacoesTable)
    .set({ status: "gerando", updated_at: new Date() })
    .where(eq(solicitacoesTable.id, solicitacaoId));

  try {
    const renderData = buildRenderData(resolvedDados);
    logger.info({ solicitacaoId, tipo, keys: Object.keys(renderData) }, "[render] dados mapeados, renderizando");

    const config = templateRow.config as any;
    const outputFormat: "png" | "pdf" = config.output_format === "pdf" ? "pdf" : "png";

    let artBuffer: Buffer;
    let mimetype: string;
    let ext: string;

    if (outputFormat === "pdf") {
      artBuffer = await renderTemplateToPdf(config, renderData);
      mimetype = "application/pdf";
      ext = "pdf";
    } else {
      artBuffer = await renderFromTemplate(config, renderData);
      mimetype = "image/png";
      ext = "png";
    }

    const filename = `${tipo}-${solicitacaoId}-${Date.now()}.${ext}`;
    const tmpPath = path.join(os.tmpdir(), filename);
    await fs.promises.writeFile(tmpPath, artBuffer);

    const url = await uploadToR2(
      { path: tmpPath, originalname: `${tipo}.${ext}`, mimetype },
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
        erro_geracao: null,
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    logger.info({ solicitacaoId, tipo, url }, "Arte gerada e salva");
  } catch (error) {
    logger.error({ solicitacaoId, tipo, error }, "art generation failed");

    await db.update(solicitacoesTable)
      .set({
        status: "erro",
        erro_geracao: error instanceof Error ? error.message : String(error),
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));

    throw error;
  }
}
