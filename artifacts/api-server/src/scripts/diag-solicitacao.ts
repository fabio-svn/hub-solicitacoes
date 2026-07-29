/**
 * Diagnóstico: mostra o estado real de uma solicitação no banco e o que o
 * endpoint /entrega retornaria — para descobrir por que o chat não abre.
 *
 * Uso (da raiz):
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/diag-solicitacao.ts SOLICITACAO_ID
 */
import { db, solicitacoesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extrairEntregaLinks } from "../routes/clickup";

const ID = parseInt(process.argv[2] || "", 10);

async function main() {
  if (isNaN(ID)) { console.error("Passe o ID da solicitação (número): ...diag-solicitacao.ts 123"); process.exit(1); }

  const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, ID));
  if (!sol) { console.error("Solicitação não encontrada."); process.exit(1); }

  console.log(`\n── Solicitação #${ID} ──`);
  console.log(`tipo:            ${sol.tipo_solicitacao}`);
  console.log(`status (Hub):    ${JSON.stringify(sol.status)}`);
  console.log(`clickup_task_id: ${sol.clickup_task_id}`);
  console.log(`entrega_links:   ${JSON.stringify(sol.entrega_links)}`);
  console.log("");

  // o que o /entrega faria: se o banco tem links, usa; senão busca no ClickUp
  const jaTem = Array.isArray(sol.entrega_links) && (sol.entrega_links as unknown[]).length > 0;
  if (jaTem) {
    console.log("→ /entrega usaria os links DO BANCO (caminho rápido). count:", (sol.entrega_links as unknown[]).length);
  } else {
    console.log("→ banco vazio; /entrega buscaria no ClickUp ao vivo...");
    if (sol.clickup_task_id) {
      const links = await extrairEntregaLinks(String(sol.clickup_task_id));
      console.log("  extrairEntregaLinks retornou:", JSON.stringify(links), "| count:", links.length);
    } else {
      console.log("  (sem clickup_task_id — retornaria [])");
    }
  }

  console.log("\n── veredito para o chat ──");
  const statusOk = sol.status === "em-aprovacao";
  console.log(`status === 'em-aprovacao'? ${statusOk ? "SIM" : "NÃO (é '" + sol.status + "')"}`);
  process.exit(0);
}
main().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
