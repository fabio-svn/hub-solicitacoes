#!/usr/bin/env node
/* ============================================================================
 * diagnostico-dashboard-clickup.cjs   (v2)
 *
 * Levantamento da base do ClickUp ANTES de construir o Dashboard de Gestao a
 * Vista. Responde:
 *
 *   1. ESTRUTURA   - espacos, pastas, listas e volume de cada um
 *   2. STATUS      - grafias reais por espaco, com contagem e tipo do ClickUp
 *   3. COBERTURA   - % de tarefas com prazo, com responsavel, e com os dois
 *   4. PESSOAS     - responsaveis distintos e volume de cada um
 *   5. SUBTAREFAS  - quantas maes tem filhas e se o responsavel diverge
 *   6. VOLUME      - abertas, vencidas, criadas e concluidas na janela
 *   7. QUALIDADE   - uma linha por quadro: o que falta preencher em cada um,
 *                    quem mais aparece nele e link direto para o ClickUp.
 *                    E a tabela de trabalho da limpeza.
 *
 * NOVIDADE DA v2 - dois cortes configuraveis:
 *
 *   REGISTRO (DIAG_STATUS_REGISTRO, default "backlog")
 *     Tarefas que existem para documentar, nao para executar. Tem responsavel
 *     mas intencionalmente nao tem prazo. Continuam visiveis no relatorio, mas
 *     saem da cobertura, das orfas, da carga e do volume de abertas. O total
 *     aparece sempre numa coluna propria, para que crescimento anormal do
 *     backlog nao passe despercebido.
 *
 *   LISTA EXCLUIDA (DIAG_LISTAS_FORA, default "repositorio")
 *     Quadros de arquivo puro. Saem inteiramente da leitura, como se nao
 *     existissem. Aceita id numerico da lista ou pedaco do nome.
 *
 * NAO escreve nada no ClickUp, nao toca no Postgres, nao cria tabela. So le a
 * API e gera relatorio no console + CSVs numa pasta local.
 *
 * Requisitos: Node 18+ (usa fetch nativo) e CLICKUP_API_TOKEN no ambiente
 * (o mesmo que o servidor do Hub usa).
 *
 * Uso:
 *   node diagnostico-dashboard-clickup.cjs
 *
 * Comparar os dois retratos:
 *   DIAG_STATUS_REGISTRO="" node diagnostico-dashboard-clickup.cjs   (sem corte)
 *   node diagnostico-dashboard-clickup.cjs                           (com corte)
 *
 * Variaveis opcionais:
 *   CLICKUP_TEAM_ID      - forca um workspace especifico (default: o primeiro)
 *   DIAG_DIAS            - janela de historico em dias (default: 90)
 *   DIAG_REQ_POR_MIN     - teto de requisicoes por minuto (default: 90)
 *   DIAG_SAIDA           - pasta de saida (default: ./diagnostico-saida)
 *   DIAG_ESPACOS         - ids de espaco separados por virgula (default: todos)
 *   DIAG_STATUS_REGISTRO - status tratados como registro (default: "backlog")
 *   DIAG_LISTAS_FORA     - listas fora da leitura (default: "repositorio")
 * ==========================================================================*/
'use strict';

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.CLICKUP_API_TOKEN;
if (!TOKEN) {
  console.error('ERRO: CLICKUP_API_TOKEN nao esta no ambiente.');
  console.error('No Replit ele ja existe (o servidor do Hub usa). Rode neste mesmo shell.');
  process.exit(2);
}

