import { db, solicitacoesTable, cartaoAprovacoesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "fs";

/**
 * Importação one-off: registros históricos da planilha de Cartões de Visita Físico para o Hub,
 * para que apareçam na página de Validação de Cartões junto com os pedidos novos.
 *
 * Por linha cria: 1 solicitação (tipo cartao-visita-fisico) + 1 linha de cartao_aprovacoes.
 * Escreve direto no banco — NÃO dispara o fluxo de submissão (sem ClickUp, sem geração de arte).
 *
 * Uso:
 *   pnpm tsx src/scripts/import-cartoes.ts                 # DRY-RUN (não escreve)
 *   pnpm tsx src/scripts/import-cartoes.ts --apply         # aplica
 *   pnpm tsx src/scripts/import-cartoes.ts --csv caminho/cartoes.csv
 *
 * Idempotente: cada linha recebe uma chave de importação; rodar de novo não duplica.
 */

// ============== CONFIG ==============
// E-mail de um usuário JÁ EXISTENTE no Hub a quem os registros importados serão atribuídos
// (campo de dono/auditoria; o nome do solicitante real é preservado em cartao_aprovacoes.nome).
const IMPORT_USER_EMAIL = "joao.sardeto@svninvest.com.br"; // <-- EDITE antes de rodar
const DEFAULT_CSV = "cartoes.csv";
const LEGACY_DATE = new Date("2024-01-01T12:00:00"); // created_at para linhas sem data

// ============== DE-PARA (travado com o cliente) ==============
const CONTRATO_MAP: Record<string, string> = {
  "SVN CAPITAL": "svn-capital",
  "BP": "svn-capital",
  "SVN INVESTIMENTOS": "svn-investimentos",
  "SVN": "svn-investimentos",
  "CONNECT": "svn-connect",
  "SVN CONNECT": "svn-connect",
  "": "",
};
const CUSTO_MAP: Record<string, string> = { "Interno": "interno", "Colaborador": "colaborador", "": "" };
const STATUS_MAP: Record<string, string> = {
  "Envio Assessor": "envio-assessor",
  "Envio gráfica": "envio-grafica",
  "Aguardando Contrato": "aguardando-contrato",
  "Arte Finalizada": "aguardando-validacao",
  "Liberado para design": "aguardando-validacao",
  "": "aguardando-validacao",
};
const ENVIO_MAP: Record<string, string> = {
  "Aracaju": "Aracaju", "Campo Grande": "Campo Grande", "Cascavel": "Cascavel", "Cuiabá": "Cuiabá",
  "Curitiba - Digital": "Curitiba - Digital", "Curitiba - Relacionamento": "Curitiba - Relacionamento",
  "Digital - Curitiba": "Curitiba - Digital", "Relacionamento - Curitiba": "Curitiba - Relacionamento",
  "Digital - Maringá": "Maringá - Digital", "Digital Maringa": "Maringá - Digital",
  "Maringá - Digital": "Maringá - Digital",
  "Maringá - Relacionamento": "Maringá - Relacionamento", "Maringá - Relacinamento": "Maringá - Relacionamento",
  "Relacionamento - Maringa": "Maringá - Relacionamento",
  "Digital - Sp": "São Paulo - Digital", "São Paulo - Digital": "São Paulo - Digital",
  "Relacionamento - Sp": "São Paulo - Relacionamento", "São Paulo - Relacionamento": "São Paulo - Relacionamento",
  "São Paulo": "São Paulo - Relacionamento",
  "Foz do Iguaçu": "Foz do Iguaçu", "Londrina": "Londrina", "Salvador": "Salvador", "Toledo": "Toledo",
  "": "",
};

// ============== Helpers ==============
function readRows(csvPath: string): Record<string, string>[] {
  const text = new TextDecoder("macintosh").decode(fs.readFileSync(csvPath)); // planilha exportada do Excel (Mac)
  const lines = text.split(/\r\n|\r|\n/).filter(l => l.trim() !== "");
  const header = lines[0].split(";").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(";");
    const row: Record<string, string> = {};
    header.forEach((h, i) => { if (h) row[h] = (cells[i] ?? "").trim(); });
    return row;
  });
}

function parseData(raw: string): { iso: Date | null; br: string } {
  // aceita "11-04-2024 18:12:14" (DD-MM-YYYY) e "9/2/25 9:45" (D/M/YY) — sempre dia primeiro
  const m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return { iso: null, br: "" };
  const [, d, mo, y, h = "12", mi = "00", se = "00"] = m;
  const year = +y < 100 ? 2000 + +y : +y;
  const dt = new Date(year, +mo - 1, +d, +h, +mi, +se);
  return { iso: dt, br: `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${year}` };
}

function mapOrFail(map: Record<string, string>, value: string, field: string, errors: string[]): string {
  if (value in map) return map[value];
  errors.push(`${field}: valor não mapeado → "${value}"`);
  return "";
}

