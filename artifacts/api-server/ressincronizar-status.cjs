#!/usr/bin/env node
/* ============================================================================
 * ressincronizar-status.cjs
 *
 * Corrige retroativamente o status das solicitacoes no banco do Hub.
 *
 * POR QUE NAO DA PARA FAZER SO COM SQL: o banco guardou o RESULTADO do
 * mapeamento, nao a origem. Uma linha em "cotacao-aprovacao" pode ter vindo de
 * "Orçamento" ou de "Aprovação"; uma em "em-producao" pode ter vindo de "Em
 * andamento", "Em produção" ou "Fazendo". So o ClickUp sabe qual e qual.
 *
 * O QUE FAZ: para cada solicitacao com clickup_task_id, le o status atual da
 * task no ClickUp, aplica o mapa de src/config/clickup-status.ts (a mesma fonte
 * que o servidor usa, lida do arquivo — nao ha copia do mapa aqui dentro) e
 * compara com o que esta gravado. Mostra as divergencias e, com --aplicar,
 * corrige.
 *
 * NAO dispara e-mail nem notificacao: escreve direto no banco, de proposito.
 * Ninguem recebe uma enxurrada de avisos por uma correcao de dados.
 *
 * SEGURANCA:
 *   - dry-run por padrao; so grava com --aplicar
 *   - gera um arquivo rollback-<timestamp>.sql com os valores anteriores
 *   - nunca toca em solicitacao cuja task sumiu do ClickUp ou cujo status o
 *     mapa nao reconhece (essas aparecem no relatorio para voce olhar)
 *
 * REQUISITOS: CLICKUP_API_TOKEN e DATABASE_URL no ambiente, e o pacote pg
 * (ja e dependencia de @workspace/db).
 *
 * Uso, a partir de artifacts/api-server/:
 *
 *   # simulacao contra producao (Railway expoe DATABASE_PUBLIC_URL)
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" node ressincronizar-status.cjs
 *
 *   # aplicando
 *   DATABASE_URL="$DATABASE_PUBLIC_URL" node ressincronizar-status.cjs --aplicar
 *
 * Opcoes:
 *   --aplicar        grava as mudancas (sem isso, so mostra)
 *   --todas          inclui concluidas e canceladas (padrao: so as abertas)
 *   --limite N       processa no maximo N solicitacoes
 *   --id N           processa so a solicitacao N (bom para testar)
 * ==========================================================================*/
'use strict';

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.CLICKUP_API_TOKEN;
const DB_URL = process.env.DATABASE_URL;

if (!TOKEN)  { console.error('ERRO: CLICKUP_API_TOKEN ausente no ambiente.'); process.exit(2); }
if (!DB_URL) { console.error('ERRO: DATABASE_URL ausente no ambiente.');      process.exit(2); }

let Client;
try { ({ Client } = require('pg')); }
catch { console.error('ERRO: pacote pg nao encontrado. Rode de dentro do projeto.'); process.exit(2); }

const APLICAR = process.argv.includes('--aplicar');
const TODAS   = process.argv.includes('--todas');
const argVal  = (nome) => { const i = process.argv.indexOf(nome); return i > -1 ? process.argv[i + 1] : null; };
const LIMITE  = parseInt(argVal('--limite') || '0', 10);
const SO_ID   = parseInt(argVal('--id') || '0', 10);

const INTERVALO_MS = 700; // ~85 req/min

// status que consideramos finais: nao vale gastar chamada com eles por padrao
const FINAIS = ['concluido', 'cancelado', 'publicado', 'reprovado', 'envio-assessor'];

/* ------------------------------------------------------------------ mapa */

