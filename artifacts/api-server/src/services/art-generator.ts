import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { db } from "@workspace/db";
import { solicitacoesTable, artTemplatesTable } from "@workspace/db";
import { eq, and, isNull, desc } from "drizzle-orm";
import { uploadToR2, deleteFromR2 } from "../routes/r2";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "./template-renderer";
import { renderTemplateToPdf } from "./pdf-renderer";
import { FORM_SCHEMAS, FormSchema } from "../config/form-schemas";
import { notificarMarcoBg } from "./notifications";
import { logEventoBg } from "./activity-log";
import { logAtividadeBg } from "./activity-log";
import { gerarPdf as gerarCartaoPdf } from "../cartao/gerar-cartao";

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
    const df = c.derived_from;
    const dfKey = df in dados ? df : Object.keys(dados).find(k => camelToSnake(k) === camelToSnake(df));
    const source = String((dfKey != null ? dados[dfKey] : undefined) ?? "");
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
      case "label_by_value": {
        let key = source;
        if (c.lookup && !(key in c.lookup)) {
          // 'source' pode ser o LABEL (ex.: "SVN Capital") em vez do value (slug).
          const fld = schema.fields?.find(
            f => f.name === df || camelToSnake(f.name) === camelToSnake(df),
          );
          const byLabel = fld?.options?.find(o => o.label === source);
          if (byLabel) key = byLabel.value;
        }
        result[c.name] = c.lookup?.[key] ?? "";
        break;
      }
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

/**
 * Gera o PDF do cartão de visita físico a partir dos campos já informados (ex.: corrigidos
 * na tela de Validação), sobe no R2, grava em entrega_links e retorna a URL.
 * Geração SOB DEMANDA — chamada pelo endpoint POST /cartao-aprovacoes/:id/gerar-pdf.
 */
export async function gerarCartaoFisicoPdf(
  solicitacaoId: number,
  campos: { nome: string; telefone: string; email: string },
): Promise<string> {
  const pdfBuffer = await gerarCartaoPdf(campos);

  const filename = `cartao-visita-fisico-${solicitacaoId}-${Date.now()}.pdf`;
  const tmpPath = path.join(os.tmpdir(), filename);
  await fs.promises.writeFile(tmpPath, pdfBuffer);

  const nomeLabel = campos.nome?.trim() || String(solicitacaoId);
  const downloadName = `Cartão de Visita - ${nomeLabel}.pdf`;

  const url = await uploadToR2(
    { path: tmpPath, originalname: "cartao-visita-fisico.pdf", mimetype: "application/pdf" },
    solicitacaoId,
    "cartao-visita-fisico",
    downloadName,
  );

  try {
    await db.update(solicitacoesTable)
      .set({
        entrega_links: [{ label: TIPO_LABELS["cartao-visita-fisico"], url }],
        updated_at: new Date(),
      })
      .where(eq(solicitacoesTable.id, solicitacaoId));
  } catch (dbErr) {
    logger.error({ dbErr, solicitacaoId, url }, "DB update falhou após upload R2 — deletando objeto órfão");
    await deleteFromR2(url).catch(() => {});
    throw dbErr;
  }

  logger.info({ solicitacaoId, url }, "[cartao] PDF gerado sob demanda");
  return url;
}

/**
 * Para cada campo com `options` no schema, gera `{campo}_label` com o label
 * autoral da option correspondente. Fonte da verdade = as proprias options
 * (acento/acronimo/frase intactos). Aditivo: mantem o valor cru intacto.
 * Valor fora das options cai no proprio valor (nunca fica em branco).
 */
function addOptionLabels(
  dados: Record<string, unknown>,
  schema: FormSchema | undefined,
): Record<string, unknown> {
  if (!schema?.fields?.length) return dados;
  const out = { ...dados };
  const findKey = (name: string): string | undefined =>
    name in dados ? name : Object.keys(dados).find(k => camelToSnake(k) === camelToSnake(name));
  for (const fld of schema.fields) {
    const opts = fld.options;
    if (!opts?.length) continue;
    const dk = findKey(fld.name);
    if (!dk) continue;
    const raw = dados[dk];
    if (raw == null || raw === "") continue;
    const labelOf = (v: unknown) =>
      opts.find(o => o.value === String(v))?.label ?? String(v);
    out[`${fld.name}_label`] = Array.isArray(raw)
      ? raw.map(labelOf).join("; ")
      : labelOf(raw);
  }
  return out;
}

