const IBGE_CACHE_KEY = 'svn_ibge_v1';
const IBGE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const IBGELoader = {
  async loadEstados() {
    try {
      const cached = JSON.parse(localStorage.getItem(IBGE_CACHE_KEY) || 'null');
      if (cached && cached.estados && Date.now() - cached.timestamp < IBGE_CACHE_TTL_MS) {
        return cached.estados;
      }
    } catch {}

    const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome');
    if (!res.ok) throw new Error('ibge_estados_failed');
    const estados = await res.json();

    try {
      localStorage.setItem(IBGE_CACHE_KEY, JSON.stringify({ estados, timestamp: Date.now() }));
    } catch {}

    return estados;
  },

  async loadCidades(estadoId) {
    const cacheKey = IBGE_CACHE_KEY + '_cidades_' + estadoId;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached && cached.cidades && Date.now() - cached.timestamp < IBGE_CACHE_TTL_MS) {
        return cached.cidades;
      }
    } catch {}

    const res = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estadoId}/municipios?orderBy=nome`);
    if (!res.ok) throw new Error('ibge_cidades_failed');
    const cidades = await res.json();

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ cidades, timestamp: Date.now() }));
    } catch {}

    return cidades;
  },
};
