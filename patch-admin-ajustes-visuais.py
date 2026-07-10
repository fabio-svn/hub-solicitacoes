#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ajustes visuais do Painel Admin (pos-escopo/cruzamento):
  (1) Espacamento entre o segmento de Escopo e o card do grafico.
  (2) Rotulo do card de total passa a refletir o escopo (Total / Solicitacoes / Automacoes).
  (3/4) Card de ranking usa .form-card (mesmo padrao visual do card do grafico:
        raio, sombra, borda, largura) -> consistencia e alinhamento.

Alvo: public/admin.html. Idempotente, backup .bak-ajustes.
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

# (1) espacamento do escopo
E1_OLD = '<div style="display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap">'
E1_NEW = '<div style="display:flex;align-items:center;gap:10px;margin:16px 0 24px;flex-wrap:wrap">'

# (2) id no rotulo do card total
E2_OLD = '<div class="stat-label">Solicitações</div>\n        <div id="adminDelta"'
E2_NEW = '<div class="stat-label" id="adminTotalLabel">Solicitações</div>\n        <div id="adminDelta"'

# (2b) atualiza o rotulo conforme escopo no loadAdminStats
E3_OLD = "        document.getElementById('adminTotal').textContent = data.total;"
E3_NEW = ("        document.getElementById('adminTotal').textContent = data.total;\n"
          "        { const _lbl = document.getElementById('adminTotalLabel'); if (_lbl) _lbl.textContent = adminEscopo === 'todos' ? 'Total' : adminEscopo === 'automacoes' ? 'Automações' : 'Solicitações'; }")

# (3/4) ranking como form-card
E4_OLD = '<div id="topSolicitantesCard" style="margin-top:24px;background:var(--card-white,#fff);border:1px solid var(--border-light);border-radius:var(--radius-xl);padding:20px 22px">'
E4_NEW = '<div id="topSolicitantesCard" class="form-card" style="padding:20px;margin-bottom:28px">'


def main():
    if HT is None:
        sys.exit("ABORTADO: public/admin.html nao encontrado.")
    src = io.open(HT, encoding="utf-8").read()
    if 'id="adminTotalLabel"' in src and 'id="topSolicitantesCard" class="form-card"' in src:
        print("JA APLICADO.")
        return
    bp = HT + ".bak-ajustes"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = once(src, E1_OLD, E1_NEW, "espaco escopo")
    src = once(src, E2_OLD, E2_NEW, "id rotulo")
    src = once(src, E3_OLD, E3_NEW, "atualiza rotulo")
    src = once(src, E4_OLD, E4_NEW, "ranking form-card")
    io.open(HT, "w", encoding="utf-8").write(src)
    print("OK — ajustes visuais aplicados (backup: %s.bak-ajustes)" % HT)


if __name__ == "__main__":
    main()