function normalizar(raw) {
  return String(raw || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function lerMapa() {
  const p = path.join(__dirname, 'src/config/clickup-status.ts');
  if (!fs.existsSync(p)) {
    console.error(`ERRO: ${p} nao encontrado. Rode a partir de artifacts/api-server/.`);
    process.exit(2);
  }
  const t = fs.readFileSync(p, 'utf8');
  const bloco = t.match(/CLICKUP_STATUS_MAP[^{]*\{([\s\S]*?)\};/);
  if (!bloco) { console.error('ERRO: nao consegui ler o CLICKUP_STATUS_MAP.'); process.exit(2); }
  const mapa = {};
  for (const [, de, para] of bloco[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)) mapa[normalizar(de)] = para;
  return mapa;
}

/* -------------------------------------------------------------- clickup */

let ultima = 0;
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function statusDaTask(taskId) {
  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const espera = INTERVALO_MS - (Date.now() - ultima);
    if (espera > 0) await dormir(espera);
    ultima = Date.now();

    let r;
    try { r = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, { headers: { Authorization: TOKEN } }); }
    catch { await dormir(2000 * tentativa); continue; }

    if (r.status === 429) {
      const ra = parseInt(r.headers.get('retry-after') || '0', 10);
      await dormir(ra > 0 ? ra * 1000 : 5000 * tentativa);
      continue;
    }
    if (r.status === 404 || r.status === 401) return { erro: `HTTP ${r.status}` };
    if (!r.ok) return { erro: `HTTP ${r.status}` };

    const j = await r.json().catch(() => ({}));
    return { status: (j.status && j.status.status) || null };
  }
  return { erro: 'sem resposta' };
}

/* ----------------------------------------------------------------- main */

(async () => {
  const mapa = lerMapa();
  const cli = new Client({
    connectionString: DB_URL,
    ssl: /localhost|127\.0\.0\.1/.test(DB_URL) ? false : { rejectUnauthorized: false },
  });
  await cli.connect();

  let sql = `SELECT id, tipo_solicitacao, titulo, status, clickup_task_id
             FROM solicitacoes WHERE clickup_task_id IS NOT NULL AND clickup_task_id <> ''`;
  const params = [];
  if (SO_ID) { params.push(SO_ID); sql += ` AND id = $${params.length}`; }
  else if (!TODAS) { params.push(FINAIS); sql += ` AND status <> ALL($${params.length})`; }
  sql += ' ORDER BY id DESC';
  if (LIMITE > 0) sql += ` LIMIT ${LIMITE}`;

  const { rows } = await cli.query(sql, params);

  console.log('');
  console.log('RESSINCRONIZACAO DE STATUS' + (APLICAR ? '' : '  (simulacao — nada sera gravado)'));
  console.log(`banco: ${DB_URL.replace(/:\/\/[^@]*@/, '://***@')}`);
  console.log(`escopo: ${SO_ID ? 'solicitacao ' + SO_ID : TODAS ? 'todas' : 'apenas abertas'}  |  ${rows.length} registro(s)`);
  console.log('='.repeat(96));

  const divergentes = [], desconhecidos = [], semTask = [];

  for (const r of rows) {
    const res = await statusDaTask(r.clickup_task_id);
    if (res.erro) { semTask.push({ ...r, motivo: res.erro }); continue; }
    if (!res.status) { semTask.push({ ...r, motivo: 'task sem status' }); continue; }

    const alvo = mapa[normalizar(res.status)];
    if (!alvo) { desconhecidos.push({ ...r, bruto: res.status }); continue; }
    if (alvo !== r.status) divergentes.push({ ...r, bruto: res.status, novo: alvo });
  }

  if (divergentes.length) {
    console.log('\nDIVERGENTES (banco -> ClickUp):\n');
    console.log('    id  tipo                  status no banco        status correto        (ClickUp)');
    for (const d of divergentes) {
      console.log(`  ${String(d.id).padStart(4)}  ${String(d.tipo_solicitacao).slice(0, 20).padEnd(20)}  ${String(d.status).padEnd(21)} ${String(d.novo).padEnd(21)} ${d.bruto}`);
    }
  } else {
    console.log('\nNenhuma divergencia. O banco esta igual ao ClickUp.');
  }

  if (desconhecidos.length) {
    console.log('\nSTATUS NAO RECONHECIDO pelo mapa (nao serao alterados):\n');
    for (const d of desconhecidos) console.log(`  ${String(d.id).padStart(4)}  "${d.bruto}"  (${d.tipo_solicitacao})`);
    console.log('  -> adicione essas grafias ao CLICKUP_STATUS_MAP e rode de novo.');
  }

  if (semTask.length) {
    console.log('\nTASK INACESSIVEL no ClickUp (nao serao alteradas):\n');
    for (const d of semTask) console.log(`  ${String(d.id).padStart(4)}  ${d.clickup_task_id}  ${d.motivo}`);
  }

  if (divergentes.length && APLICAR) {
    const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
    const arquivoRollback = path.join(__dirname, `rollback-status-${carimbo}.sql`);
    fs.writeFileSync(arquivoRollback,
      '-- Desfaz a ressincronizacao. Rode no mesmo banco se precisar voltar.\n' +
      divergentes.map(d => `UPDATE solicitacoes SET status = '${d.status}' WHERE id = ${d.id};`).join('\n') + '\n',
      'utf8');

    await cli.query('BEGIN');
    try {
      for (const d of divergentes) {
        await cli.query('UPDATE solicitacoes SET status = $1, updated_at = NOW() WHERE id = $2', [d.novo, d.id]);
      }
      await cli.query('COMMIT');
      console.log(`\n${divergentes.length} solicitacao(oes) corrigida(s).`);
      console.log(`Rollback salvo em: ${arquivoRollback}`);
    } catch (err) {
      await cli.query('ROLLBACK');
      console.error('\nFALHOU, nada foi gravado:', err.message);
    }
  } else if (divergentes.length) {
    console.log(`\n${divergentes.length} divergencia(s). Rode de novo com --aplicar para corrigir.`);
  }

  console.log('');
  await cli.end();
})().catch(err => { console.error('\nFALHOU:', err.message); process.exit(1); });
