#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Painel Admin (front):
  (1) Segmento de ESCOPO (Todos / Solicitações / Automações) — filtra o painel
      inteiro; manda &escopo= no /admin/stats.
  (2) CRUZAMENTO tipo x status: um seletor "recorte" pela outra dimensão. Ex.:
      pizza "Por status" + recorte "Artes de Divulgação" -> status só das Artes.
      Usa data.porTipoStatus (tabela cruzada do backend).

Requer os patches anteriores (ranking front + intervalo). Alvo: public/admin.html.
Idempotente, backup .bak-escopofront.
"""
import io, os, sys

def _resolve(cands):
    for c in cands:
        p = os.path.normpath(c)
        if os.path.exists(p): return p
    return None

HT = _resolve(["artifacts/api-server/public/admin.html", "public/admin.html"])

def once(src, old, new, label):
    if src.count(old) != 1:
        sys.exit("ABORTADO [%s]: ancora %d vezes (esperado 1)." % (label, src.count(old)))
    return src.replace(old, new, 1)

# ---------- HTML ----------
# (1) segmento de escopo, antes do card do gráfico
ESCOPO_ANCHOR = '''    <!-- Gráfico de distribuição (donut) -->'''
ESCOPO_NEW = '''    <div style="display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap">
      <span style="font-size:0.8rem;font-weight:600;opacity:0.5">Escopo:</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap" id="adminEscopoBtns">
        <button class="filter-chip active" data-escopo="todos" onclick="setAdminEscopo(this)">Todos</button>
        <button class="filter-chip" data-escopo="solicitacoes" onclick="setAdminEscopo(this)">Solicitações</button>
        <button class="filter-chip" data-escopo="automacoes" onclick="setAdminEscopo(this)">Automações</button>
      </div>
    </div>

    <!-- Gráfico de distribuição (donut) -->'''

# (2) seletor de recorte, dentro do grupo de botões do gráfico
RECORTE_ANCHOR = '''              <svg id="graficoChevronStatus" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        </div>'''
RECORTE_NEW = '''              <svg id="graficoChevronStatus" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
          <select id="graficoRecorte" onchange="setRecorte(this.value)" title="Recortar pela outra dimensão" style="padding:5px 10px;border-radius:var(--radius-md);border:1px solid var(--border-light);background:var(--card-white);font-family:'Nunito Sans',sans-serif;font-size:0.8rem;color:var(--carbon-black);cursor:pointer;max-width:200px"></select>
        </div>'''

# ---------- JS ----------
# (3) estado
STATE_ANCHOR = '''    let adminGraficoModo = 'tipo';
    let adminGraficoData = null;
    let graficoFiltrosAtivos = null;'''
STATE_NEW = '''    let adminGraficoModo = 'tipo';
    let adminGraficoData = null;
    let graficoFiltrosAtivos = null;
    let adminEscopo = 'todos';
    let recorteTipo = null;
    let recorteStatus = null;'''

# (4) URL: append escopo
URL_ANCHOR = '''        if (de && ate) {
          url += '?de=' + de + '&ate=' + ate;
        } else {
          url += '?dias=' + (adminDias || 7);
        }'''
URL_NEW = '''        if (de && ate) {
          url += '?de=' + de + '&ate=' + ate;
        } else {
          url += '?dias=' + (adminDias || 7);
        }
        url += '&escopo=' + adminEscopo;'''

# (5) após setar data: popular recorte
DATA_ANCHOR = '''        adminGraficoData = data;
        renderTopSolicitantes(data.topSolicitantes);'''
DATA_NEW = '''        adminGraficoData = data;
        renderTopSolicitantes(data.topSolicitantes);
        renderRecorteSelect();'''

# (6) funções novas + reset no switchGrafico
FN_ANCHOR = '''    function switchGrafico(modo) {
      adminGraficoModo = modo;
      graficoFiltrosAtivos = null;'''
FN_NEW = '''    function setAdminEscopo(btn) {
      document.querySelectorAll('#adminEscopoBtns .filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      adminEscopo = btn.dataset.escopo;
      loadAdminStats();
    }

    // Base da pizza: cruza tipo x status quando há recorte pela outra dimensão.
    function getGraficoBase(modo) {
      const data = adminGraficoData || {};
      const cross = modo === 'tipo' ? recorteStatus : recorteTipo;
      if (cross && Array.isArray(data.porTipoStatus)) {
        const acc = {};
        data.porTipoStatus.forEach(r => {
          const other = modo === 'tipo' ? r.status : r.tipo;
          if (other !== cross) return;
          const key = modo === 'tipo' ? r.tipo : r.status;
          acc[key] = (acc[key] || 0) + (r.count || 0);
        });
        return Object.keys(acc).map(k => modo === 'tipo' ? { tipo: k, count: acc[k] } : { status: k, count: acc[k] });
      }
      return (modo === 'tipo' ? data.porTipo : data.porStatus) || [];
    }

    function renderRecorteSelect() {
      const sel = document.getElementById('graficoRecorte');
      if (!sel || !adminGraficoData) return;
      const esc2 = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const outra = adminGraficoModo === 'tipo' ? 'status' : 'tipo';
      const cross = adminGraficoModo === 'tipo' ? recorteStatus : recorteTipo;
      let html;
      if (outra === 'status') {
        const vals = (adminGraficoData.porStatus || []).map(i => i.status);
        html = '<option value="">Todos os status</option>' + vals.map(s => '<option value="' + esc2(s) + '"' + (cross === s ? ' selected' : '') + '>Status: ' + esc2(getStatus(s).label) + '</option>').join('');
      } else {
        const vals = (adminGraficoData.porTipo || []).map(i => i.tipo);
        html = '<option value="">Todos os tipos</option>' + vals.map(t => '<option value="' + esc2(t) + '"' + (cross === t ? ' selected' : '') + '>Tipo: ' + esc2((typeof TIPO_SOLICITACAO_LABELS !== 'undefined' && TIPO_SOLICITACAO_LABELS[t]) || t) + '</option>').join('');
      }
      sel.innerHTML = html;
    }

    function setRecorte(val) {
      if (adminGraficoModo === 'tipo') recorteStatus = val || null;
      else recorteTipo = val || null;
      graficoFiltrosAtivos = null;
      renderAdminGrafico();
      renderGraficoDropdown(adminGraficoModo);
    }

    function switchGrafico(modo) {
      adminGraficoModo = modo;
      graficoFiltrosAtivos = null;
      recorteTipo = null; recorteStatus = null;
      renderRecorteSelect();'''

# (7) fontes da pizza -> getGraficoBase (renderGraficoDropdown)
GD_OLD = '''      const todosItens = modo === 'tipo'
        ? adminGraficoData.porTipo.map(i => ({ id: i.tipo, label: (typeof TIPO_SOLICITACAO_LABELS !== 'undefined' && TIPO_SOLICITACAO_LABELS[i.tipo]) || i.tipo, value: i.count }))
        : adminGraficoData.porStatus.map(i => ({ id: i.status, label: getStatus(i.status).label, value: i.count, cor: getStatus(i.status).bg || null }));'''
GD_NEW = '''      const todosItens = modo === 'tipo'
        ? getGraficoBase('tipo').map(i => ({ id: i.tipo, label: (typeof TIPO_SOLICITACAO_LABELS !== 'undefined' && TIPO_SOLICITACAO_LABELS[i.tipo]) || i.tipo, value: i.count }))
        : getGraficoBase('status').map(i => ({ id: i.status, label: getStatus(i.status).label, value: i.count, cor: getStatus(i.status).bg || null }));'''

# (8) fontes da pizza -> getGraficoBase (renderAdminGrafico)
GA_OLD = '''      const todosItens = adminGraficoModo === 'tipo'
        ? adminGraficoData.porTipo
            .filter(i => i.count > 0)'''
GA_NEW = '''      const todosItens = adminGraficoModo === 'tipo'
        ? getGraficoBase('tipo')
            .filter(i => i.count > 0)'''
GA2_OLD = '''        : adminGraficoData.porStatus
            .filter(i => i.count > 0)'''
GA2_NEW = '''        : getGraficoBase('status')
            .filter(i => i.count > 0)'''


def main():
    if HT is None:
        sys.exit("ABORTADO: public/admin.html nao encontrado.")
    src = io.open(HT, encoding="utf-8").read()
    if "setAdminEscopo" in src and "getGraficoBase" in src:
        print("JA APLICADO.")
        return
    if "renderTopSolicitantes" not in src or "url += '?de=' + de" not in src:
        sys.exit("ABORTADO: aplique os patches anteriores (ranking front + intervalo) ANTES deste.")
    bp = HT + ".bak-escopofront"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = once(src, ESCOPO_ANCHOR, ESCOPO_NEW, "html escopo")
    src = once(src, RECORTE_ANCHOR, RECORTE_NEW, "html recorte")
    src = once(src, STATE_ANCHOR, STATE_NEW, "state")
    src = once(src, URL_ANCHOR, URL_NEW, "url")
    src = once(src, DATA_ANCHOR, DATA_NEW, "data")
    src = once(src, FN_ANCHOR, FN_NEW, "funcs+switch")
    src = once(src, GD_OLD, GD_NEW, "dropdown source")
    src = once(src, GA_OLD, GA_NEW, "grafico source tipo")
    src = once(src, GA2_OLD, GA2_NEW, "grafico source status")
    io.open(HT, "w", encoding="utf-8").write(src)
    print("OK — escopo + cruzamento (backup: %s.bak-escopofront)" % HT)


if __name__ == "__main__":
    main()
