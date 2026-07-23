/**
 * Normaliza dados de assessores que entraram em formatos diferentes ao longo do tempo.
 *
 * [D1] Codigo do assessor -> sempre "A" + digitos
 *        A98730  -> A98730 (ja ok)
 *        A.3945  -> A3945
 *        3248    -> A3248
 *        a 1234  -> A1234
 *      Hoje convivem tres formatos, o que atrapalha a busca por codigo.
 *
 * [D2] Nome em CAIXA ALTA -> Title Case
 *        "RENAN BERTINO ALGEBAILE LEITE" -> "Renan Bertino Algebaile Leite"
 *      So mexe em nomes 100% maiusculos. Nomes ja corretos — inclusive
 *      capitalizacoes intencionais como McCarthy ou D'Avila — ficam intactos.
 *      Preposicoes (de, da, do, das, dos, e) ficam minusculas.
 *
 * Atualiza os dois lugares onde o dado vive: a tabela assessor_publicacoes e o
 * JSONB de solicitacoes.dados — senao a tela de validacao e a de resumo passam
 * a divergir.
 *
 * Rodar de dentro de artifacts/api-server:
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx src/scripts/normalizar-assessores.ts          # simula
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx src/scripts/normalizar-assessores.ts --apply  # grava
 */
import { db, assessorPublicacoesTable, solicitacoesTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const APLICAR = process.argv.includes("--apply");

const TIPOS_ASSESSOR = ["pagina-assessores-dados", "pagina-assessores-atualizacao"];
const PREPOSICOES = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

function hostDoBanco(): string {
  const url = process.env.DATABASE_URL || "";
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}`;
  } catch {
    return url ? "(DATABASE_URL ilegivel)" : "(DATABASE_URL nao definida)";
  }
}

/** [D1] "A.3945" | "3248" | "a 1234" -> "A3945" | "A3248" | "A1234" */
/* interno */ function normalizarCodigo(bruto: unknown): string | null {
  const s = String(bruto ?? "").trim();
  if (!s) return null;
  const digitos = s.replace(/\D/g, "");
  if (!digitos) return null;            // sem numero nenhum: nao inventa
  return "A" + digitos;
}

/** [D2] Title Case pt-BR — so age em nomes 100% maiusculos. */
/* interno */ function normalizarNome(bruto: unknown): string | null {
  const s = String(bruto ?? "").trim().replace(/\s+/g, " ");
  if (!s) return null;
  const temMinuscula = /[a-záàâãéêíóôõúüç]/.test(s);
  if (temMinuscula) return null;        // ja tem caixa mista: nao mexe
  if (!/[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ]{2,}/.test(s)) return null;

  return s
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((palavra, i) => {
      if (i > 0 && PREPOSICOES.has(palavra)) return palavra;
      // trata hifen e apostrofo: "jean-pierre" / "d'avila"
      return palavra.replace(/(^|[-'])([\p{L}])/gu, (_m, sep, ch) => sep + ch.toLocaleUpperCase("pt-BR"));
    })
    .join(" ");
}

async function main() {
  console.log(`\nBanco: ${hostDoBanco()}`);
  console.log(APLICAR ? "Modo: APLICAR (grava)\n" : "Modo: simulacao — nada sera gravado (use --apply)\n");

  // ── assessor_publicacoes ─────────────────────────────────────────────
  const pubs = await db.select({
    id: assessorPublicacoesTable.id,
    solicitacao_id: assessorPublicacoesTable.solicitacao_id,
    nome: assessorPublicacoesTable.nome,
    codigo: assessorPublicacoesTable.codigo_assessor,
  }).from(assessorPublicacoesTable);

  let mudancasPub = 0;
  console.log("── assessor_publicacoes ──");
  for (const p of pubs) {
    const codNovo = normalizarCodigo(p.codigo);
    const nomeNovo = normalizarNome(p.nome);
    const mudaCod = codNovo && codNovo !== (p.codigo || "").trim();
    const mudaNome = nomeNovo && nomeNovo !== (p.nome || "").trim();
    if (!mudaCod && !mudaNome) continue;

    mudancasPub++;
    const partes: string[] = [];
    if (mudaCod) partes.push(`codigo: ${JSON.stringify(p.codigo)} -> ${JSON.stringify(codNovo)}`);
    if (mudaNome) partes.push(`nome: ${JSON.stringify(p.nome)} -> ${JSON.stringify(nomeNovo)}`);
    console.log(`  #${p.solicitacao_id}  ${partes.join("  |  ")}`);

    if (APLICAR) {
      const set: Record<string, string> = {};
      if (mudaCod) set.codigo_assessor = codNovo!;
      if (mudaNome) set.nome = nomeNovo!;
      await db.update(assessorPublicacoesTable).set(set as any)
        .where(eq(assessorPublicacoesTable.id, p.id));
    }
  }
  if (mudancasPub === 0) console.log("  (nada a normalizar)");

  // ── solicitacoes.dados (JSONB) ───────────────────────────────────────
  const sols = await db.select({
    id: solicitacoesTable.id,
    dados: solicitacoesTable.dados,
  }).from(solicitacoesTable)
    .where(inArray(solicitacoesTable.tipo_solicitacao, TIPOS_ASSESSOR));

  let mudancasSol = 0;
  console.log("\n── solicitacoes.dados ──");
  for (const s of sols) {
    const d: any = s.dados || {};
    const novo: any = { ...d };
    const partes: string[] = [];

    const codNovo = normalizarCodigo(d.codigo_assessor);
    if (codNovo && codNovo !== String(d.codigo_assessor || "").trim()) {
      partes.push(`codigo_assessor: ${JSON.stringify(d.codigo_assessor)} -> ${JSON.stringify(codNovo)}`);
      novo.codigo_assessor = codNovo;
    }
    for (const campo of ["nome_completo", "nome"]) {
      const nomeNovo = normalizarNome(d[campo]);
      if (nomeNovo && nomeNovo !== String(d[campo] || "").trim()) {
        partes.push(`${campo}: ${JSON.stringify(d[campo])} -> ${JSON.stringify(nomeNovo)}`);
        novo[campo] = nomeNovo;
      }
    }
    if (partes.length === 0) continue;

    mudancasSol++;
    console.log(`  #${s.id}  ${partes.join("  |  ")}`);
    if (APLICAR) {
      await db.update(solicitacoesTable).set({ dados: novo, updated_at: new Date() })
        .where(eq(solicitacoesTable.id, s.id));
    }
  }
  if (mudancasSol === 0) console.log("  (nada a normalizar)");

  console.log(`\nResumo: ${mudancasPub} linha(s) em assessor_publicacoes, ${mudancasSol} em solicitacoes.`);
  if (!APLICAR && (mudancasPub || mudancasSol)) {
    console.log("Rode de novo com --apply para gravar.");
  }
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
