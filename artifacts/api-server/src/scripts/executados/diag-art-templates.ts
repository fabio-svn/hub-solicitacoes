/**
 * Diagnóstico: mostra o que existe de fato na tabela art_templates.
 * Serve para descobrir sob qual `tipo` os templates de convite foram salvos
 * (e confirmar que o script está falando com o banco certo).
 *
 * Uso:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/diag-art-templates.ts
 */
import { db, artTemplatesTable } from "@workspace/db";

async function main() {
  // pista 1: em qual banco/host estamos?
  const url = process.env.DATABASE_URL ?? "";
  const host = url ? (url.split("@")[1] ?? "").split("/")[0] : "(DATABASE_URL vazia!)";
  console.log(`\nBanco: ${host}\n`);

  const rows = await db.select().from(artTemplatesTable);
  console.log(`Total de templates: ${rows.length}\n`);

  if (rows.length === 0) {
    console.log("Tabela art_templates VAZIA — provavelmente é outro banco (dev x prod).");
    process.exit(0);
  }

  // agrupa por tipo
  const porTipo = new Map<string, { total: number; variantes: string[] }>();
  for (const r of rows) {
    const t = r.tipo;
    if (!porTipo.has(t)) porTipo.set(t, { total: 0, variantes: [] });
    const e = porTipo.get(t)!;
    e.total++;
    e.variantes.push(String(r.variant_value ?? "-"));
  }

  console.log("Tipos encontrados:");
  for (const [tipo, e] of [...porTipo.entries()].sort()) {
    console.log(`  ${tipo}  (${e.total})  variantes: ${e.variantes.join(", ")}`);
  }

  // detalha o que parecer convite
  const convites = rows.filter((r) => r.tipo.toLowerCase().includes("convite"));
  if (convites.length > 0) {
    console.log(`\nTemplates com "convite" no tipo (${convites.length}):`);
    for (const c of convites) {
      const cfg = c.config as any;
      const layers = Array.isArray(cfg?.layers) ? cfg.layers : [];
      const temEndereco = layers.some(
        (l: any) =>
          typeof l?.content === "string" && /\{\{\s*(local_nome|endereco)\s*\}\}/.test(l.content)
      );
      console.log(
        `  id=${c.id} tipo="${c.tipo}" variant="${c.variant_value ?? "-"}" ativo=${c.is_active}` +
          ` layers=${layers.length} temLayerEndereco=${temEndereco ? "SIM" : "NAO"} nome="${c.name}"`
      );
    }
  } else {
    console.log('\nNenhum template com "convite" no tipo.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
