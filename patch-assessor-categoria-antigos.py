#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Corrige a categoria dos registros ANTIGOS de assessores.

Antes: quer_pagina === 'sim' ? 'pagina' : 'sem-pagina'
  -> registros anteriores a Fase 1 (sem o campo quer_pagina) caiam em 'sem-pagina'.

Agora: quer_pagina === 'nao' ? 'sem-pagina' : 'pagina'
  -> 'sem-pagina' so quando a pessoa escolheu explicitamente NAO;
     ausente (antigos) ou 'sim' -> 'pagina'. Sem migrar dado (categoria e calculada na leitura).

Alvo: artifacts/api-server/src/routes/forms.ts. Idempotente, backup .bak-categoria.
"""
import io, os, sys

def _resolve(cands):
    for c in cands:
        p = os.path.normpath(c)
        if os.path.exists(p): return p
    return None

FORMS = _resolve(["artifacts/api-server/src/routes/forms.ts", "src/routes/forms.ts"])
OLD = '  return String(dados?.quer_pagina || "").toLowerCase() === "sim" ? "pagina" : "sem-pagina";'
NEW = '  return String(dados?.quer_pagina || "").toLowerCase() === "nao" ? "sem-pagina" : "pagina";'

def main():
    if FORMS is None:
        sys.exit("ABORTADO: forms.ts nao encontrado.")
    src = io.open(FORMS, encoding="utf-8").read()
    if NEW in src:
        print("JA APLICADO.")
        return
    if src.count(OLD) != 1:
        sys.exit("ABORTADO: linha da categoria nao encontrada 1x (encontrada %d)." % src.count(OLD))
    bp = FORMS + ".bak-categoria"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = src.replace(OLD, NEW, 1)
    io.open(FORMS, "w", encoding="utf-8").write(src)
    print("OK — categoria corrigida (backup: %s.bak-categoria)" % FORMS)
    print("Stop -> Run no Replit do Hub.")

if __name__ == "__main__":
    main()