const API = 'https://api.clickup.com/api/v2';
const DIAS = parseInt(process.env.DIAG_DIAS || '90', 10);
const REQ_POR_MIN = parseInt(process.env.DIAG_REQ_POR_MIN || '90', 10);
const INTERVALO_MS = Math.ceil(60000 / Math.max(1, REQ_POR_MIN));
const SAIDA = process.env.DIAG_SAIDA || path.join(process.cwd(), 'diagnostico-saida');
const FILTRO_ESPACOS = (process.env.DIAG_ESPACOS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

// normaliza igual ao clickup-status.ts do Hub: minusculas, sem acento, trim
function normalizar(raw) {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const STATUS_REGISTRO = new Set(
  (process.env.DIAG_STATUS_REGISTRO === undefined ? 'backlog' : process.env.DIAG_STATUS_REGISTRO)
    .split(',').map(normalizar).filter(Boolean)
);

const LISTAS_FORA = (process.env.DIAG_LISTAS_FORA === undefined ? 'repositorio' : process.env.DIAG_LISTAS_FORA)
  .split(',').map(normalizar).filter(Boolean);

const AGORA = Date.now();
const CORTE_HISTORICO = AGORA - DIAS * 24 * 60 * 60 * 1000;
const CORTE_SEM_UPDATE = AGORA - 14 * 24 * 60 * 60 * 1000;
const MAX_PAGINAS = 200; // trava de seguranca: 200 x 100 = 20k tarefas por passada

/* -------------------------------------------------------------------------
 * HTTP com respeito ao rate limit
 * ---------------------------------------------------------------------- */

let ultimaChamada = 0;
let totalChamadas = 0;

function dormir(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function api(caminho, params) {
  const url = new URL(API + caminho);
  if (params) {
    for (const [k, v] of params) url.searchParams.append(k, String(v));
  }

  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    const espera = INTERVALO_MS - (Date.now() - ultimaChamada);
    if (espera > 0) await dormir(espera);
    ultimaChamada = Date.now();
    totalChamadas++;

    let r;
    try {
      r = await fetch(url, { headers: { Authorization: TOKEN } });
    } catch (err) {
      if (tentativa === 5) throw new Error(`falha de rede em ${caminho}: ${err.message}`);
      await dormir(2000 * tentativa);
      continue;
    }

    if (r.status === 429) {
      const retry = parseInt(r.headers.get('retry-after') || '0', 10);
      const pausa = (retry > 0 ? retry * 1000 : 5000 * tentativa);
      console.log(`    [rate limit] aguardando ${Math.round(pausa / 1000)}s...`);
      await dormir(pausa);
      continue;
    }

    if (!r.ok) {
      const corpo = await r.text().catch(() => '');
      throw new Error(`HTTP ${r.status} em ${caminho} :: ${corpo.slice(0, 300)}`);
    }

    return r.json();
  }
  throw new Error(`esgotadas as tentativas em ${caminho}`);
}

/* -------------------------------------------------------------------------
 * Coleta
 * ---------------------------------------------------------------------- */

async function descobrirTime() {
  if (process.env.CLICKUP_TEAM_ID) {
    return { id: process.env.CLICKUP_TEAM_ID, name: '(definido por env)' };
  }
  const j = await api('/team');
  const times = j.teams || [];
  if (!times.length) throw new Error('nenhum workspace visivel para este token');
  if (times.length > 1) {
    console.log('  Aviso: o token enxerga mais de um workspace. Usando o primeiro.');
    console.log('  Para escolher outro, defina CLICKUP_TEAM_ID. Disponiveis:');
    for (const t of times) console.log(`    ${t.id}  ${t.name}`);
  }
  return times[0];
}

async function coletarEstrutura(timeId) {
  const j = await api(`/team/${timeId}/space`, [['archived', 'false']]);
  let espacos = j.spaces || [];
  if (FILTRO_ESPACOS.length) {
    espacos = espacos.filter(e => FILTRO_ESPACOS.includes(String(e.id)));
  }

  for (const espaco of espacos) {
    espaco.listasPorId = new Map();

    const jf = await api(`/space/${espaco.id}/folder`, [['archived', 'false']]);
    espaco.pastas = jf.folders || [];
    for (const pasta of espaco.pastas) {
      for (const lista of (pasta.lists || [])) {
        espaco.listasPorId.set(String(lista.id), { lista, pasta: pasta.name });
      }
    }

    const jl = await api(`/space/${espaco.id}/list`, [['archived', 'false']]);
    for (const lista of (jl.lists || [])) {
      espaco.listasPorId.set(String(lista.id), { lista, pasta: '(sem pasta)' });
    }
  }

  return espacos;
}

async function coletarTarefasDoEspaco(timeId, espacoId) {
  const porId = new Map();

  // Passada A: tudo que esta aberto hoje, inclusive parado ha muito tempo.
  // Passada B: tudo que se mexeu na janela, inclusive fechado.
  const passadas = [
    { rotulo: 'abertas', params: [['include_closed', 'false']] },
    { rotulo: 'janela',  params: [['include_closed', 'true'], ['date_updated_gt', CORTE_HISTORICO]] },
  ];

  for (const passada of passadas) {
    for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
      const params = [
        ['page', pagina],
        ['space_ids[]', espacoId],
        ['subtasks', 'true'],
        ['order_by', 'created'],
        ...passada.params,
      ];
      const j = await api(`/team/${timeId}/task`, params);
      const lote = j.tasks || [];
      for (const t of lote) porId.set(String(t.id), t);
      if (j.last_page === true || lote.length < 100) break;
    }
  }

  return [...porId.values()];
}

/* -------------------------------------------------------------------------
 * Helpers de analise
 * ---------------------------------------------------------------------- */

const num = v => (v === null || v === undefined || v === '' ? null : Number(v));
const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : 0);
const fechada = t => ['closed', 'done'].includes(String(t.status && t.status.type));

