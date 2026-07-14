#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Adiciona diagnostico de banco ao set-chapeu.ts:
  - mostra em QUAL host/banco ele conectou (sem vazar a senha)
  - conta TODOS os art_templates (nao so convite-evento)
  - se nao achar nenhum convite-evento, avisa que provavelmente e o banco errado
    e ABORTA antes de gravar

Motivo: rodou, conectou, e achou 0 templates -> quase certamente e o banco de dev.
Melhor o script dizer isso na cara do que "gravar" no vazio.

Rodar de ~/workspace. Idempotente.
"""
import io, os, sys
CANDIDATOS = ["artifacts/api-server/src/scripts/set-chapeu.ts","src/scripts/set-chapeu.ts"]
F = next((os.path.normpath(c) for c in CANDIDATOS if os.path.exists(os.path.normpath(c))), None)
if F is None: sys.exit("set-chapeu.ts nao encontrado. Rode de ~/workspace.")
s = io.open(F, encoding="utf-8").read()
if "Banco:" in s:
    print("JA APLICADO."); sys.exit()

OLD = """async function main() {
  const rows = await db
    .select()
    .from(artTemplatesTable)
    .where(eq(artTemplatesTable.tipo, "convite-evento"));"""
NEW = """function hostDoBanco(): string {
  const url = process.env.DATABASE_URL || "";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`; // sem usuario/senha
  } catch {
    return url ? "(DATABASE_URL ilegivel)" : "(DATABASE_URL nao definida)";
  }
}

async function main() {
  console.log(`\\nBanco: ${hostDoBanco()}`);

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
      "\\n✗ Nenhum template 'convite-evento' aqui.\\n" +
        "  Este provavelmente NAO e o banco de producao.\\n" +
        "  Rode apontando para a base certa, por exemplo:\\n" +
        '    DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx src/scripts/set-chapeu.ts\\n' +
        "  ou:  railway run npx tsx src/scripts/set-chapeu.ts\\n",
    );
    process.exit(1);
  }"""
if s.count(OLD) != 1:
    sys.exit("ABORTADO: ancora do main() %d vez(es)" % s.count(OLD))
s = s.replace(OLD, NEW, 1)

# a contagem antiga ficou redundante — ajusta a linha de resumo
s = s.replace(
    'console.log(`\\n${rows.length} template(s) de convite-evento encontrado(s).`);',
    'console.log(`\\n${rows.length} template(s) de convite-evento.`);'
)
bp = F + ".bak-db"
if not os.path.exists(bp): io.open(bp, "w", encoding="utf-8").write(io.open(F, encoding="utf-8").read())
io.open(F, "w", encoding="utf-8").write(s)
print("OK — o script agora mostra o banco e aborta se estiver no lugar errado.")
