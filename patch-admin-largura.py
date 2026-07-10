#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Alarga o Painel Admin: container --standard (960px) -> --wide (1100px).
Gráficos e tabela crescem juntos e alinham na mesma borda. Alvo: public/admin.html."""
import io, os, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
HT=_r(["artifacts/api-server/public/admin.html","public/admin.html"])
OLD='<div class="page-container page-container--standard">'
NEW='<div class="page-container page-container--wide">'
if HT is None: sys.exit("admin.html nao encontrado")
s=io.open(HT,encoding="utf-8").read()
if NEW in s: print("JA APLICADO."); sys.exit()
if s.count(OLD)!=1: sys.exit("ancora %d vezes"%s.count(OLD))
bp=HT+".bak-largura"
if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(s)
io.open(HT,"w",encoding="utf-8").write(s.replace(OLD,NEW,1))
print("OK — painel admin agora usa --wide (1100px). backup .bak-largura")