// tarefa de registro: existe para documentar, nao para executar
const registro = t => STATUS_REGISTRO.has(normalizar(t.status && t.status.status));

// lista de arquivo puro: sai inteiramente da leitura
function listaFora(t) {
  if (!LISTAS_FORA.length) return false;
  const id = String((t.list && t.list.id) || '');
  const nome = normalizar(t.list && t.list.name);
  return LISTAS_FORA.some(alvo => alvo === id || (nome && nome.includes(alvo)));
}

// entra nas metricas: aberta, nao e registro
const contavel = t => !fechada(t) && !registro(t);

function nomeResponsavel(a) {
  return a.username || a.email || `id:${a.id}`;
}

function barra(percentual) {
  const cheio = Math.round(percentual / 5);
  return '#'.repeat(cheio) + '.'.repeat(20 - cheio);
}

/* -------------------------------------------------------------------------
 * CSV
 * ---------------------------------------------------------------------- */

function csvCampo(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function gravarCsv(arquivo, cabecalho, linhas) {
  const conteudo = '\ufeff'
    + cabecalho.join(';') + '\n'
    + linhas.map(l => l.map(csvCampo).join(';')).join('\n') + '\n';
  fs.writeFileSync(path.join(SAIDA, arquivo), conteudo, 'utf8');
}

function dataBr(ms) {
  const n = num(ms);
  if (!n) return '';
  const d = new Date(n);
  const p = x => String(x).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/* -------------------------------------------------------------------------
 * Main
 * ---------------------------------------------------------------------- */

(async () => {
  const t0 = Date.now();
  if (!fs.existsSync(SAIDA)) fs.mkdirSync(SAIDA, { recursive: true });

  console.log('');
  console.log('DIAGNOSTICO DA BASE DO CLICKUP - Dashboard de Gestao a Vista');
  console.log(`janela: ${DIAS} dias | teto: ${REQ_POR_MIN} req/min`);
  console.log(`status de registro: ${STATUS_REGISTRO.size ? [...STATUS_REGISTRO].join(', ') : '(nenhum)'}`);
  console.log(`listas fora da leitura: ${LISTAS_FORA.length ? LISTAS_FORA.join(', ') : '(nenhuma)'}`);
  console.log('='.repeat(78));

  const time = await descobrirTime();
  console.log(`\nWorkspace: ${time.name} (${time.id})`);

  console.log('\nLendo estrutura...');
  const espacos = await coletarEstrutura(time.id);
  console.log(`  ${espacos.length} espaco(s): ${espacos.map(e => e.name).join(', ')}`);

  const porEspaco = new Map();
  const listasIgnoradas = new Map();
  console.log('\nLendo tarefas (isso pode demorar alguns minutos)...');
  for (const espaco of espacos) {
    process.stdout.write(`  ${espaco.name}... `);
    const brutas = await coletarTarefasDoEspaco(time.id, espaco.id);
    const tarefas = [];
    let descartadas = 0;
    for (const t of brutas) {
      if (listaFora(t)) {
        descartadas++;
        const nome = `${espaco.name} / ${(t.list && t.list.name) || '?'}`;
        listasIgnoradas.set(nome, (listasIgnoradas.get(nome) || 0) + 1);
        continue;
      }
      tarefas.push(t);
    }
    porEspaco.set(String(espaco.id), tarefas);
    console.log(`${tarefas.length} tarefas${descartadas ? ` (${descartadas} fora por lista)` : ''}`);
  }

  const todas = [...porEspaco.values()].flat();

  if (listasIgnoradas.size) {
    console.log('\n  Listas fora da leitura:');
    for (const [nome, qtd] of listasIgnoradas) console.log(`    ${String(qtd).padStart(5)}  ${nome}`);
  }

  /* --- 1. ESTRUTURA ---------------------------------------------------- */
  const linhasEstrutura = [];
  for (const espaco of espacos) {
    const tarefas = porEspaco.get(String(espaco.id)) || [];
    const porLista = new Map();
    for (const t of tarefas) {
      const id = String((t.list && t.list.id) || 'sem-lista');
      if (!porLista.has(id)) porLista.set(id, []);
      porLista.get(id).push(t);
    }
    for (const [listaId, ts] of porLista) {
      const meta = espaco.listasPorId.get(listaId);
      linhasEstrutura.push([
        espaco.name,
        meta ? meta.pasta : '(desconhecida)',
        meta ? meta.lista.name : (ts[0] && ts[0].list ? ts[0].list.name : listaId),
        listaId,
        ts.filter(contavel).length,
        ts.filter(t => !fechada(t) && registro(t)).length,
        ts.length,
      ]);
    }
  }
  linhasEstrutura.sort((a, b) => b[6] - a[6]);
  gravarCsv('01-estrutura.csv',
    ['espaco', 'pasta', 'lista', 'lista_id', 'abertas', 'registros', 'total'], linhasEstrutura);

  console.log('\n' + '='.repeat(78));
  console.log('1. ESTRUTURA');
  console.log('='.repeat(78));
  for (const espaco of espacos) {
    const ts = porEspaco.get(String(espaco.id)) || [];
    const listas = new Set(ts.map(t => t.list && t.list.id).filter(Boolean));
    const reg = ts.filter(t => !fechada(t) && registro(t)).length;
    console.log(`  ${espaco.name.padEnd(24)} ${String(ts.filter(contavel).length).padStart(5)} abertas  ${String(reg).padStart(4)} registros  ${String(ts.length).padStart(6)} total  ${listas.size} listas`);
  }

  /* --- 2. STATUS ------------------------------------------------------- */
  const linhasStatus = [];
  console.log('\n' + '='.repeat(78));
  console.log('2. STATUS (grafias reais, por espaco)');
  console.log('='.repeat(78));
  for (const espaco of espacos) {
    const ts = porEspaco.get(String(espaco.id)) || [];
    const contagem = new Map();
    for (const t of ts) {
      const nome = (t.status && t.status.status) || '(sem status)';
      const tipo = (t.status && t.status.type) || '';
      const chave = nome + '||' + tipo;
      contagem.set(chave, (contagem.get(chave) || 0) + 1);
    }
    const declarados = new Set((espaco.statuses || []).map(s => s.status));
    const usados = new Set();

    console.log(`\n  ${espaco.name}`);
    const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
    for (const [chave, qtd] of ordenado) {
      const [nome, tipo] = chave.split('||');
      usados.add(nome);
      const marca = STATUS_REGISTRO.has(normalizar(nome)) ? '  <- registro' : '';
      console.log(`    ${String(qtd).padStart(5)}  ${nome.padEnd(30)} [${tipo}]${marca}`);
      linhasStatus.push([
        espaco.name, nome, tipo, qtd,
        declarados.has(nome) ? 'sim' : 'nao (so na lista)',
        STATUS_REGISTRO.has(normalizar(nome)) ? 'sim' : 'nao',
      ]);
    }
    const semUso = [...declarados].filter(s => !usados.has(s));
    if (semUso.length) {
      console.log(`    (declarados no espaco e sem nenhuma tarefa: ${semUso.join(', ')})`);
      for (const s of semUso) linhasStatus.push([espaco.name, s, '', 0, 'sim', 'nao']);
    }
  }
  gravarCsv('02-status.csv',
    ['espaco', 'status', 'tipo_clickup', 'tarefas', 'declarado_no_espaco', 'tratado_como_registro'],
    linhasStatus);

  /* --- 3. COBERTURA ---------------------------------------------------- */
  const linhasCobertura = [];
  console.log('\n' + '='.repeat(78));
  console.log('3. COBERTURA (abertas, sem os registros)');
  console.log('='.repeat(78));
  console.log('  espaco                   abertas  registros  c/prazo  c/resp  ambos  barra (ambos)');
  for (const espaco of espacos) {
    const ts = porEspaco.get(String(espaco.id)) || [];
    const abertas = ts.filter(contavel);
    const regs = ts.filter(t => !fechada(t) && registro(t)).length;
    const comPrazo = abertas.filter(t => num(t.due_date)).length;
    const comResp = abertas.filter(t => (t.assignees || []).length > 0).length;
    const ambos = abertas.filter(t => num(t.due_date) && (t.assignees || []).length > 0).length;
    const pAmbos = pct(ambos, abertas.length);
    console.log(`  ${espaco.name.padEnd(24)} ${String(abertas.length).padStart(6)}  ${String(regs).padStart(9)}  ${String(pct(comPrazo, abertas.length)).padStart(6)}%  ${String(pct(comResp, abertas.length)).padStart(5)}%  ${String(pAmbos).padStart(4)}%  ${barra(pAmbos)}`);
    linhasCobertura.push([
      espaco.name, abertas.length, regs,
      comPrazo, pct(comPrazo, abertas.length),
      comResp, pct(comResp, abertas.length),
      ambos, pAmbos,
      abertas.length - ambos,
    ]);
  }
  gravarCsv('03-cobertura.csv',
    ['espaco', 'abertas', 'registros', 'com_prazo', 'pct_prazo', 'com_responsavel', 'pct_responsavel',
     'com_ambos', 'pct_ambos', 'orfas'], linhasCobertura);

  /* --- 4. PESSOAS ------------------------------------------------------ */
  const pessoas = new Map();
  for (const espaco of espacos) {
    for (const t of (porEspaco.get(String(espaco.id)) || [])) {
      for (const a of (t.assignees || [])) {
        const id = String(a.id);
        if (!pessoas.has(id)) {
          pessoas.set(id, {
            id, nome: nomeResponsavel(a), email: a.email || '',
            abertas: 0, registros: 0, atrasadas: 0, espacos: new Set(),
          });
        }
        const p = pessoas.get(id);
        p.espacos.add(espaco.name);
        if (fechada(t)) continue;
        if (registro(t)) { p.registros++; continue; }
        p.abertas++;
        const venc = num(t.due_date);
        if (venc && venc < AGORA) p.atrasadas++;
      }
    }
  }
  const listaPessoas = [...pessoas.values()].sort((a, b) => b.abertas - a.abertas);
  gravarCsv('04-pessoas.csv',
    ['nome', 'email', 'clickup_user_id', 'abertas', 'registros', 'atrasadas', 'qtd_espacos', 'espacos'],
    listaPessoas.map(p => [p.nome, p.email, p.id, p.abertas, p.registros, p.atrasadas, p.espacos.size, [...p.espacos].join(' | ')]));

  console.log('\n' + '='.repeat(78));
  console.log(`4. PESSOAS (${listaPessoas.length} responsaveis distintos)`);
  console.log('='.repeat(78));
  for (const p of listaPessoas.slice(0, 30)) {
    console.log(`  ${String(p.abertas).padStart(4)} abertas  ${String(p.registros).padStart(4)} reg  ${String(p.atrasadas).padStart(3)} atrasadas  ${p.nome.padEnd(28)} ${p.espacos.size} espaco(s)`);
  }
  if (listaPessoas.length > 30) console.log(`  ... e mais ${listaPessoas.length - 30}. Lista completa em 04-pessoas.csv`);

  /* --- 5. SUBTAREFAS --------------------------------------------------- */
  const porIdGlobal = new Map(todas.map(t => [String(t.id), t]));
  const linhasSub = [];
  console.log('\n' + '='.repeat(78));
  console.log('5. SUBTAREFAS');
  console.log('='.repeat(78));
  for (const espaco of espacos) {
    const ts = porEspaco.get(String(espaco.id)) || [];
    const subs = ts.filter(t => t.parent);
    const maes = new Set(subs.map(t => String(t.parent)));
    let respDiferente = 0;
    let maeSemResp = 0;
    for (const s of subs) {
      const mae = porIdGlobal.get(String(s.parent));
      if (!mae) continue;
      const rMae = new Set((mae.assignees || []).map(a => String(a.id)));
      const rSub = (s.assignees || []).map(a => String(a.id));
      if (!rMae.size) { maeSemResp++; continue; }
      if (rSub.some(id => !rMae.has(id))) respDiferente++;
    }
    console.log(`  ${espaco.name.padEnd(24)} ${String(subs.length).padStart(5)} subtarefas em ${String(maes.size).padStart(4)} maes  |  ${respDiferente} com responsavel diferente da mae`);
    linhasSub.push([espaco.name, ts.length, subs.length, maes.size, respDiferente, maeSemResp]);
  }
  gravarCsv('05-subtarefas.csv',
    ['espaco', 'tarefas', 'subtarefas', 'maes_com_subtarefa', 'sub_com_resp_diferente', 'sub_com_mae_sem_resp'],
    linhasSub);

  /* --- 6. VOLUME ------------------------------------------------------- */
  const linhasVolume = [];
  console.log('\n' + '='.repeat(78));
  console.log(`6. VOLUME (janela de ${DIAS} dias, sem os registros)`);
  console.log('='.repeat(78));
  console.log('  espaco                   abertas  vencidas  criadas  concluidas  paradas 14d');
  let totAbertas = 0, totVencidas = 0, totCriadas = 0, totConcluidas = 0, totParadas = 0, totRegistros = 0;
  for (const espaco of espacos) {
    const ts = porEspaco.get(String(espaco.id)) || [];
    const abertas = ts.filter(contavel);
    const vencidas = abertas.filter(t => num(t.due_date) && num(t.due_date) < AGORA).length;
    const criadas = ts.filter(t => !registro(t) && num(t.date_created) && num(t.date_created) >= CORTE_HISTORICO).length;
    const concluidas = ts.filter(t => {
      const f = num(t.date_closed) || num(t.date_done);
      return f && f >= CORTE_HISTORICO;
    }).length;
    const paradas = abertas.filter(t => num(t.date_updated) && num(t.date_updated) < CORTE_SEM_UPDATE).length;
    const regs = ts.filter(t => !fechada(t) && registro(t)).length;

    console.log(`  ${espaco.name.padEnd(24)} ${String(abertas.length).padStart(6)}  ${String(vencidas).padStart(8)}  ${String(criadas).padStart(7)}  ${String(concluidas).padStart(10)}  ${String(paradas).padStart(11)}`);
    linhasVolume.push([espaco.name, abertas.length, regs, vencidas, criadas, concluidas, paradas]);
    totAbertas += abertas.length; totVencidas += vencidas; totCriadas += criadas;
    totConcluidas += concluidas; totParadas += paradas; totRegistros += regs;
  }
  console.log('  ' + '-'.repeat(74));
  console.log(`  ${'TOTAL'.padEnd(24)} ${String(totAbertas).padStart(6)}  ${String(totVencidas).padStart(8)}  ${String(totCriadas).padStart(7)}  ${String(totConcluidas).padStart(10)}  ${String(totParadas).padStart(11)}`);
  linhasVolume.push(['TOTAL', totAbertas, totRegistros, totVencidas, totCriadas, totConcluidas, totParadas]);
  gravarCsv('06-volume.csv',
    ['espaco', 'abertas', 'registros', 'vencidas_hoje', `criadas_${DIAS}d`, `concluidas_${DIAS}d`, 'abertas_sem_update_14d'],
    linhasVolume);

  /* --- 7. QUALIDADE POR QUADRO ----------------------------------------- */
  // Uma linha por lista, ordenada por quantidade de tarefas sem prazo.
  // E a tabela de trabalho da limpeza: mostra onde esta o buraco, quem esta
  // mais presente naquele quadro e o link para abrir direto no ClickUp.
  const linhasQualidade = [];
  for (const espaco of espacos) {
    const ts = porEspaco.get(String(espaco.id)) || [];
    const porLista = new Map();
    for (const t of ts) {
      const id = String((t.list && t.list.id) || 'sem-lista');
      if (!porLista.has(id)) porLista.set(id, []);
      porLista.get(id).push(t);
    }
    for (const [listaId, daLista] of porLista) {
      const meta = espaco.listasPorId.get(listaId);
      const nomeLista = meta
        ? meta.lista.name
        : ((daLista[0] && daLista[0].list && daLista[0].list.name) || listaId);
      const abertas = daLista.filter(contavel);
      if (!abertas.length) continue;

      const regs = daLista.filter(t => !fechada(t) && registro(t)).length;
      let completas = 0, faltaPrazo = 0, faltaResp = 0, faltamOsDois = 0;
      let atrasadas = 0, paradas = 0;
      const carga = new Map();

      for (const t of abertas) {
        const temPrazo = !!num(t.due_date);
        const temResp = (t.assignees || []).length > 0;
        if (temPrazo && temResp) completas++;
        else if (temResp) faltaPrazo++;
        else if (temPrazo) faltaResp++;
        else faltamOsDois++;
        if (temPrazo && num(t.due_date) < AGORA) atrasadas++;
        if (num(t.date_updated) && num(t.date_updated) < CORTE_SEM_UPDATE) paradas++;
        for (const a of (t.assignees || [])) {
          const n = nomeResponsavel(a);
          carga.set(n, (carga.get(n) || 0) + 1);
        }
      }

      const principal = [...carga.entries()].sort((a, b) => b[1] - a[1])[0];
      linhasQualidade.push([
        espaco.name, nomeLista, abertas.length, regs,
        completas, faltaPrazo, faltaResp, faltamOsDois,
        pct(completas, abertas.length), atrasadas, paradas,
        principal ? `${principal[0]} (${principal[1]})` : 'ninguem',
        `https://app.clickup.com/${time.id}/v/li/${listaId}`,
      ]);
    }
  }
  // ordena pelo tamanho do buraco de prazo (falta so prazo + faltam os dois)
  linhasQualidade.sort((a, b) => (b[5] + b[7]) - (a[5] + a[7]));

  gravarCsv('08-qualidade-por-quadro.csv',
    ['espaco', 'quadro', 'abertas', 'registros', 'completas', 'falta_so_prazo',
     'falta_so_responsavel', 'faltam_os_dois', 'pct_completas', 'atrasadas',
     'paradas_14d', 'quem_mais_aparece', 'link'],
    linhasQualidade);

  console.log('\n' + '='.repeat(78));
  console.log('7. QUALIDADE POR QUADRO (ordenado pelo buraco de prazo)');
  console.log('='.repeat(78));
  console.log('  quadro                              abert  compl  sPrazo  sResp  ambos  atras');
  for (const l of linhasQualidade.slice(0, 20)) {
    const rotulo = `${l[0]} / ${l[1]}`.slice(0, 34);
    console.log(`  ${rotulo.padEnd(34)} ${String(l[2]).padStart(5)}  ${String(l[4]).padStart(5)}  ${String(l[5]).padStart(6)}  ${String(l[6]).padStart(5)}  ${String(l[7]).padStart(5)}  ${String(l[9]).padStart(5)}`);
  }
  if (linhasQualidade.length > 20) {
    console.log(`  ... e mais ${linhasQualidade.length - 20} quadros. Lista completa em 08-qualidade-por-quadro.csv`);
  }

  /* --- 8. DUMP BRUTO --------------------------------------------------- */
  gravarCsv('09-tarefas.csv',
    ['id', 'espaco', 'lista', 'titulo', 'status', 'tipo_status', 'registro', 'responsaveis',
     'e_subtarefa', 'criada', 'vencimento', 'concluida', 'atualizada', 'url'],
    todas.map(t => [
      t.id,
      (espacos.find(e => String(e.id) === String(t.space && t.space.id)) || {}).name || '',
      (t.list && t.list.name) || '',
      t.name,
      (t.status && t.status.status) || '',
      (t.status && t.status.type) || '',
      registro(t) ? 'sim' : 'nao',
      (t.assignees || []).map(nomeResponsavel).join(' | '),
      t.parent ? 'sim' : 'nao',
      dataBr(t.date_created),
      dataBr(t.due_date),
      dataBr(t.date_closed || t.date_done),
      dataBr(t.date_updated),
      t.url || '',
    ]));

  /* --- FECHAMENTO ------------------------------------------------------ */
  const abertasGeral = todas.filter(contavel);
  const coberturaGeral = pct(
    abertasGeral.filter(t => num(t.due_date) && (t.assignees || []).length).length,
    abertasGeral.length
  );
  const coberturaSemCorte = pct(
    todas.filter(t => !fechada(t) && num(t.due_date) && (t.assignees || []).length).length,
    todas.filter(t => !fechada(t)).length
  );

  console.log('\n' + '='.repeat(78));
  console.log('RESUMO');
  console.log('='.repeat(78));
  console.log(`  tarefas lidas ............. ${todas.length}`);
  console.log(`  abertas (sem registros) ... ${totAbertas}`);
  console.log(`  registros ................. ${totRegistros}`);
  console.log(`  cobertura ajustada ........ ${coberturaGeral}%`);
  console.log(`  cobertura sem o corte ..... ${coberturaSemCorte}%`);
  console.log(`  responsaveis distintos .... ${listaPessoas.length}`);
  console.log(`  grafias de status ......... ${new Set(linhasStatus.map(l => l[1])).size}`);
  console.log(`  requisicoes a API ......... ${totalChamadas}`);
  console.log(`  tempo ..................... ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(`\n  CSVs em: ${SAIDA}`);
  console.log('');
  console.log('  Leitura sugerida:');
  console.log('   - a diferenca entre cobertura ajustada e sem o corte mostra quanto do');
  console.log('     problema de preenchimento era so registro mal classificado');
  console.log('   - registros crescendo mes a mes e sinal de que o status virou gaveta');
  console.log('   - responsaveis com 1 ou 2 tarefas provavelmente sao de fora do marketing');
  console.log('');
})().catch(err => {
  console.error('\nFALHOU:', err.message);
  process.exit(1);
});
