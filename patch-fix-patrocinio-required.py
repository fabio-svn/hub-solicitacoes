#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Corrige o form de patrocinio travado.
  REQUIRED_FIELDS["patrocinio"] exigia "expectativaRetorno", campo que NAO existe
  mais no form-patrocinio.html — entao todo envio era barrado com
  "Campo obrigatorio ausente: expectativaRetorno".
  Fix: remover o campo da lista de obrigatorios.

Auditoria dos 24 forms: este era o UNICO campo exigido pelo backend sem contrapartida
no formulario (os demais foram verificados um a um).

Alvo: src/routes/forms.ts. Idempotente, backup .bak-patrocinio.
"""
import io, os, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
F=_r(["artifacts/api-server/src/routes/forms.ts","src/routes/forms.ts"])
if F is None: sys.exit("forms.ts nao encontrado")
s=io.open(F,encoding="utf-8").read()
if '"expectativaRetorno"' not in s:
    print("JA APLICADO."); sys.exit()
OLD='"orcamentoTotal", "expectativaRetorno"]'
NEW='"orcamentoTotal"]'
if s.count(OLD)!=1: sys.exit("ABORTADO: ancora %d vezes"%s.count(OLD))
bp=F+".bak-patrocinio"
if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(s)
io.open(F,"w",encoding="utf-8").write(s.replace(OLD,NEW,1))
print("OK — 'expectativaRetorno' removido dos obrigatorios de patrocinio. backup .bak-patrocinio")
