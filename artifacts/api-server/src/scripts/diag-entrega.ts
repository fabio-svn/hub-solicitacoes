/**
 * Diagnóstico: lista os custom fields de uma tarefa do ClickUp, destacando o
 * campo "Entrega". Revela se o id do campo bate com o hardcoded no Hub.
 *
 * Uso (da raiz, passando o ID da task — o número no fim da URL da tarefa no ClickUp):
 *   pnpm --filter @workspace/api-server exec tsx src/scripts/diag-entrega.ts TASK_ID
 */
const TASK_ID = process.argv[2];
const ESPERADO = "4485ee1d-253f-4599-a66a-aa674deddf41";

async function main() {
  if (!TASK_ID) { console.error("Passe o ID da task: ...diag-entrega.ts TASK_ID"); process.exit(1); }
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) { console.error("CLICKUP_API_TOKEN não definido."); process.exit(1); }

  const res = await fetch(`https://api.clickup.com/api/v2/task/${TASK_ID}`, {
    headers: { Authorization: token },
  });
  if (!res.ok) { console.error("Erro ao buscar task:", res.status, await res.text()); process.exit(1); }
  const data = await res.json() as any;

  console.log(`\nTask: ${data.name}`);
  console.log(`Lista: ${data.list?.name} (id ${data.list?.id})`);
  console.log(`Status: ${data.status?.status}\n`);
  console.log("Custom fields:");
  let achouEntrega = false;
  for (const f of (data.custom_fields || [])) {
    const temValor = f.value !== undefined && f.value !== null && f.value !== "";
    const ehEntrega = /entrega/i.test(f.name || "");
    const marca = f.id === ESPERADO ? "  <<< id ESPERADO pelo Hub" : (ehEntrega ? "  <<< parece ser o Entrega, MAS id DIFERENTE!" : "");
    console.log(`  ${ehEntrega ? "★" : "·"} "${f.name}"  id=${f.id}  ${temValor ? "[tem valor]" : "[vazio]"}${marca}`);
    if (ehEntrega) {
      achouEntrega = true;
      if (temValor) console.log(`      valor: ${JSON.stringify(f.value).slice(0, 120)}`);
    }
  }
  console.log("");
  if (!achouEntrega) console.log("✗ Nenhum campo com 'Entrega' no nome. O link foi posto em qual campo?");
}
main().catch(e => { console.error("ERRO:", e.message); process.exit(1); });
