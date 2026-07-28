#!/usr/bin/env node
/* ============================================================================
 * check-prazo.cjs — TESTES DE PARIDADE FRONT x BACK
 *
 * Verifica coisas que existem em dois lugares (front e back) e que precisam
 * concordar. Hoje concordam; este teste garante que continuem concordando e
 * FALHA (exit 1) antes do deploy se algum lado for alterado sem o outro.
 *
 * (A) PRAZO — a logica de dias uteis / proxima quarta esta escrita em:
 *       - public/prazo.js        (JS, roda no navegador)
 *       - src/lib/holidays.ts    (TS, roda no servidor / define o prazo real)
 *     Roda as DUAS implementacoes reais sobre datas-armadilha (vespera de
 *     feriado, feriado no fim de semana, feriado movel, virada de ano).
 *     ESCOPO: cobre a LOGICA duplicada. NAO cobre a definicao dos feriados —
 *     essa so existe no back e e servida ao front via /api/prazo/config, entao
 *     nao ha duas copias para divergir.
 *
 * (B) TIPOS DE AUTOMACAO — a fonte unica e src/config/tipos.ts, e o front ja
 *     recebe a lista via /api/config. Mas public/config.js mantem uma copia
 *     HARDCODED como fallback (para antes da API responder). Este teste garante
 *     que esse fallback nao fique defasado em relacao a fonte.
 *
 * Nao reescreve nada: extrai o codigo/as listas dos proprios arquivos, para
 * testar exatamente o que roda em producao. Sem dependencias externas (nao usa
 * esbuild/tsc): remove os tipos do holidays.ts internamente.
 *
 * Uso: node check-prazo.cjs        (a partir de artifacts/api-server/)
 * Saida: "PARIDADE OK" e exit 0, ou lista de divergencias e exit 1.
 * ==========================================================================*/
'use strict';
const fs = require('fs');
const path = require('path');

// Resolve os arquivos a partir da localizacao DESTE script (nao do cwd), para
// rodar tanto de dentro de api-server/ quanto da raiz do repo (como o check.sh).
const BASE = __dirname; // .../artifacts/api-server
const PRAZO_JS = path.join(BASE, 'public/prazo.js');
const HOLIDAYS_TS = path.join(BASE, 'src/lib/holidays.ts');

for (const p of [PRAZO_JS, HOLIDAYS_TS]) {
  if (!fs.existsSync(p)) {
    console.error('ERRO: nao encontrei ' + p);
    console.error('Este script espera estar em artifacts/api-server/ junto do public/ e do src/.');
    process.exit(2);
  }
}

// ── helpers de extracao: pega o corpo de uma funcao pelo nome, do arquivo ──
function extraiFuncao(codigo, nome) {
  const re = new RegExp('function\\s+' + nome + '\\s*\\([^)]*\\)[^{]*\\{');
  const m = re.exec(codigo);
  if (!m) throw new Error('funcao ' + nome + ' nao encontrada');
  let i = m.index + m[0].length, d = 1, j = i;
  while (j < codigo.length && d > 0) {
    if (codigo[j] === '{') d++;
    else if (codigo[j] === '}') d--;
    j++;
  }
  return { assinatura: m[0], corpo: codigo.slice(i, j - 1) };
}

const ymd = (dt) =>
  dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');

// ── FRONT: carrega as funcoes reais do prazo.js num sandbox ──
function carregarFront(feriadosSet) {
  const js = fs.readFileSync(PRAZO_JS, 'utf8');
  const isDiaUtil = extraiFuncao(js, 'isDiaUtil');
  const addBiz = extraiFuncao(js, 'addBusinessDays');
  const proxQ = extraiFuncao(js, 'proximaQuarta');
  const ctx = {
    FERIADOS: feriadosSet,
    ymd,
    isFeriado: (d) => feriadosSet.has(ymd(d)),
  };
  // monta as funcoes no contexto controlado (mesmo corpo do arquivo)
  const make = (f) => new Function('ctx', `with(ctx){ return (function${f.assinatura.replace(/^function\s+\w+/, '')}${f.corpo}}); }`);
  // isDiaUtil depende de isFeriado (ja no ctx)
  ctx.isDiaUtil = new Function('ctx', `with(ctx){ return (function isDiaUtil(d){${extraiFuncao(js,'isDiaUtil').corpo}}); }`)(ctx);
  ctx.addBusinessDays = new Function('ctx', `with(ctx){ return (function addBusinessDays(start,n){${addBiz.corpo}}); }`)(ctx);
  ctx.proximaQuarta = new Function('ctx', `with(ctx){ return (function proximaQuarta(from){${proxQ.corpo}}); }`)(ctx);
  return {
    addBusinessDays: (start, n) => ctx.addBusinessDays(start, n),
    proximaQuarta: (from) => ctx.proximaQuarta(from),
  };
}

