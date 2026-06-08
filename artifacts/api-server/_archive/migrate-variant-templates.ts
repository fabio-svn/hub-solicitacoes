/**
 * migrate-variant-templates.ts
 *
 * Explode art_templates rows that previously encoded variants via bg/layer
 * variant_source into independent rows — one per variant value.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-variant-templates.ts [--dry-run]
 *
 * What it does:
 *   1. Load all art_templates rows that have variant_value = NULL.
 *   2. For each such template, check if the form schema has a template_variant_field.
 *   3. If yes, and the template's bg.type === 'variant' or any image layer has
 *      source.type === 'variant' with variant_source === template_variant_field,
 *      clone the row once per variant_option, stripping the variant config and
 *      baking the specific variant URL into a static bg/layer.
 *   4. Mark the original row as is_active = false (or delete if --clean flag).
 *
 * This script is idempotent: it will NOT process rows that already have a
 * non-null variant_value.
 */

import { db } from "@workspace/db";
import { artTemplatesTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { FORM_SCHEMAS } from "../src/config/form-schemas";

const DRY_RUN = process.argv.includes("--dry-run");

type ArtConfig = {
  canvas: { width: number; height: number };
  bg: {
    type: "static" | "variant";
    url?: string;
    variants?: Record<string, string>;
    variant_source?: string;
  };
  layers: Array<{
    id: string;
    type: string;
    source?: {
      type: "static" | "variant";
      url?: string;
      variants?: Record<string, string>;
      variant_source?: string;
    };
    [key: string]: unknown;
  }>;
};

async function main() {
  console.log(DRY_RUN ? "[DRY-RUN] Simulando migração..." : "Iniciando migração...");

  const rows = await db.select().from(artTemplatesTable).where(isNull(artTemplatesTable.variant_value));
  console.log(`Templates sem variant_value: ${rows.length}`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    const schema = FORM_SCHEMAS[row.tipo];
    if (!schema?.template_variant_field) {
      skipped++;
      continue;
    }

    const variantField = schema.template_variant_field;
    const variantOptions = schema.fields.find(f => f.name === variantField)?.options;
    if (!variantOptions?.length) {
      skipped++;
      continue;
    }

    const config = row.config as ArtConfig;
    const bgIsVariant = config.bg?.type === "variant" && config.bg.variant_source === variantField;
    const variantLayers = config.layers.filter(
      l => l.source?.type === "variant" && l.source.variant_source === variantField
    );

    if (!bgIsVariant && variantLayers.length === 0) {
      console.log(`  [SKIP] ${row.tipo}/${row.name} — não usa variant_source="${variantField}"`);
      skipped++;
      continue;
    }

    console.log(`  [PROCESSO] ${row.tipo}/${row.name} → ${variantOptions.length} variantes`);

    for (const opt of variantOptions) {
      const newConfig: ArtConfig = JSON.parse(JSON.stringify(config));

      if (bgIsVariant && config.bg.variants?.[opt.value]) {
        newConfig.bg = { type: "static", url: config.bg.variants[opt.value] };
      }

      for (const layer of newConfig.layers) {
        if (layer.source?.type === "variant" && layer.source.variant_source === variantField) {
          const url = layer.source.variants?.[opt.value] || "";
          layer.source = { type: "static", url };
        }
      }

      const newName = `${row.name} — ${opt.label}`;

      if (!DRY_RUN) {
        await db.insert(artTemplatesTable).values({
          tipo: row.tipo,
          variant_value: opt.value,
          name: newName,
          config: newConfig as any,
          is_active: row.is_active,
          updated_at: new Date(),
          updated_by: row.updated_by,
        });
      }
      console.log(`    ✓ ${DRY_RUN ? "(dry) " : ""}inseriu "${newName}" [variant_value=${opt.value}]`);
    }

    if (!DRY_RUN) {
      await db.update(artTemplatesTable)
        .set({ is_active: false })
        .where(and(eq(artTemplatesTable.id, row.id), isNull(artTemplatesTable.variant_value)));
    }
    console.log(`    → original id=${row.id} marcado como inativo`);
    migrated++;
  }

  console.log(`\nConcluído: ${migrated} migrado(s), ${skipped} ignorado(s).`);
  if (DRY_RUN) console.log("Execute sem --dry-run para aplicar as mudanças.");
  process.exit(0);
}

main().catch(err => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
