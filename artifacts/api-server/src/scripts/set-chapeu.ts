/**
 * Troca o conteudo da layer do topo dos templates de convite:
 *   "evento {{tipo_evento}}"  ->  "{{chapeu}}"
 *
 * Texto do topo passa a ser controlado por quem gera a arte:
 *   - Corporate       -> "Hora do Corporate"
 *   - Form de eventos -> "evento presencial" / "evento online"  (default do art-generator)
 *
 * Rodar de dentro de artifacts/api-server:
 *   npx tsx src/scripts/set-chapeu.ts            # simula
 *   npx tsx src/scripts/set-chapeu.ts --apply    # grava
 */
import { db, artTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const APLICAR = process.argv.includes("--apply");

function hostDoBanco(): string {
  const url = process.env.DATABASE_URL || "";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`; // sem usuario/senha
  } catch {
    return url ? "(DATABASE_URL ilegivel)" : "(DATABASE_URL nao definida)";
  }
}

async function main() {
  console.log(`\nBanco: ${hostDoBanco()}`);

  // quantos templates existem ao todo? ajuda a perceber banco vazio/errado
  const todos = await db.select().from(artTemplatesTable);
  console.log(`Total de art_templates neste banco: ${todos.length}`);
  if (todos.length) {
    const porTipo = todos.reduce((acc: Record<string, number>, r: any) => {
      acc[r.tipo] = (acc[r.tipo] || 0) + 1;
      return acc;
    }, {});
    console.log("Por tipo:", porTipo);
  }

  const rows = todos.filter((r: any) => r.tipo === "convite-evento");

  if (rows.length === 0) {
    console.error(
      "\n✗ Nenhum template 'convite-evento' aqui.\n" +
        "  Este provavelmente NAO e o banco de producao.\n" +
        "  Rode apontando para a base certa, por exemplo:\n" +
        '    DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx src/scripts/set-chapeu.ts\n' +
        "  ou:  railway run npx tsx src/scripts/set-chapeu.ts\n",
    );
    process.exit(1);
  }

  console.log(`\n${rows.length} template(s) de convite-evento.`);
  console.log(APLICAR ? "MODO: aplicando alteracoes\n" : "MODO: simulacao (use --apply para gravar)\n");

  let alterados = 0;
  let jaOk = 0;

  for (const row of rows) {
    const config = row.config as any;
    const layers = config?.layers;
    if (!Array.isArray(layers)) {
      console.log(`  [${row.id}] ${row.name}: config sem layers — pulado`);
      continue;
    }

    const layer = layers.find(
      (l: any) => l?.id === "tipo-evento" || /tipo.?evento/i.test(String(l?.id ?? "")),
    );
    if (!layer) {
      console.log(`  [${row.id}] ${row.name}: sem layer de topo — pulado`);
      continue;
    }
    if (layer.content === "{{chapeu}}") {
      jaOk++;
      continue;
    }

    const antes = layer.content;
    layer.content = "{{chapeu}}";

    if (APLICAR) {
      await db.update(artTemplatesTable).set({ config }).where(eq(artTemplatesTable.id, row.id));
    }
    console.log(`  [${row.id}] ${row.name}: "${antes}"  ->  "{{chapeu}}"`);
    alterados++;
  }

  console.log(
    `\n${alterados} a alterar | ${jaOk} ja ok` +
      (APLICAR ? "\n✓ gravado no banco." : "\n(nada foi gravado — rode com --apply)"),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