// ── BACK: carrega o holidays.ts removendo os tipos TS na marra ──
// Sem esbuild/tsc: o holidays.ts usa apenas tipos simples (: number, : Date,
// : string, Map<>, Set<>, generics, export). Um strip leve basta e evita
// depender de ferramenta externa que pode nao estar no PATH.
function stripTipos(ts) {
  let js = ts;

  // 1) remove GENERICS por balanceamento de <...>, do interior para fora.
  //    cobre Map<number, Set<string>>, Array<...>, etc. Repete ate estabilizar.
  const semGenerico = (s) => {
    let out = '', i = 0;
    while (i < s.length) {
      // um '<' que abre generico vem logo apos identificador ou '>'
      if (s[i] === '<' && i > 0 && /[\w>]/.test(s[i - 1])) {
        let d = 1, j = i + 1;
        while (j < s.length && d > 0) {
          if (s[j] === '<') d++;
          else if (s[j] === '>') d--;
          j++;
        }
        // so trata como generico se o conteudo parecer tipo (sem ; ou {)
        const dentro = s.slice(i + 1, j - 1);
        if (d === 0 && !/[;{}()]/.test(dentro)) { i = j; continue; }
      }
      out += s[i++];
    }
    return out;
  };
  let antes;
  do { antes = js; js = semGenerico(js); } while (js !== antes);

  // 2) remove anotacoes de tipo:  ": Tipo"  em retornos, params e const/let.
  js = js.replace(/\)\s*:\s*[A-Za-z_][\w.\[\] |]*\s*\{/g, ') {');            // retorno de funcao
  js = js.replace(/([(,]\s*[A-Za-z_]\w*)\s*:\s*[A-Za-z_][\w.\[\] |]*(?=\s*[,)=])/g, '$1'); // params (com/sem default)
  js = js.replace(/:\s*[A-Za-z_][\w.\[\]]*\s*(?=[=;])/g, '');               // const x: T = / ; 

  // 3) export function -> function, e coleta os nomes para module.exports
  const exportados = [...js.matchAll(/export\s+function\s+(\w+)/g)].map(m => m[1]);
  js = js.replace(/export\s+function/g, 'function');
  js += '\nmodule.exports = { ' + exportados.join(', ') + ' };\n';
  return js;
}

function carregarBack() {
  const ts = fs.readFileSync(HOLIDAYS_TS, 'utf8');
  const js = stripTipos(ts);
  const mod = { exports: {} };
  try {
    new Function('module', 'exports', js)(mod, mod.exports);
  } catch (e) {
    throw new Error('nao consegui carregar holidays.ts sem tipos: ' + e.message);
  }
  return mod.exports; // { addBusinessDays, proximaQuarta, holidaysList }
}

// ── datas-armadilha: onde front e back mais poderiam divergir ──
function datasArmadilha() {
  const out = [];
  const anos = [new Date().getFullYear(), new Date().getFullYear() + 1];
  for (const ano of anos) {
    // varre o ano inteiro em passos de 3 dias (pega vesperas, pos-feriados, etc.)
    for (let mes = 0; mes < 12; mes++) {
      for (const dia of [1, 15, 24, 28, 31]) {
        const d = new Date(ano, mes, dia);
        if (d.getMonth() === mes) out.push(d);
      }
    }
    // datas coladas em feriados moveis e fixos conhecidos
    ['-12-24', '-12-31', '-04-20', '-09-06', '-11-01'].forEach(s => out.push(new Date(ano + s + 'T00:00:00')));
  }
  return out;
}

// ── execucao ──
console.log('Testes de paridade front x back\n');

let back;
try { back = carregarBack(); }
catch (e) { console.error('ERRO ao compilar holidays.ts:', e.message); process.exit(2); }

// os feriados que o back conhece (fonte da verdade) alimentam o front,
// exatamente como acontece em producao via /api/prazo/config
const feriadosBack = new Set(back.holidaysList(new Date().getFullYear()));
const front = carregarFront(feriadosBack);

const divergencias = [];
const datas = datasArmadilha();

