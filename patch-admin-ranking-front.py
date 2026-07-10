#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Painel Admin (front): novo card "Solicitantes mais ativos" abaixo do grafico,
com barras horizontais (HTML/CSS) a partir de data.topSolicitantes.

Alvo: artifacts/api-server/public/admin.html. Idempotente, backup .bak-ranking.
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

# (1) card HTML antes das abas
CARD_ANCHOR = '''    <div class="tabs">
      <button class="tab active" data-tab="geral" onclick="switchTab('geral')">Solicitações gerais</button>'''
CARD_NEW = '''    <div id="topSolicitantesCard" style="margin-top:24px;background:var(--card-white,#fff);border:1px solid var(--border-light);border-radius:var(--radius-xl);padding:20px 22px">
      <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:16px">
        <h3 style="margin:0;font-size:1rem;font-weight:700;color:var(--carbon-black)">Solicitantes mais ativos</h3>
        <span style="font-size:0.72rem;color:var(--ink-50)">no período selecionado</span>
      </div>
      <div id="topSolicitantesBars"></div>
    </div>

    <div class="tabs">
      <button class="tab active" data-tab="geral" onclick="switchTab('geral')">Solicitações gerais</button>'''

# (2) chamada no loadAdminStats
CALL_ANCHOR = "        adminGraficoData = data;"
CALL_NEW = "        adminGraficoData = data;\n        renderTopSolicitantes(data.topSolicitantes);"

# (3) função (antes de renderGraficoDropdown)
FN_ANCHOR = "    function renderGraficoDropdown(modo) {"
FN_NEW = '''    function renderTopSolicitantes(lista) {
      const box = document.getElementById('topSolicitantesBars');
      if (!box) return;
      const escq = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const arr = Array.isArray(lista) ? lista : [];
      if (!arr.length) { box.innerHTML = '<div style="font-size:0.85rem;color:var(--ink-50);padding:4px 0">Sem solicitações no período.</div>'; return; }
      const max = Math.max.apply(null, arr.map(x => x.count || 0)) || 1;
      box.innerHTML = arr.map(x => {
        const pct = Math.round((x.count || 0) / max * 100);
        const nome = x.nome || '—';
        return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:9px">' +
          '<div style="width:160px;flex-shrink:0;font-size:0.85rem;color:var(--carbon-black);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + escq(nome) + '">' + escq(nome) + '</div>' +
          '<div style="flex:1;min-width:60px;background:var(--icon-bg);border-radius:var(--radius-pill);height:22px;overflow:hidden">' +
            '<div style="width:' + pct + '%;height:100%;background:var(--ruby-red);border-radius:var(--radius-pill);min-width:3px;transition:width .3s"></div>' +
          '</div>' +
          '<div style="width:34px;flex-shrink:0;text-align:right;font-weight:700;font-size:0.9rem;color:var(--carbon-black)">' + (x.count || 0) + '</div>' +
        '</div>';
      }).join('');
    }

    function renderGraficoDropdown(modo) {'''


def main():
    if HT is None:
        sys.exit("ABORTADO: public/admin.html nao encontrado.")
    src = io.open(HT, encoding="utf-8").read()
    if "topSolicitantesBars" in src and "renderTopSolicitantes" in src:
        print("JA APLICADO.")
        return
    bp = HT + ".bak-ranking"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = once(src, CARD_ANCHOR, CARD_NEW, "card")
    src = once(src, CALL_ANCHOR, CALL_NEW, "call")
    src = once(src, FN_ANCHOR, FN_NEW, "func")
    io.open(HT, "w", encoding="utf-8").write(src)
    print("OK — card de ranking adicionado (backup: %s.bak-ranking)" % HT)


if __name__ == "__main__":
    main()
