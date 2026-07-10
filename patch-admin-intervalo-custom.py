#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Intervalo personalizado (De/Ate) passa a respeitar as datas reais.

  Antes: front convertia [de,ate] em N dias e o back fazia "ultimos N dias".
  Agora: front manda ?de=YYYY-MM-DD&ate=YYYY-MM-DD e o back usa o range real
         [de 00:00, ate 23:59:59] (ate inclusivo). O periodo anterior (delta)
         usa a mesma duracao imediatamente antes.

Requer o patch de dias-cheios aplicado antes (ancora na versao com 'fimHoje').
Alvos: forms.ts (back) + admin.html (front). Idempotente, backups .bak-intervalo.
"""
import io, os, sys

def _resolve(cands):
    for c in cands:
        p = os.path.normpath(c)
        if os.path.exists(p): return p
    return None

FORMS = _resolve(["artifacts/api-server/src/routes/forms.ts", "src/routes/forms.ts"])
HT    = _resolve(["artifacts/api-server/public/admin.html", "public/admin.html"])

def once(src, old, new, label):
    if src.count(old) != 1:
        sys.exit("ABORTADO [%s]: ancora %d vezes (esperado 1)." % (label, src.count(old)))
    return src.replace(old, new, 1)

# ---- backend: bloco de periodo (versao pos dias-cheios) ----
B_OLD = '''    const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias), 10) || 7));
    const now = new Date();
    // Períodos contam apenas DIAS CHEIOS: a janela termina no início de hoje (exclui o dia corrente).
    const fimHoje = new Date(now); fimHoje.setHours(0, 0, 0, 0);
    const periodoAtual = new Date(fimHoje.getTime() - dias * 86400000);
    const periodoAnterior = new Date(periodoAtual.getTime() - dias * 86400000);'''
B_NEW = '''    const now = new Date();
    const deRaw = req.query.de ? String(req.query.de) : "";
    const ateRaw = req.query.ate ? String(req.query.ate) : "";
    const rangeValido = /^\\d{4}-\\d{2}-\\d{2}$/.test(deRaw) && /^\\d{4}-\\d{2}-\\d{2}$/.test(ateRaw);
    let dias: number, fimHoje: Date, periodoAtual: Date, periodoAnterior: Date;
    if (rangeValido) {
      // Intervalo personalizado: usa as datas reais ('ate' inclusivo).
      periodoAtual = new Date(deRaw + "T00:00:00");
      fimHoje = new Date(ateRaw + "T00:00:00"); fimHoje.setDate(fimHoje.getDate() + 1);
      dias = Math.max(1, Math.round((fimHoje.getTime() - periodoAtual.getTime()) / 86400000));
      periodoAnterior = new Date(periodoAtual.getTime() - dias * 86400000);
    } else {
      dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias), 10) || 7));
      // Períodos contam apenas DIAS CHEIOS: a janela termina no início de hoje (exclui o dia corrente).
      fimHoje = new Date(now); fimHoje.setHours(0, 0, 0, 0);
      periodoAtual = new Date(fimHoje.getTime() - dias * 86400000);
      periodoAnterior = new Date(periodoAtual.getTime() - dias * 86400000);
    }'''

# ---- frontend: loadAdminStats manda de/ate ----
F_OLD = '''        if (de && ate) {
          const diff = Math.ceil((new Date(ate) - new Date(de)) / 86400000);
          url += '?dias=' + Math.max(1, diff);
        } else {
          url += '?dias=' + (adminDias || 7);
        }'''
F_NEW = '''        if (de && ate) {
          url += '?de=' + de + '&ate=' + ate;
        } else {
          url += '?dias=' + (adminDias || 7);
        }'''


def main():
    if FORMS is None or HT is None:
        sys.exit("ABORTADO: forms.ts e/ou admin.html nao encontrados.")
    # backend
    src = io.open(FORMS, encoding="utf-8").read()
    if "rangeValido" in src:
        print("[back] JA APLICADO.")
    elif "const fimHoje = new Date(now); fimHoje.setHours(0, 0, 0, 0);" not in src:
        sys.exit("ABORTADO: aplique o patch de dias-cheios (patch-admin-periodo-ranking.py) ANTES deste.")
    else:
        bp = FORMS + ".bak-intervalo"
        if not os.path.exists(bp): io.open(bp, "w", encoding="utf-8").write(src)
        src = once(src, B_OLD, B_NEW, "back periodo")
        io.open(FORMS, "w", encoding="utf-8").write(src)
        print("[back] OK — de/ate reais (backup .bak-intervalo)")
    # frontend
    h = io.open(HT, encoding="utf-8").read()
    if "url += '?de=' + de + '&ate=' + ate;" in h:
        print("[front] JA APLICADO.")
    else:
        bp = HT + ".bak-intervalo"
        if not os.path.exists(bp): io.open(bp, "w", encoding="utf-8").write(h)
        h = once(h, F_OLD, F_NEW, "front loadAdminStats")
        io.open(HT, "w", encoding="utf-8").write(h)
        print("[front] OK — envia de/ate (backup .bak-intervalo)")
    print("\nStop -> Run no Replit do Hub.")


if __name__ == "__main__":
    main()