for (const base of datas) {
  // addBusinessDays para varias somas
  for (const n of [1, 2, 3, 5, 10]) {
    const f = ymd(front.addBusinessDays(base, n));
    const b = ymd(back.addBusinessDays(base, n));
    if (f !== b) divergencias.push(`addBusinessDays(${ymd(base)}, ${n}): front=${f} back=${b}`);
  }
  // proximaQuarta
  const fq = ymd(front.proximaQuarta(base));
  const bq = ymd(back.proximaQuarta(base));
  if (fq !== bq) divergencias.push(`proximaQuarta(${ymd(base)}): front=${fq} back=${bq}`);
}

const totalComparacoes = datas.length * 6;

// ══════════════════════════════════════════════════════════════════════
// (B) TIPOS DE AUTOMACAO — fallback do front x fonte unica do back
// ══════════════════════════════════════════════════════════════════════
const CONFIG_JS = path.join(BASE, 'public/config.js');
const TIPOS_TS = path.join(BASE, 'src/config/tipos.ts');
const divergenciasTipos = [];
let listaFront = null, listaBack = null;

if (!fs.existsSync(CONFIG_JS) || !fs.existsSync(TIPOS_TS)) {
  divergenciasTipos.push('nao encontrei config.js ou tipos.ts para checar');
} else {
  // front: a lista hardcoded do fallback (window.TIPOS_AUTOMACAO = [...])
  const cfg = fs.readFileSync(CONFIG_JS, 'utf8');
  const mF = cfg.match(/window\.TIPOS_AUTOMACAO\s*=\s*\[([^\]]*)\]/);
  // back: a fonte unica (export const TIPOS_AUTOMACAO = [...])
  const ts = fs.readFileSync(TIPOS_TS, 'utf8');
  const mB = ts.match(/export\s+const\s+TIPOS_AUTOMACAO\s*=\s*\[([^\]]*)\]/);

  if (!mF) divergenciasTipos.push('nao achei o fallback window.TIPOS_AUTOMACAO no config.js');
  if (!mB) divergenciasTipos.push('nao achei o export TIPOS_AUTOMACAO no tipos.ts');

  if (mF && mB) {
    const extrair = (s) => s.match(/['"]([\w-]+)['"]/g)?.map(x => x.replace(/['"]/g, '')) || [];
    listaFront = extrair(mF[1]);
    listaBack = extrair(mB[1]);
    const setF = new Set(listaFront), setB = new Set(listaBack);
    // ordem nao importa para o uso (Set/includes); so o CONJUNTO precisa bater
    const soFront = listaFront.filter(t => !setB.has(t));
    const soBack = listaBack.filter(t => !setF.has(t));
    soBack.forEach(t => divergenciasTipos.push(`"${t}" esta no tipos.ts (fonte) mas falta no fallback do config.js`));
    soFront.forEach(t => divergenciasTipos.push(`"${t}" esta no fallback do config.js mas nao no tipos.ts (fonte)`));
  }
}

// ══════════════════════════════════════════════════════════════════════
// RELATORIO UNIFICADO
// ══════════════════════════════════════════════════════════════════════
console.log('(A) Prazo — logica duplicada front/back');
console.log(`    ${totalComparacoes} comparacoes sobre ${datas.length} datas-armadilha (${feriadosBack.size} feriados)`);
if (divergencias.length === 0) {
  console.log('    \u2713 OK — prazo.js e holidays.ts concordam.');
} else {
  console.log(`    \u2717 ${divergencias.length} DIVERGENCIA(S):`);
  divergencias.slice(0, 12).forEach(d => console.log('       ' + d));
  if (divergencias.length > 12) console.log(`       ... e mais ${divergencias.length - 12}`);
}

console.log('\n(B) Tipos de automacao — fallback do config.js x fonte tipos.ts');
if (listaFront && listaBack) {
  console.log(`    fallback: ${listaFront.length} tipos | fonte: ${listaBack.length} tipos`);
}
if (divergenciasTipos.length === 0) {
  console.log('    \u2713 OK — o fallback do front bate com a fonte do back.');
} else {
  console.log(`    \u2717 ${divergenciasTipos.length} PROBLEMA(S):`);
  divergenciasTipos.forEach(d => console.log('       ' + d));
}

const falhou = divergencias.length > 0 || divergenciasTipos.length > 0;
console.log('');
if (!falhou) {
  console.log('  \u2713 PARIDADE OK — tudo que existe em dois lugares concorda.');
  process.exit(0);
} else {
  if (divergencias.length > 0)
    console.log('  Prazo: alguem alterou prazo.js OU holidays.ts sem espelhar no outro.');
  if (divergenciasTipos.length > 0)
    console.log('  Tipos: atualize o fallback no config.js (linha window.TIPOS_AUTOMACAO) para bater com o tipos.ts.');
  console.log('  Corrija antes de subir.');
  process.exit(1);
}
