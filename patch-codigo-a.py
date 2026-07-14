#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Complemento do item 2: o prefixo "A" precisa ir junto no ENVIO.
Sem isso o campo mostra "A" na tela mas grava so os numeros.

Cria a funcao codigoAssessorFmt() e usa nos pontos que leem o campo:
  - form-pagina-assessores.html  (envio da solicitacao)
  - form-convite-fp.html         (envio + geracao do link)
Resultado gravado: "A12345". Campo vazio continua vazio (nao vira "A").

Idempotente, backups .bak-codigoa.
"""
import io, os, sys

def _r(cs):
    for c in cs:
        p = os.path.normpath(c)
        if os.path.exists(p):
            return p
    return None

FPA = _r(["artifacts/api-server/public/form-pagina-assessores.html", "public/form-pagina-assessores.html"])
FCF = _r(["artifacts/api-server/public/form-convite-fp.html", "public/form-convite-fp.html"])
if not FPA or not FCF:
    sys.exit("forms nao encontrados")

HELPER = """
    /** Monta o codigo do assessor no formato final: A + digitos. Vazio continua vazio. */
    function codigoAssessorFmt() {
      var el = document.getElementById('codigoAssessor');
      var num = ((el && el.value) || '').replace(/\\D/g, '');
      return num ? 'A' + num : '';
    }
"""

def aplica(path, trocas, tag):
    s = io.open(path, encoding="utf-8").read()
    if "codigoAssessorFmt" in s:
        print(tag + " JA APLICADO.")
        return
    orig = s
    for antigo, novo in trocas:
        if s.count(antigo) != 1:
            sys.exit("ABORTADO " + tag + ": ancora ausente/duplicada -> " + antigo[:60])
        s = s.replace(antigo, novo, 1)
    # injeta o helper no primeiro <script> proprio da pagina
    marca = "  <script>\n"
    if s.count(marca) < 1:
        sys.exit("ABORTADO " + tag + ": nao achei <script> para o helper")
    idx = s.rfind(marca)
    s = s[:idx + len(marca)] + HELPER + s[idx + len(marca):]
    b = path + ".bak-codigoa"
    if not os.path.exists(b):
        io.open(b, "w", encoding="utf-8").write(orig)
    io.open(path, "w", encoding="utf-8").write(s)
    print(tag + " OK")

aplica(FPA, [
    ("        codigo_assessor: document.getElementById('codigoAssessor').value,",
     "        codigo_assessor: codigoAssessorFmt(),"),
], "[form-pagina-assessores]")

aplica(FCF, [
    ("        codigo_assessor: document.getElementById('codigoAssessor').value,",
     "        codigo_assessor: codigoAssessorFmt(),"),
    ("      var codigo = (document.getElementById('codigoAssessor').value || '').trim();",
     "      var codigo = codigoAssessorFmt();"),
], "[form-convite-fp]")

print("\nStop -> Run + bash check.sh")
