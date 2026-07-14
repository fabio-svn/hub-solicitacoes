#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Conserta os imports do set-chapeu.ts que ja esta no servidor.
Eu escrevi "../db" e "../db/schema"; o monorepo usa o alias "@workspace/db".
Tambem adiciona o dry-run (--apply para gravar de verdade).

Rodar de ~/workspace:  python3 patch-set-chapeu-imports.py
Idempotente.
"""
import io, os, sys
CANDIDATOS = [
    "artifacts/api-server/src/scripts/set-chapeu.ts",
    "src/scripts/set-chapeu.ts",
]
F = next((os.path.normpath(c) for c in CANDIDATOS if os.path.exists(os.path.normpath(c))), None)
if F is None:
    sys.exit("set-chapeu.ts nao encontrado. Rode este patch de ~/workspace.")

s = io.open(F, encoding="utf-8").read()
if '@workspace/db' in s and '--apply' in s:
    print("JA APLICADO.")
    sys.exit()

NOVO = '''/**
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

async function main() {
  const rows = await db
    .select()
    .from(artTemplatesTable)
    .where(eq(artTemplatesTable.tipo, "convite-evento"));

  console.log(`\\n${rows.length} template(s) de convite-evento encontrado(s).`);
  console.log(APLICAR ? "MODO: aplicando alteracoes\\n" : "MODO: simulacao (use --apply para gravar)\\n");

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
    `\\n${alterados} a alterar | ${jaOk} ja ok` +
      (APLICAR ? "\\n✓ gravado no banco." : "\\n(nada foi gravado — rode com --apply)"),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Falhou:", err);
  process.exit(1);
});
'''
bp = F + ".bak-imports"
if not os.path.exists(bp):
    io.open(bp, "w", encoding="utf-8").write(s)
io.open(F, "w", encoding="utf-8").write(NOVO)
print("OK — imports corrigidos para @workspace/db + dry-run adicionado")
print("   arquivo:", F)
print("\nAgora:  cd artifacts/api-server && npx tsx src/scripts/set-chapeu.ts")