const importKey = (nome: string, email: string, dataRaw: string) =>
  `${nome}|${email}|${dataRaw}`.toLowerCase();

// ============== Main ==============
async function run() {
  const apply = process.argv.includes("--apply");
  const csvIdx = process.argv.indexOf("--csv");
  const csvPath = csvIdx >= 0 ? process.argv[csvIdx + 1] : DEFAULT_CSV;

  console.log(apply ? "▶ MODO APPLY — vai escrever no banco.\n" : "▶ DRY-RUN — nada será escrito (use --apply).\n");

  if (!fs.existsSync(csvPath)) { console.error(`CSV não encontrado: ${csvPath}`); process.exit(1); }

  // 1) usuário de importação precisa existir (FK)
  const [u] = await db.select().from(usersTable).where(eq(usersTable.email, IMPORT_USER_EMAIL));
  if (!u) {
    console.error(`IMPORT_USER_EMAIL "${IMPORT_USER_EMAIL}" não existe na tabela de usuários.`);
    console.error(`Edite a constante no topo do script para um e-mail de usuário já existente no Hub.`);
    process.exit(1);
  }

  const rows = readRows(csvPath);
  console.log(`Linhas no CSV: ${rows.length}`);

  // 2) valida TODO o de-para antes de escrever nada (falha de propósito se houver valor novo)
  const errors: string[] = [];
  const prepared = rows.map((r, idx) => {
    const nome = r["Nome"] || "";
    const dataRaw = r["Data"] || "";
    const { iso, br } = parseData(dataRaw);
    return {
      idx: idx + 2, // linha no arquivo (1 = header)
      nome,
      whatsapp: r["WhatsApp"] || "",
      email: r["E-Mail"] || "",
      unidade: r["Unidade"] || "",
      contrato_social: mapOrFail(CONTRATO_MAP, r["Contrato Social"] || "", "Contrato Social", errors),
      envio_para: mapOrFail(ENVIO_MAP, r["Envio para"] || "", "Envio para", errors),
      custo: mapOrFail(CUSTO_MAP, r["Custo"] || "", "Custo", errors),
      status: mapOrFail(STATUS_MAP, r["Andamento"] || "", "Andamento", errors),
      created_at: iso ?? LEGACY_DATE,
      data_pedido: br,
      key: importKey(nome, r["E-Mail"] || "", dataRaw),
    };
  });

  if (errors.length) {
    console.error(`\n✗ ${errors.length} valor(es) não previsto(s) no de-para. NADA foi importado.`);
    [...new Set(errors)].forEach(e => console.error("   " + e));
    process.exit(1);
  }

  // 3) idempotência: pula linhas já importadas (por chave em dados._import_key)
  const existentes = await db.select().from(solicitacoesTable)
    .where(eq(solicitacoesTable.tipo_solicitacao, "cartao-visita-fisico"));
  const jaImportadas = new Set(
    existentes.map(s => (s.dados as any)?._import_key).filter(Boolean) as string[]
  );

  const aImportar = prepared.filter(p => !jaImportadas.has(p.key));
  const puladas = prepared.length - aImportar.length;

  console.log(`A importar: ${aImportar.length}  |  já importadas (puladas): ${puladas}\n`);
  if (!apply) {
    console.log("Amostra (5 primeiras a importar):");
    aImportar.slice(0, 5).forEach(p =>
      console.log(`  ${p.nome} | ${p.data_pedido || "(sem data)"} | ${p.envio_para || "-"} | ${p.status}`));
    console.log("\n(Rode com --apply para gravar.)");
    process.exit(0);
  }

  // 4) grava: solicitação + aprovação, por linha, em transação
  let ok = 0;
  for (const p of aImportar) {
    await db.transaction(async (tx) => {
      const [sol] = await tx.insert(solicitacoesTable).values({
        user_email: IMPORT_USER_EMAIL,
        tipo_solicitacao: "cartao-visita-fisico",
        dados: {
          nome: p.nome, whatsapp: p.whatsapp, email: p.email,
          unidade: p.unidade, contrato_social: p.contrato_social,
          _importado_planilha: true, _import_key: p.key,
        },
        status: "concluido",
        created_at: p.created_at,
      }).returning();

      await tx.insert(cartaoAprovacoesTable).values({
        solicitacao_id: sol.id,
        data_pedido: p.data_pedido || null,
        nome: p.nome || null,
        whatsapp: p.whatsapp || null,
        email: p.email || null,
        unidade: p.unidade || null,
        contrato_social: p.contrato_social || null,
        envio_para: p.envio_para || null,
        custo: p.custo || null,
        status: p.status,
        observacao: null,
      });
    });
    ok++;
  }
  console.log(`\n✓ Importadas ${ok} solicitação(ões) de cartão.`);
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Erro na importação:", err);
  process.exit(1);
});
