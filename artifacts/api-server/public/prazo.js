/* Helper único de prazo no front. Consome /api/prazo/config (mesma tabela + feriados do back). */
(function () {
  let CONFIG = null;
  const FERIADOS = new Set();

  function ymd(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isFeriado(d) { return FERIADOS.has(ymd(d)); }
  function isDiaUtil(d) { const w = d.getDay(); return w !== 0 && w !== 6 && !isFeriado(d); }

  function addBusinessDays(start, n) {
    const d = new Date(start); let added = 0;
    while (added < n) { d.setDate(d.getDate() + 1); if (isDiaUtil(d)) added++; }
    return d;
  }
  function proximaQuarta(from) {
    const d = new Date(from || new Date());
    do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 3 || isFeriado(d));
    return d;
  }

  function diasUteis(tipo, dados) {
    dados = dados || {};
    if (!CONFIG) return null;
    if (tipo === 'apresentacao-nova') {
      const t = CONFIG.apresentacaoTiers || {};
      return t[dados.tamanho] != null ? t[dados.tamanho] : 10;
    }
    const tbl = CONFIG.diasUteis || {};
    return tbl[tipo] != null ? tbl[tipo] : 3;
  }

  // Date do prazo a partir de hoje. cartao→próxima quarta; eventos→null (depende da data do evento).
  function dataPrazo(tipo, dados) {
    if (tipo === 'cartao-visita-fisico') return proximaQuarta(new Date());
    if (tipo === 'eventos') return null;
    const dias = diasUteis(tipo, dados);
    if (dias == null) return null;
    return addBusinessDays(new Date(), dias);
  }

  function minISO(tipo, dados) {
    const d = dataPrazo(tipo, dados);
    return d ? ymd(d) : '';
  }

  function labelDias(tipo, dados) {
    if (tipo === 'cartao-visita-fisico') return 'próxima quarta-feira';
    if (tipo === 'eventos') return 'conforme a data do evento';
    const dias = diasUteis(tipo, dados);
    return dias != null ? ('até ' + dias + (dias === 1 ? ' dia útil' : ' dias úteis')) : '';
  }

  function dataBR(tipo, dados) {
    const d = dataPrazo(tipo, dados);
    if (!d) return '';
    return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }

  const ready = fetch('/api/prazo/config')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (cfg) {
        CONFIG = cfg;
        (cfg.feriados || []).forEach(function (f) { FERIADOS.add(f); });
      }
      return CONFIG;
    })
    .catch(function () { return null; });

  window.Prazo = {
    ready: ready,
    addBusinessDays: addBusinessDays,
    proximaQuarta: proximaQuarta,
    diasUteis: diasUteis,
    dataPrazo: dataPrazo,
    minISO: minISO,
    labelDias: labelDias,
    dataBR: dataBR,
    get config() { return CONFIG; },
  };
})();