/**
 * Gera o artefato (PNG ou PDF) de um tipo a partir de `dados`, SEM criar solicitação,
 * sem subir no R2 e sem tocar no banco de solicitações. Usado pela geração em massa
 * (Tombamentos). Retorna o buffer + extensão/mimetype, ou null se não houver template ativo.
 */
export async function gerarArteBuffer(
  tipo: string,
  dados: Record<string, unknown>,
): Promise<{ buffer: Buffer; ext: string; mimetype: string } | null> {
  const formSchema = FORM_SCHEMAS[tipo];
  const resolvedDados = addOptionLabels(resolveComputed(dados, formSchema), formSchema);

  const variantField = formSchema?.template_variant_field;
  const variantValue = variantField && resolvedDados[variantField] != null
    ? String(resolvedDados[variantField])
    : null;

  const templateWhere = variantValue
    ? and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true), eq(artTemplatesTable.variant_value, variantValue))
    : and(eq(artTemplatesTable.tipo, tipo), eq(artTemplatesTable.is_active, true), isNull(artTemplatesTable.variant_value));

  const [templateRow] = await db
    .select()
    .from(artTemplatesTable)
    .where(templateWhere)
    .orderBy(desc(artTemplatesTable.id))
    .limit(1);

  if (!templateRow) return null;

  const renderData = buildRenderData(resolvedDados);
  const config = templateRow.config as any;
  const outputFormat: "png" | "pdf" = config.output_format === "pdf" ? "pdf" : "png";

  if (outputFormat === "pdf") {
    return { buffer: await renderTemplateToPdf(config, renderData), ext: "pdf", mimetype: "application/pdf" };
  }
  return { buffer: await renderFromTemplate(config, renderData), ext: "png", mimetype: "image/png" };
}

export async function gerarArteParaSolicitacao(
  solicitacaoId: number,
  tipo: string,
  dados: Record<string, unknown>,
): Promise<void> {
  logger.info({ solicitacaoId, tipo }, "[render] iniciando geração de arte (template-driven)");
  logEventoBg(solicitacaoId, { tipo: "info", origem: "art-generator", mensagem: "Iniciando geração", detalhes: { tipo } });

  const formSchema = FORM_SCHEMAS[tipo];

  const resolvedDados = addOptionLabels(resolveComputed(dados, formSchema), formSchema);


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

    logger.info({ solicitacaoId, tipo, url }, "[r2] upload OK");

    const label = TIPO_LABELS[tipo] || tipo;
    try {
      await db.update(solicitacoesTable)
        .set({
          entrega_links: [{ label, url }],
          status: "concluido",
          erro_geracao: null,
          updated_at: new Date(),
        })
        .where(eq(solicitacoesTable.id, solicitacaoId));
    } catch (dbErr) {
      logger.error({ dbErr, solicitacaoId, url }, "DB update falhou após upload R2 — deletando objeto órfão");
      await deleteFromR2(url).catch(() => {});
      throw dbErr;
    }

    notificarMarcoBg(solicitacaoId, "concluida");
    logEventoBg(solicitacaoId, { tipo: "info", origem: "art-generator", mensagem: "Geração concluída", detalhes: { url } });

    logger.info({ solicitacaoId, tipo, url }, "Arte gerada e salva");
  } catch (error: any) {
    logger.error({ solicitacaoId, tipo, error }, "art generation failed");
    logEventoBg(solicitacaoId, {
      tipo: "error",
      origem: "art-generator",
      mensagem: "Falha na geração",
      detalhes: { err: String(error) },
    });
    logAtividadeBg({
      tipo: "automacao_erro", nivel: "error",
      solicitacaoId, tipoSolicitacao: tipo,
      detalhe: `Falha na geração automática (${tipo}) da solicitação #${solicitacaoId}: ${error instanceof Error ? error.message : String(error)}`,
      metadata: { erro: error instanceof Error ? error.message : String(error) },
    });

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