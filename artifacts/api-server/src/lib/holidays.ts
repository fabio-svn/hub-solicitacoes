// Feriados nacionais brasileiros (fixos + móveis baseados na Páscoa) para cálculo de dias úteis.
// Inclui os feriados nacionais + os móveis amplamente observados (Carnaval, Sexta-feira Santa, Corpus Christi).

// Algoritmo de Meeus/Jones/Butcher para a Páscoa (domingo de Páscoa) de um ano.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = março, 4 = abril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Cache por ano: Set de strings 'YYYY-MM-DD'
const cache = new Map<number, Set<string>>();

/* interno */ function holidaysForYear(year: number): Set<string> {
  const cached = cache.get(year);
  if (cached) return cached;

  const set = new Set<string>();
  // Fixos nacionais
  set.add(`${year}-01-01`); // Confraternização Universal
  set.add(`${year}-04-21`); // Tiradentes
  set.add(`${year}-05-01`); // Dia do Trabalho
  set.add(`${year}-09-07`); // Independência
  set.add(`${year}-10-12`); // Nossa Senhora Aparecida
  set.add(`${year}-11-02`); // Finados
  set.add(`${year}-11-15`); // Proclamação da República
  set.add(`${year}-11-20`); // Consciência Negra (nacional desde 2024)
  set.add(`${year}-12-25`); // Natal

  // Móveis (relativos à Páscoa)
  const easter = easterSunday(year);
  set.add(ymd(addDays(easter, -48))); // Carnaval (segunda)
  set.add(ymd(addDays(easter, -47))); // Carnaval (terça)
  set.add(ymd(addDays(easter, -2)));  // Sexta-feira Santa
  set.add(ymd(addDays(easter, 60)));  // Corpus Christi

  cache.set(year, set);
  return set;
}

/* interno */ function isHoliday(date: Date): boolean {
  return holidaysForYear(date.getFullYear()).has(ymd(date));
}

/* interno */ function isBusinessDay(date: Date): boolean {
  const w = date.getDay();
  if (w === 0 || w === 6) return false; // domingo/sábado
  return !isHoliday(date);
}

// Soma `days` dias úteis (pulando fins de semana e feriados nacionais).
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    if (isBusinessDay(d)) added++;
  }
  return d;
}

// Próxima quarta-feira útil (>= hoje+1) que não seja feriado.
export function proximaQuarta(from: Date = new Date()): Date {
  const d = new Date(from);
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== 3 || isHoliday(d));
  return d;
}

// Lista de feriados (YYYY-MM-DD) cobrindo de (ano-1) a (ano+2), para o front.
export function holidaysList(baseYear: number = new Date().getFullYear()): string[] {
  const out: string[] = [];
  for (let y = baseYear - 1; y <= baseYear + 2; y++) {
    for (const h of holidaysForYear(y)) out.push(h);
  }
  return out.sort();
}
