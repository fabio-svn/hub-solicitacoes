#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resiliencia do perfil (auto-preenchimento):
  Hoje, se o MySQL Contatos falha no login, a sessao guarda um perfil VAZIO
  (encontrado:false) e ele e servido para sempre (agora 30 dias) — os campos
  param de auto-preencher mesmo depois do MySQL voltar.
  Fix: so usar o cache quando encontrado === true; senao, re-buscar.
    * auth.ts  (/auth/me-profile): re-busca se o cache nao foi 'encontrado'.
    * auth.js  (_initFresh): busca /auth/me-profile se profile ausente OU nao encontrado.

Alvos: src/routes/auth.ts + public/auth.js. Idempotente, backups .bak-perfil.
"""
import io, os, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
AUTH_TS=_r(["artifacts/api-server/src/routes/auth.ts","src/routes/auth.ts"])
AUTH_JS=_r(["artifacts/api-server/public/auth.js","public/auth.js"])

def once(s, old, new, label):
    if s.count(old)!=1: sys.exit("ABORTADO [%s]: ancora %d vezes"%(label,s.count(old)))
    return s.replace(old,new,1)

# auth.ts: cache so se encontrado
TS_OLD='''  if (req.session.userProfile) {
    res.json({ profile: req.session.userProfile, fonte: "sessao" });
    return;
  }'''
TS_NEW='''  if (req.session.userProfile && req.session.userProfile.encontrado) {
    res.json({ profile: req.session.userProfile, fonte: "sessao" });
    return;
  }'''

# auth.js: fallback se ausente OU nao encontrado
JS_OLD='''        this.profile = data.profile || null;
        if (!this.profile) {'''
JS_NEW='''        this.profile = data.profile || null;
        if (!this.profile || !this.profile.encontrado) {'''

def main():
    if AUTH_TS is None or AUTH_JS is None:
        sys.exit("ABORTADO: auth.ts e/ou auth.js nao encontrados.")
    ts=io.open(AUTH_TS,encoding="utf-8").read()
    if "req.session.userProfile && req.session.userProfile.encontrado" in ts:
        print("[auth.ts] JA APLICADO.")
    else:
        bp=AUTH_TS+".bak-perfil"
        if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(ts)
        ts=once(ts,TS_OLD,TS_NEW,"auth.ts me-profile")
        io.open(AUTH_TS,"w",encoding="utf-8").write(ts)
        print("[auth.ts] OK — nao serve cache vazio (.bak-perfil)")
    js=io.open(AUTH_JS,encoding="utf-8").read()
    if "!this.profile || !this.profile.encontrado" in js:
        print("[auth.js] JA APLICADO.")
    else:
        bp=AUTH_JS+".bak-perfil"
        if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(js)
        js=once(js,JS_OLD,JS_NEW,"auth.js initFresh")
        io.open(AUTH_JS,"w",encoding="utf-8").write(js)
        print("[auth.js] OK — re-busca perfil se vazio (.bak-perfil)")
    print("\nStop -> Run no Replit do Hub.")

if __name__=="__main__":
    main()
