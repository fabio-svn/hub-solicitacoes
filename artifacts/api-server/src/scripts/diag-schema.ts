/**
 * Diagnóstico de schema: lista quais colunas o banco TEM em cada tabela-chave,
 * para comparar com o que o código espera. Roda contra dev ou prod.
 *
 * Uso:
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/diag-schema.ts            # dev
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" pnpm --filter @workspace/api-server exec tsx src/scripts/diag-schema.ts   # prod
 */
import { pool } from "@workspace/db";

// o que o código espera em cada tabela (colunas que já apareceram em erros)
const ESPERADO: Record<string, string[]> = {
  solicitacoes: [
    "id", "user_email", "tipo_solicitacao", "subtipo", "maturidade", "dados",
    "clickup_task_id", "titulo", "clickup_url", "avaliacao", "entrega_links",
    "status", "responsavel", "prazo", "prazo_anterior", "prazo_motivo",
    "prazo_alterado_em", "erro_geracao", "notifications_sent", "created_at", "updated_at",
  ],
  tombamentos: [
    "id", "nome", "marca", "status", "linhas", "assinaturas_zip_url",
    "cartoes_zip_url", "fotos_zip_key", "planilha_key", "planilha_nome",
    "descricao", "solicitacao_id", "expires_at", "created_by", "created_at", "updated_at",
  ],
  users: [
    "id", "email", "name", "role", "telefone", "clickup_user_id", "last_login", "created_at",
  ],
};

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const host = url ? (url.split("@")[1] ?? "").split("/")[0] : "(vazia)";
  console.log(`\nBanco: ${host}\n`);

  for (const [tabela, esperadas] of Object.entries(ESPERADO)) {
    const { rows } = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = $1",
      [tabela]
    );
    const existentes = new Set(rows.map((r: any) => r.column_name));
    const faltando = esperadas.filter((c) => !existentes.has(c));
    if (faltando.length === 0) {
      console.log(`✓ ${tabela}: todas as ${esperadas.length} colunas esperadas existem`);
    } else {
      console.log(`✗ ${tabela}: FALTAM ${faltando.length} coluna(s) -> ${faltando.join(", ")}`);
    }
  }
  console.log("");
  await pool.end();
}
main().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
