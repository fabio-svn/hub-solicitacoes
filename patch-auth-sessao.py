#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sessao mais persistente: maxAge 24h -> 30 dias (com rolling:true, renova a cada uso).
Reduz a frequencia de re-login. Nao mexe em sameSite (mudanca sensivel; so se for
confirmado embed em iframe cross-origin). Alvo: src/app.ts. Idempotente, backup .bak-sessao."""
import io, os, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
APP=_r(["artifacts/api-server/src/app.ts","src/app.ts"])
OLD='      maxAge: 24 * 60 * 60 * 1000,'
NEW='      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias (rolling renova a cada uso)'
if APP is None: sys.exit("app.ts nao encontrado")
s=io.open(APP,encoding="utf-8").read()
if "maxAge: 30 * 24 * 60 * 60 * 1000" in s: print("JA APLICADO."); sys.exit()
if s.count(OLD)!=1: sys.exit("ancora %d vezes"%s.count(OLD))
bp=APP+".bak-sessao"
if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(s)
io.open(APP,"w",encoding="utf-8").write(s.replace(OLD,NEW,1))
print("OK — sessao 30 dias. backup .bak-sessao")