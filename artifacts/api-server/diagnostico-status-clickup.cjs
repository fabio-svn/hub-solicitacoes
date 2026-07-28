#!/usr/bin/env node
/* ============================================================================
 * diagnostico-status-clickup.cjs
 *
 * Compara os status que EXISTEM nas listas do ClickUp hoje com os que o mapa do
 * Hub (src/config/clickup-status.ts) reconhece. Aponta:
 *   - status do ClickUp que o Hub NAO entende (viram null -> solicitacao trava
 *     no status anterior, em silencio)
 *   - grafias do mapa que nao existem em nenhuma lista (mapa "sujo", inofensivo)
 *
 * NAO altera nada. So le a API do ClickUp e o arquivo de mapa. Precisa do
 * CLICKUP_API_TOKEN no ambiente (o mesmo que o servidor usa).
 *
 * Uso (a partir de artifacts/api-server/, com o token no ambiente do Replit):
 *   node diagnostico-status-clickup.cjs
 * ==========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.CLICKUP_API_TOKEN;
if (!TOKEN) {
  console.error('ERRO: CLICKUP_API_TOKEN nao esta no ambiente.');
  console.error('No Replit ele ja existe (o servidor usa). Rode este script no mesmo shell.');
  process.exit(2);
}

// as 4 listas (mesmos defaults do clickup.ts; se usar env, respeita)
const LISTAS = {
  eventos:    process.env.CLICKUP_LIST_EVENTOS    || '901303299333',
  geral:      process.env.CLICKUP_LIST_GERAL      || '901300673533',
  brindes:    process.env.CLICKUP_LIST_BRINDES    || '900100469662',
  patrocinio: process.env.CLICKUP_LIST_PATROCINIO || '901324638951',
};

// normaliza igual ao clickup-status.ts (minusculas, sem acento, trim)
function normalizeStatusKey(raw) {
  return raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// le o mapa: chaves = grafias do ClickUp que o Hub entende (lado esquerdo)
function lerMapa() {
  const p = path.join(__dirname, 'src/config/clickup-status.ts');
  const t = fs.readFileSync(p, 'utf8');
  const m = t.match(/CLICKUP_STATUS_MAP[^{]*\{([\s\S]*?)\};/);
  const pares = [...m[1].matchAll(/"([^"]+)":\s*"([^"]+)"/g)];
  const chaves = new Set(pares.map(x => normalizeStatusKey(x[1])));   // grafias reconhecidas
  const usadas = new Set();                                           // quais foram vistas no ClickUp
  return { chaves, usadas };
}

async function statusDaLista(listId) {
  const r = await fetch(`https://api.clickup.com/api/v2/list/${listId}`, {
    headers: { Authorization: TOKEN },
  });
  if (!r.ok) return { erro: `HTTP ${r.status}` };
  const j = await r.json();
  return { statuses: (j.statuses || []).map(s => s.status) };
}

(async () => {
  const { chaves } = lerMapa();
  console.log('Diagnostico de status: ClickUp x mapa do Hub\n');
  console.log(`  mapa reconhece ${chaves.size} grafias\n`);

  const naoReconhecidos = new Map(); // status cru -> listas onde aparece
  const vistosNormalizados = new Set();

  for (const [nome, id] of Object.entries(LISTAS)) {
    const res = await statusDaLista(id);
    if (res.erro) { console.log(`  [${nome}] ERRO ao ler lista ${id}: ${res.erro}`); continue; }
    console.log(`  [${nome}] ${res.statuses.length} status: ${res.statuses.join(', ')}`);
    for (const s of res.statuses) {
      const norm = normalizeStatusKey(s);
      vistosNormalizados.add(norm);
      if (!chaves.has(norm)) {
        if (!naoReconhecidos.has(s)) naoReconhecidos.set(s, []);
        naoReconhecidos.get(s).push(nome);
      }
    }
  }

  console.log('\n' + '='.repeat(68));
  if (naoReconhecidos.size === 0) {
    console.log('\u2713 TODOS os status do ClickUp sao reconhecidos pelo mapa do Hub.');
  } else {
    console.log(`\u2717 ${naoReconhecidos.size} status do ClickUp NAO estao no mapa do Hub:`);
    console.log('   (uma solicitacao nesses status trava no status anterior, em silencio)\n');
    for (const [s, listas] of naoReconhecidos) {
      console.log(`     "${s}"  — aparece em: ${listas.join(', ')}`);
    }
    console.log('\n   Para corrigir: adicione cada um ao CLICKUP_STATUS_MAP em');
    console.log('   src/config/clickup-status.ts, apontando para o status interno certo.');
  }

  // grafias do mapa que nao existem em nenhuma lista (sujeira inofensiva)
  const orfas = [...chaves].filter(c => !vistosNormalizados.has(c));
  if (orfas.length) {
    console.log('\n  (informativo) grafias no mapa sem status correspondente hoje:');
    console.log('   ' + orfas.join(', '));
    console.log('   — inofensivas; podem ser de listas antigas ou grafias preventivas.');
  }
})();
